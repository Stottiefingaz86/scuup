import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { AuthError, isAdminUser, requireUser } from "@/lib/auth-server";
import {
  buildReportCogs,
  fallbackUnitCost,
  sampleBrowserbaseUnitCost,
  type ReportCogsOverview,
} from "@/lib/report-cogs";
import { supabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Infrastructure health for mission control: how much of each provider's
 * plan allocation we're burning, so scaling decisions come from data.
 *
 * Plan allocations default to the current paid tiers and can be overridden
 * via env when the plan changes:
 *   BROWSERBASE_PLAN_MINUTES   (default 6000 = Developer's 100 browser hrs)
 *   BROWSERBASE_PLAN_PROXY_GB  (default 1   = Developer)
 *   SUPABASE_PLAN_DB_MB        (default 500 = Free tier)
 *   SUPABASE_PLAN_STORAGE_MB   (default 1024 = Free tier)
 *   BROWSERBASE_USD_PER_HOUR / BROWSERBASE_USD_PER_GB for COGS rates
 */

export type { ReportCogsOverview };

export interface HealthMetric {
  label: string;
  /** Human-readable usage, e.g. "9.5 hrs" or "45 MB". */
  used: string;
  /** Plan allocation in the same units, null when unknown/unlimited. */
  limit: string | null;
  /** 0-100+ (can exceed 100 when in overage), null when no limit. */
  percent: number | null;
  detail?: string;
}

export interface ServiceHealth {
  service: string;
  ok: boolean;
  metrics: HealthMetric[];
  error?: string;
}

function envNumber(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function pct(used: number, limit: number): number {
  return Math.round((used / limit) * 100);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

async function browserbaseUsage(): Promise<{
  browserMinutes: number;
  proxyBytes: number;
} | null> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) return null;
  const res = await fetch(
    `https://api.browserbase.com/v1/projects/${projectId}/usage`,
    { headers: { "X-BB-API-Key": apiKey }, cache: "no-store" }
  );
  if (!res.ok) return null;
  return (await res.json()) as {
    browserMinutes: number;
    proxyBytes: number;
  };
}

function browserbaseHealthFromUsage(
  usage: { browserMinutes: number; proxyBytes: number } | null
): ServiceHealth {
  if (!usage) {
    return {
      service: "Browserbase",
      ok: false,
      metrics: [],
      error: "Not configured (missing API key or project ID).",
    };
  }

  const planMinutes = envNumber("BROWSERBASE_PLAN_MINUTES", 6000);
  const planProxyGb = envNumber("BROWSERBASE_PLAN_PROXY_GB", 1);
  const proxyLimitBytes = planProxyGb * 1024 ** 3;

  return {
    service: "Browserbase",
    ok: true,
    metrics: [
      {
        label: "Browser time",
        used: `${(usage.browserMinutes / 60).toFixed(1)} hrs`,
        limit: `${Math.round(planMinutes / 60)} hrs`,
        percent: pct(usage.browserMinutes, planMinutes),
        detail: `${usage.browserMinutes.toLocaleString()} minutes billed`,
      },
      {
        label: "Proxy bandwidth",
        used: formatBytes(usage.proxyBytes),
        limit: `${planProxyGb} GB`,
        percent: pct(usage.proxyBytes, proxyLimitBytes),
        detail:
          usage.proxyBytes > proxyLimitBytes
            ? "Over allocation, overage billing applies"
            : undefined,
      },
    ],
  };
}

async function countKind(kind: string): Promise<number> {
  const { count, error } = await supabase()
    .from("ps_run_log")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind);
  if (error) return 0;
  return count ?? 0;
}

async function runKindCounts(): Promise<{
  analyze: number;
  voc: number;
  design: number;
  projects: number;
}> {
  try {
    const [analyze, voc, design, projects] = await Promise.all([
      countKind("analyze"),
      countKind("voc"),
      countKind("design"),
      supabase()
        .from("ps_projects")
        .select("id", { count: "exact", head: true })
        .then((r) => r.count ?? 0),
    ]);
    return { analyze, voc, design, projects };
  } catch {
    return { analyze: 0, voc: 0, design: 0, projects: 0 };
  }
}

async function buildCogs(
  usage: { browserMinutes: number; proxyBytes: number } | null
): Promise<ReportCogsOverview | null> {
  if (!usage) return null;
  const apiKey = process.env.BROWSERBASE_API_KEY ?? "";

  // Unit sampling is best-effort; never block or blank the COGS panel.
  const [unit, runs] = await Promise.all([
    sampleBrowserbaseUnitCost(apiKey).catch(() => fallbackUnitCost()),
    runKindCounts(),
  ]);

  return buildReportCogs({
    unit,
    browserMinutes: usage.browserMinutes,
    proxyBytes: usage.proxyBytes,
    analyzeRuns: runs.analyze,
    vocRuns: runs.voc,
    designRuns: runs.design,
    projects: runs.projects,
  });
}

async function supabaseHealth(): Promise<ServiceHealth> {
  const { data, error } = await supabase().rpc("scuup_admin_usage");
  if (error) {
    return {
      service: "Supabase",
      ok: false,
      metrics: [],
      error: error.message,
    };
  }
  const usage = data as {
    db_bytes: number;
    evidence_bytes: number;
    evidence_files: number;
    projects: number;
    profiles: number;
    run_log_rows: number;
  };

  const dbLimitBytes = envNumber("SUPABASE_PLAN_DB_MB", 500) * 1024 ** 2;
  const storageLimitBytes =
    envNumber("SUPABASE_PLAN_STORAGE_MB", 1024) * 1024 ** 2;

  return {
    service: "Supabase",
    ok: true,
    metrics: [
      {
        label: "Database size",
        used: formatBytes(usage.db_bytes),
        limit: formatBytes(dbLimitBytes),
        percent: pct(usage.db_bytes, dbLimitBytes),
        detail: `${usage.projects} reports · ${usage.profiles} profiles`,
      },
      {
        label: "Evidence storage",
        used: formatBytes(usage.evidence_bytes),
        limit: formatBytes(storageLimitBytes),
        percent: pct(usage.evidence_bytes, storageLimitBytes),
        detail: `${usage.evidence_files.toLocaleString()} screenshots`,
      },
    ],
  };
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "admins only" }, { status: 403 });
    }

    // One slow/broken provider must not blank out the other.
    const [usage, supabaseUsage] = await Promise.all([
      browserbaseUsage().catch(() => null),
      supabaseHealth().catch(
        (e): ServiceHealth => ({
          service: "Supabase",
          ok: false,
          metrics: [],
          error: e instanceof Error ? e.message : "query failed",
        })
      ),
    ]);

    const browserbase = browserbaseHealthFromUsage(usage);
    const cogs = await buildCogs(usage).catch((e) => {
      console.error("[admin/health] cogs failed:", e);
      return null;
    });

    return NextResponse.json({
      services: [browserbase, supabaseUsage],
      cogs,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error("[admin/health] failed:", e);
    Sentry.captureException(e, { tags: { route: "admin-health" } });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
