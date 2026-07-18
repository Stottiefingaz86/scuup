import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { isAdminUser, requireUser } from "@/lib/auth-server";
import { analyzeJourney } from "@/lib/analyst";
import { auditUrlForMarket } from "@/lib/brand-markets";
import { MARKET_PROXY_COUNTRY } from "@/lib/constants";
import {
  getBrandContextId,
  getCredentialsForLogin,
  markLoggedIn,
} from "@/lib/credentials-db";
import { buildDesignReview, extractDesignSignals } from "@/lib/design-review";
import {
  getProjectById,
  upsertAnalysis,
  upsertDesign,
  upsertVoc,
} from "@/lib/project-db";
import { supabase } from "@/lib/supabase-server";
import type { DeviceMode } from "@/lib/types";
import { personaVariables } from "@/lib/test-persona";
import { buildVocAnalysis, scrapeTrustpilot } from "@/lib/voc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * Monthly report refresh — keeps paying customers' active reports living.
 *
 * Runs daily (Vercel Cron) and re-runs the OLDEST analyses that have gone
 * stale (>30 days) on complete, non-archived reports owned by paid plans.
 * A few areas refresh per day, so a full report rolls over the month
 * instead of burning one giant burst of agent runs — and the score
 * guardrail in upsertAnalysis keeps each refreshed number anchored to the
 * previous run. Archived reports never refresh: archive = paused.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. Admins
 * may also trigger a batch manually from a signed-in session.
 */

const STALE_DAYS = 30;
/** Areas refreshed per daily invocation (fits the 300s budget). */
const BATCH = 3;
/** Signup re-runs would try to register the test account again. */
const SKIP_AREAS = new Set(["signup"]);

interface RefreshJob {
  kind: "analyze" | "voc" | "design";
  projectId: string;
  ownerId: string;
  brandId: string;
  brandName: string;
  brandUrl: string;
  market: string;
  ownBrand: boolean;
  area: string; // journey area, or "voc" / "design"
  staleSince: string;
  device: DeviceMode;
}

async function authorized(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (secret && header === `Bearer ${secret}`) return true;
  try {
    const user = await requireUser();
    return isAdminUser(user);
  } catch {
    return false;
  }
}

/** Brands on paid owners' complete (non-archived) reports. */
async function eligibleBrands() {
  const db = supabase();
  const { data: projects, error } = await db
    .from("ps_projects")
    .select("id, user_id, market, device")
    .eq("status", "complete");
  if (error) throw new Error(error.message);
  if (!projects?.length) return [];

  const userIds = [...new Set(projects.map((p) => p.user_id as string))];
  const { data: profiles, error: profErr } = await db
    .from("ps_profiles")
    .select("user_id, plan")
    .in("user_id", userIds);
  if (profErr) throw new Error(profErr.message);
  const paid = new Set(
    (profiles ?? [])
      .filter((p) => p.plan === "pro" || p.plan === "pro_plus")
      .map((p) => p.user_id as string)
  );

  const paidProjects = projects.filter((p) => paid.has(p.user_id as string));
  if (!paidProjects.length) return [];

  const { data: brandRows, error: brandErr } = await db
    .from("ps_brands")
    .select("id, project_id, name, url, role")
    .in(
      "project_id",
      paidProjects.map((p) => p.id as string)
    );
  if (brandErr) throw new Error(brandErr.message);

  const byProject = new Map(paidProjects.map((p) => [p.id as string, p]));
  return (brandRows ?? []).map((b) => ({
    id: b.id as string,
    projectId: b.project_id as string,
    ownerId: (byProject.get(b.project_id as string)?.user_id as string) ?? "",
    name: b.name as string,
    url: b.url as string,
    ownBrand: b.role === "own_brand",
    market: (byProject.get(b.project_id as string)?.market as string) ?? "",
    device: ((byProject.get(b.project_id as string)?.device as string) ??
      "both") as DeviceMode,
  }));
}

