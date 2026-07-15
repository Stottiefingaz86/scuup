/**
 * Estimated COGS for one Scuup report.
 *
 * Browserbase unit costs come from live session averages when available.
 * OpenAI is modeled from gpt-5.4-mini list rates and typical call shapes
 * (vision scoring + Stagehand acts). These are decision numbers for
 * mission control, not invoices.
 */

export interface CogsAssumptions {
  /** Browserbase browser-hour overage / list rate. */
  browserUsdPerHour: number;
  /** Browserbase proxy overage / list rate. */
  proxyUsdPerGb: number;
  /** Fallback when the sessions API can't be sampled. */
  fallbackBrowserMinutes: number;
  fallbackProxyMb: number;
  /** OpenAI $ per analyze / voc / design run. */
  openaiAnalyzeUsd: number;
  openaiVocUsd: number;
  openaiDesignUsd: number;
}

/** Defaults match Developer overage rates and our calibrated OpenAI model. */
export const DEFAULT_COGS_ASSUMPTIONS: CogsAssumptions = {
  browserUsdPerHour: Number(process.env.BROWSERBASE_USD_PER_HOUR) || 0.12,
  proxyUsdPerGb: Number(process.env.BROWSERBASE_USD_PER_GB) || 12,
  fallbackBrowserMinutes: 2.7,
  fallbackProxyMb: 7.4,
  openaiAnalyzeUsd: 0.05,
  openaiVocUsd: 0.01,
  openaiDesignUsd: 0.02,
};

/** Sessions in a free audit: landing + casino + sports + voc + design. */
export const FREE_REPORT_SESSIONS = 5;
/** Sessions in a full Pro audit: 5 brands × (landing + 8 journeys + voc + design). */
export const FULL_PRO_REPORT_SESSIONS = 55;

export interface SessionUnitCost {
  browserMinutes: number;
  proxyMb: number;
  browserbaseUsd: number;
  sampleSize: number;
  sampled: boolean;
}

export interface ReportCostEstimate {
  label: string;
  sessions: number;
  browserbaseUsd: number;
  openaiUsd: number;
  totalUsd: number;
  detail: string;
}

export interface CycleCogs {
  browserMinutes: number;
  proxyGb: number;
  browserbaseUsd: number;
  openaiUsd: number;
  totalUsd: number;
  analyzeRuns: number;
  vocRuns: number;
  designRuns: number;
  projects: number;
  /** totalUsd / projects when we have at least one report this cycle. */
  effectivePerReportUsd: number | null;
}

export interface ReportCogsOverview {
  unit: SessionUnitCost;
  free: ReportCostEstimate;
  fullPro: ReportCostEstimate;
  cycle: CycleCogs;
  assumptions: CogsAssumptions;
  note: string;
}

function costBrowserbase(
  minutes: number,
  proxyMb: number,
  a: CogsAssumptions
): number {
  return (
    (minutes / 60) * a.browserUsdPerHour + (proxyMb / 1024) * a.proxyUsdPerGb
  );
}

/** Average working-session duration and proxy from completed Browserbase sessions. */
export async function sampleBrowserbaseUnitCost(
  apiKey: string,
  assumptions: CogsAssumptions = DEFAULT_COGS_ASSUMPTIONS
): Promise<SessionUnitCost> {
  try {
    const res = await fetch(
      "https://api.browserbase.com/v1/sessions?status=COMPLETED",
      { headers: { "X-BB-API-Key": apiKey }, cache: "no-store" }
    );
    if (!res.ok) throw new Error(`sessions ${res.status}`);
    const raw = (await res.json()) as Array<{
      startedAt?: string;
      endedAt?: string;
      proxyBytes?: number;
    }>;

    const working: { minutes: number; proxyMb: number }[] = [];
    for (const s of raw) {
      if (!s.startedAt || !s.endedAt) continue;
      const sec =
        (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) /
        1000;
      // Skip stubs and hung sessions so the average reflects real walks.
      if (sec < 60 || sec > 3600) continue;
      working.push({
        minutes: sec / 60,
        proxyMb: (s.proxyBytes ?? 0) / 1_000_000,
      });
    }

    if (working.length < 5) throw new Error("too few working sessions");

    const browserMinutes =
      working.reduce((n, s) => n + s.minutes, 0) / working.length;
    const proxyMb =
      working.reduce((n, s) => n + s.proxyMb, 0) / working.length;

    return {
      browserMinutes,
      proxyMb,
      browserbaseUsd: costBrowserbase(browserMinutes, proxyMb, assumptions),
      sampleSize: working.length,
      sampled: true,
    };
  } catch {
    return {
      browserMinutes: assumptions.fallbackBrowserMinutes,
      proxyMb: assumptions.fallbackProxyMb,
      browserbaseUsd: costBrowserbase(
        assumptions.fallbackBrowserMinutes,
        assumptions.fallbackProxyMb,
        assumptions
      ),
      sampleSize: 0,
      sampled: false,
    };
  }
}

