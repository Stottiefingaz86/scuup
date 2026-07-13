import { supabase } from "./supabase-server";
import {
  brandSlugFromUrl,
  dedupeShowcaseByBrand,
  isShowcaseExcludedBrand,
  monthKey,
  prevMonthKey,
  rowToEntry,
  type ShowcaseEntry,
  type ShowcaseSnapshotRow,
} from "./showcase";
import {
  getProjectById,
} from "./project-db";
import {
  overallScore,
  scorePillars,
  type Brand,
} from "./types";

function snapshotFromBrand(
  brand: Brand,
  market: string,
  month: string,
  projectId: string
) {
  const cx = overallScore(brand);
  if (cx === null) return null;
  const pillars = scorePillars(brand);
  const byKey = Object.fromEntries(pillars.map((p) => [p.key, p.score]));
  return {
    brand_slug: brandSlugFromUrl(brand.url),
    brand_name: brand.name,
    brand_url: brand.url,
    favicon: brand.favicon,
    market,
    month,
    cx_score: cx,
    journeys_score: byKey.journeys ?? null,
    retention_score: byKey.retention ?? null,
    voc_score: byKey.voc ?? null,
    design_score: byKey.design ?? null,
    project_id: projectId,
    brand_id: brand.id,
    updated_at: new Date().toISOString(),
  };
}

/** Upsert monthly snapshots for every scored brand in a completed project. */
export async function syncShowcaseFromProject(projectId: string): Promise<number> {
  const db = supabase();
  const { data: row, error } = await db
    .from("ps_projects")
    .select("id, market, status, analysed_at")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || row.status !== "complete") return 0;

  const project = await getProjectById(projectId);
  if (!project) return 0;

  const analysed = row.analysed_at
    ? new Date(row.analysed_at as string)
    : new Date();
  const month = monthKey(analysed);

  let n = 0;
  for (const brand of project.brands) {
    const slug = brandSlugFromUrl(brand.url);
    if (isShowcaseExcludedBrand(slug)) continue;
    const snap = snapshotFromBrand(brand, project.market, month, projectId);
    if (!snap) continue;
    const { error: upsertErr } = await db
      .from("ps_showcase_snapshots")
      .upsert(snap, { onConflict: "brand_slug,market,month" });
    if (upsertErr) throw new Error(upsertErr.message);
    n += 1;
  }
  return n;
}

export async function listShowcaseSnapshots(opts?: {
  market?: string;
  month?: string;
}): Promise<ShowcaseSnapshotRow[]> {
  let q = supabase()
    .from("ps_showcase_snapshots")
    .select("*")
    .order("cx_score", { ascending: false });

  if (opts?.market) q = q.eq("market", opts.market);
  if (opts?.month) q = q.eq("month", opts.month);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ShowcaseSnapshotRow[];
}

export async function listShowcaseMeta(): Promise<{
  markets: string[];
  months: string[];
}> {
  const { data, error } = await supabase()
    .from("ps_showcase_snapshots")
    .select("market, month");
  if (error) throw new Error(error.message);
  const markets = [
    ...new Set((data ?? []).map((r) => r.market as string)),
  ].sort();
  const months = [
    ...new Set((data ?? []).map((r) => r.month as string)),
  ].sort((a, b) => b.localeCompare(a));
  return { markets, months };
}

/** Build entries with month-over-month deltas for the public carousel. */
export async function buildShowcaseEntries(opts?: {
  market?: string;
  month?: string;
}): Promise<{ entries: ShowcaseEntry[]; markets: string[]; months: string[] }> {
  const meta = await listShowcaseMeta();
  const month = opts?.month ?? meta.months[0];
  if (!month) {
    return { entries: [], markets: meta.markets, months: meta.months };
  }

  const rows = await listShowcaseSnapshots({
    market: opts?.market,
    month,
  }).then((all) =>
    all.filter((row) => !isShowcaseExcludedBrand(row.brand_slug))
  );

  const prevMonth = prevMonthKey(month);
  const prevRows = await listShowcaseSnapshots({
    market: opts?.market,
    month: prevMonth,
  });
  const prevByKey = new Map(
    prevRows.map((r) => [`${r.brand_slug}:${r.market}`, r.cx_score])
  );

  const entries = rows.map((row) => {
    const prev = prevByKey.get(`${row.brand_slug}:${row.market}`) ?? null;
    return rowToEntry(row, prev);
  });

  const visible = opts?.market ? entries : dedupeShowcaseByBrand(entries);

  return { entries: visible, markets: meta.markets, months: meta.months };
}

/** Backfill showcase from every completed project (one-time / cron). */
export async function backfillShowcaseFromAllProjects(): Promise<number> {
  const db = supabase();
  const { data, error } = await db
    .from("ps_projects")
    .select("id")
    .in("status", ["complete", "archived"])
    .not("analysed_at", "is", null);
  if (error) throw new Error(error.message);
  let total = 0;
  for (const row of data ?? []) {
    total += await syncShowcaseFromProject(row.id as string);
  }
  return total;
}