/** The stalest refreshable work across journeys, VoC and design. */
async function findStaleJobs(): Promise<RefreshJob[]> {
  const brands = await eligibleBrands();
  if (!brands.length) return [];
  const byId = new Map(brands.map((b) => [b.id, b]));
  const brandIds = brands.map((b) => b.id);
  const cutoff = new Date(
    Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const db = supabase();

  const [analyses, vocs, designs] = await Promise.all([
    db
      .from("ps_analyses")
      .select("brand_id, area, analysed_at")
      .in("brand_id", brandIds)
      .lt("analysed_at", cutoff)
      .order("analysed_at", { ascending: true })
      .limit(BATCH * 4),
    db
      .from("ps_voc")
      .select("brand_id, fetched_at")
      .in("brand_id", brandIds)
      .lt("fetched_at", cutoff)
      .order("fetched_at", { ascending: true })
      .limit(BATCH),
    db
      .from("ps_design")
      .select("brand_id, fetched_at")
      .in("brand_id", brandIds)
      .lt("fetched_at", cutoff)
      .order("fetched_at", { ascending: true })
      .limit(BATCH),
  ]);
  for (const res of [analyses, vocs, designs]) {
    if (res.error) throw new Error(res.error.message);
  }

  const jobs: RefreshJob[] = [];
  const push = (
    kind: RefreshJob["kind"],
    brandId: string,
    area: string,
    staleSince: string
  ) => {
    const b = byId.get(brandId);
    if (!b) return;
    jobs.push({
      kind,
      projectId: b.projectId,
      ownerId: b.ownerId,
      brandId,
      brandName: b.name,
      brandUrl: b.url,
      market: b.market,
      ownBrand: b.ownBrand,
      area,
      staleSince,
      device: b.device,
    });
  };

  for (const a of analyses.data ?? []) {
    if (SKIP_AREAS.has(a.area as string)) continue;
    push("analyze", a.brand_id as string, a.area as string, a.analysed_at as string);
  }
  for (const v of vocs.data ?? []) {
    push("voc", v.brand_id as string, "voc", v.fetched_at as string);
  }
  for (const d of designs.data ?? []) {
    push("design", d.brand_id as string, "design", d.fetched_at as string);
  }

  jobs.sort((a, b) => a.staleSince.localeCompare(b.staleSince));
  return jobs.slice(0, BATCH);
}

async function runJourneyRefresh(job: RefreshJob): Promise<void> {
  const contextId = await getBrandContextId(job.brandId).catch(() => null);
  let loginVars: Record<string, string> | null = null;
  let accountExists = false;
  try {
    const creds = await getCredentialsForLogin(job.brandId);
    if (creds.persona && creds.password) {
      loginVars = personaVariables(creds.persona, creds.password);
    }
    accountExists = creds.loggedInAt != null;
  } catch {
    // Public journeys still refresh logged out.
  }

  const proxyCountry = MARKET_PROXY_COUNTRY[job.market] ?? null;
  const url = auditUrlForMarket(job.brandUrl, job.market);
  const result = await analyzeJourney(url, job.area, contextId, proxyCountry, {
    loginVars,
    accountExists,
    device: job.device,
  });
  const { chainedAnalyses: _ignored, ...analysis } = result;
  await upsertAnalysis(job.brandId, analysis);
  if (analysis.authenticated || analysis.loggedIn) {
    await markLoggedIn(job.brandId).catch(() => {});
  }
}

async function runVocRefresh(job: RefreshJob): Promise<void> {
  const project = await getProjectById(job.projectId);
  const brand = project?.brands.find((b) => b.id === job.brandId);
  if (!project || !brand) throw new Error("project or brand missing");
  const scrape = await scrapeTrustpilot(brand.url);
  const voc = await buildVocAnalysis(project, brand, scrape);
  await upsertVoc(job.brandId, voc);
}

async function runDesignRefresh(job: RefreshJob): Promise<void> {
  const project = await getProjectById(job.projectId);
  const brand = project?.brands.find((b) => b.id === job.brandId);
  if (!project || !brand) throw new Error("project or brand missing");
  const signals = await extractDesignSignals(brand.url, project.market);
  const design = await buildDesignReview(project, brand, signals);
  await upsertDesign(job.brandId, design);
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let jobs: RefreshJob[];
  try {
    jobs = await findStaleJobs();
  } catch (e) {
    const message = e instanceof Error ? e.message : "stale scan failed";
    console.error("[cron/refresh] scan failed:", message);
    Sentry.captureException(e, { tags: { route: "cron-refresh" } });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (jobs.length === 0) {
    return NextResponse.json({ refreshed: [], message: "nothing stale" });
  }

  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      if (job.kind === "voc") await runVocRefresh(job);
      else if (job.kind === "design") await runDesignRefresh(job);
      else await runJourneyRefresh(job);
      return job;
    })
  );

  const refreshed: string[] = [];
  const failed: string[] = [];
  const touchedProjects = new Set<string>();
  results.forEach((r, i) => {
    const label = `${jobs[i]!.brandName} · ${jobs[i]!.area}`;
    if (r.status === "fulfilled") {
      refreshed.push(label);
      touchedProjects.add(jobs[i]!.projectId);
    } else {
      failed.push(`${label}: ${r.reason instanceof Error ? r.reason.message : r.reason}`);
      console.error(`[cron/refresh] ${label} failed:`, r.reason);
      Sentry.captureException(r.reason, {
        tags: { route: "cron-refresh", area: jobs[i]!.area },
        extra: { brandId: jobs[i]!.brandId, projectId: jobs[i]!.projectId },
      });
    }
  });

  // Cron refreshes spend the same Browserbase/OpenAI money as user runs —
  // log them against the owner so mission-control charts and COGS see them.
  const runRows = results
    .map((r, i) =>
      r.status === "fulfilled" && jobs[i]!.ownerId
        ? { user_id: jobs[i]!.ownerId, kind: jobs[i]!.kind }
        : null
    )
    .filter((r) => r !== null);
  if (runRows.length) {
    await supabase()
      .from("ps_run_log")
      .insert(runRows)
      .then(({ error }) => {
        if (error) console.error("[cron/refresh] run log failed:", error.message);
      });
  }

  // Rolling freshness marker so "analysed" dates reflect the live cycle.
  for (const projectId of touchedProjects) {
    await supabase()
      .from("ps_projects")
      .update({ analysed_at: new Date().toISOString() })
      .eq("id", projectId)
      .then(({ error }) => {
        if (error) console.error("[cron/refresh] touch failed:", error.message);
      });
  }

  return NextResponse.json({ refreshed, failed });
}