function estimateReport(
  label: string,
  sessions: number,
  unit: SessionUnitCost,
  openaiUsd: number,
  detail: string,
  assumptions: CogsAssumptions
): ReportCostEstimate {
  const bb = costBrowserbase(
    unit.browserMinutes * sessions,
    unit.proxyMb * sessions,
    assumptions
  );
  return {
    label,
    sessions,
    browserbaseUsd: bb,
    openaiUsd,
    totalUsd: bb + openaiUsd,
    detail,
  };
}

export function buildReportCogs(input: {
  unit: SessionUnitCost;
  browserMinutes: number;
  proxyBytes: number;
  analyzeRuns: number;
  vocRuns: number;
  designRuns: number;
  projects: number;
  assumptions?: CogsAssumptions;
}): ReportCogsOverview {
  const a = input.assumptions ?? DEFAULT_COGS_ASSUMPTIONS;
  const proxyGb = input.proxyBytes / 1024 ** 3;
  const proxyMb = input.proxyBytes / 1_000_000;

  // Free: 3 analyze + 1 voc + 1 design. Full Pro: 45 analyze + 5 voc + 5 design.
  const freeOpenai =
    3 * a.openaiAnalyzeUsd + a.openaiVocUsd + a.openaiDesignUsd;
  const fullOpenai =
    45 * a.openaiAnalyzeUsd + 5 * a.openaiVocUsd + 5 * a.openaiDesignUsd;

  const free = estimateReport(
    "Free audit",
    FREE_REPORT_SESSIONS,
    input.unit,
    freeOpenai,
    "1 brand · landing + casino + sports + VoC + design",
    a
  );
  const fullPro = estimateReport(
    "Full Pro report",
    FULL_PRO_REPORT_SESSIONS,
    input.unit,
    fullOpenai,
    "5 brands · landing + 8 journeys + VoC + design each",
    a
  );

  const browserbaseUsd = costBrowserbase(input.browserMinutes, proxyMb, a);
  const openaiUsd =
    input.analyzeRuns * a.openaiAnalyzeUsd +
    input.vocRuns * a.openaiVocUsd +
    input.designRuns * a.openaiDesignUsd;
  const totalUsd = browserbaseUsd + openaiUsd;

  return {
    unit: input.unit,
    free,
    fullPro,
    cycle: {
      browserMinutes: input.browserMinutes,
      proxyGb,
      browserbaseUsd,
      openaiUsd,
      totalUsd,
      analyzeRuns: input.analyzeRuns,
      vocRuns: input.vocRuns,
      designRuns: input.designRuns,
      projects: input.projects,
      effectivePerReportUsd:
        input.projects > 0 ? totalUsd / input.projects : null,
    },
    assumptions: a,
    note: input.unit.sampled
      ? `Browserbase unit cost from ${input.unit.sampleSize} working sessions (≥60s). OpenAI is modeled, not metered.`
      : "Browserbase unit cost using calibrated defaults (sessions sample unavailable). OpenAI is modeled, not metered.",
  };
}

export function formatUsd(n: number): string {
  if (n >= 100) return `$${n.toFixed(0)}`;
  if (n >= 10) return `$${n.toFixed(1)}`;
  return `$${n.toFixed(2)}`;
}
