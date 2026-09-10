import type {
  CompetitorTeardown,
  JourneyRun,
  JourneyStageResult,
} from "./types";
import { comparisonMetricLabel } from "./okrs";
import { welcomeTouchLabel } from "./post-signup";

function stageTime(stages: JourneyStageResult[], ...ids: string[]): number {
  return ids.reduce((a, id) => {
    const s = stages.find((x) => x.stageId === id);
    return a + (s?.timeSec ?? 0);
  }, 0);
}

function stageSteps(stages: JourneyStageResult[], ...ids: string[]): number {
  return ids.reduce((a, id) => {
    const s = stages.find((x) => x.stageId === id);
    return a + (s?.steps ?? 0);
  }, 0);
}

function stageFields(stages: JourneyStageResult[], ...ids: string[]): number {
  return ids.reduce((a, id) => {
    const s = stages.find((x) => x.stageId === id);
    return a + (s?.fieldCount ?? 0);
  }, 0);
}

/** Build the competitor teardown summary from a completed timed run. */
export function teardownFromRun(run: JourneyRun): CompetitorTeardown {
  const s = run.stages;
  return {
    brandId: run.brandId,
    dateTested: run.dateTested,
    registrationTimeSec: stageTime(s, "registration") || null,
    registrationSteps: stageSteps(s, "registration") || null,
    totalFields: stageFields(s, "registration") || null,
    depositTimeSec: stageTime(s, "deposit", "deposit_confirmation") || null,
    depositSteps: stageSteps(s, "deposit") || null,
    depositToFirstBetSec: run.metrics.depositToFirstBetSec,
    depositToFirstBetClicks: run.metrics.depositToFirstBetClicks,
    totalOnboardingTimeSec: run.metrics.totalTimeSec,
    totalOnboardingActions: run.metrics.totalActions,
    welcomeTouch: welcomeTouchLabel(run.postSignup),
  };
}

/** Which run's stages back each block of the teardown — for evidence thumbs. */
export interface TeardownSources {
  registration: JourneyRun | null;
  deposit: JourneyRun | null;
  activation: JourneyRun | null;
}

const SKIPPED_RE =
  /skipped|already logged in|session active|resume after signup/i;

function stageDone(run: JourneyRun, id: string): boolean {
  const s = run.stages.find((x) => x.stageId === id);
  return Boolean(
    s?.endedAt && !SKIPPED_RE.test(s.evidence ?? "") && (s.steps || s.timeSec),
  );
}

/**
 * One brand may be covered by several runs — signup in one, deposit/play in
 * a later resume that logged in instead of registering. Merge newest-first,
 * taking each block from the most recent run that actually performed it.
 */
export function teardownForBrand(
  runs: JourneyRun[],
  brandId: string,
): { teardown: CompetitorTeardown; sources: TeardownSources } | null {
  const mine = runs
    .filter((r) => r.brandId === brandId && r.kind === "new_player_first_bet")
    .reverse();
  if (mine.length === 0) return null;

  const regRun = mine.find((r) => stageDone(r, "registration")) ?? null;
  const depRun = mine.find((r) => stageDone(r, "deposit")) ?? null;
  const actRun =
    mine.find(
      (r) =>
        r.metrics.depositToFirstBetSec != null ||
        stageDone(r, "first_bet") ||
        stageDone(r, "casino_discovery"),
    ) ?? null;
  const latest = mine[0]!;

  const registrationTimeSec = regRun
    ? stageTime(regRun.stages, "registration") || null
    : null;
  const registrationSteps = regRun
    ? stageSteps(regRun.stages, "registration") || null
    : null;
  const totalFields = regRun
    ? stageFields(regRun.stages, "registration") || null
    : null;
  const depositTimeSec = depRun
    ? stageTime(depRun.stages, "deposit", "deposit_confirmation") || null
    : null;
  const depositSteps = depRun
    ? stageSteps(depRun.stages, "deposit") || null
    : null;
  const depositToFirstBetSec = actRun?.metrics.depositToFirstBetSec ?? null;
  const depositToFirstBetClicks =
    actRun?.metrics.depositToFirstBetClicks ?? null;

  // Totals: sum the blocks when they come from different runs; otherwise the
  // run's own stopwatch total.
  const sameRun = regRun && regRun === depRun && depRun === actRun;
  const totalOnboardingTimeSec = sameRun
    ? (latest.metrics.totalTimeSec ?? null)
    : [registrationTimeSec, depositTimeSec, depositToFirstBetSec].some(
          (v) => v != null,
        )
      ? (registrationTimeSec ?? 0) +
        (depositTimeSec ?? 0) +
        (depositToFirstBetSec ?? 0)
      : null;
  const totalOnboardingActions = sameRun
    ? (latest.metrics.totalActions ?? null)
    : [registrationSteps, depositSteps, depositToFirstBetClicks].some(
          (v) => v != null,
        )
      ? (registrationSteps ?? 0) +
        (depositSteps ?? 0) +
        (depositToFirstBetClicks ?? 0)
      : null;

  const welcomeRun = mine.find((r) => r.postSignup) ?? null;
  return {
    teardown: {
      brandId,
      dateTested: latest.dateTested,
      registrationTimeSec,
      registrationSteps,
      totalFields,
      depositTimeSec,
      depositSteps,
      depositToFirstBetSec,
      depositToFirstBetClicks,
      totalOnboardingTimeSec,
      totalOnboardingActions,
      welcomeTouch: welcomeTouchLabel(welcomeRun?.postSignup),
    },
    sources: { registration: regRun, deposit: depRun, activation: actRun },
  };
}

export interface JourneyComparisonRow {
  metric: string;
  okrHint: string;
  own: number | null;
  best: number | null;
  bestBrand: string | null;
  gapRatio: number | null;
  unit: "sec" | "count";
}

/** Executive journey comparison: own brand vs best competitor on each metric. */
export function buildJourneyComparison(
  own: CompetitorTeardown | null,
  others: { name: string; teardown: CompetitorTeardown }[],
): JourneyComparisonRow[] {
  const rows: {
    key: keyof CompetitorTeardown;
    unit: "sec" | "count";
  }[] = [
    { key: "registrationTimeSec", unit: "sec" },
    { key: "registrationSteps", unit: "count" },
    { key: "totalFields", unit: "count" },
    { key: "depositTimeSec", unit: "sec" },
    { key: "depositSteps", unit: "count" },
    { key: "depositToFirstBetSec", unit: "sec" },
    { key: "depositToFirstBetClicks", unit: "count" },
    { key: "totalOnboardingTimeSec", unit: "sec" },
    { key: "totalOnboardingActions", unit: "count" },
  ];

  return rows.map(({ key, unit }) => {
    const { label: metric, okrHint } = comparisonMetricLabel(key);
    const ownVal =
      own && typeof own[key] === "number" ? (own[key] as number) : null;
    let best: number | null = null;
    let bestBrand: string | null = null;
    for (const o of others) {
      const v = o.teardown[key];
      if (typeof v !== "number") continue;
      if (best == null || v < best) {
        best = v;
        bestBrand = o.name;
      }
    }
    const gapRatio =
      ownVal != null && best != null && best > 0
        ? Math.round((ownVal / best) * 10) / 10
        : null;
    return { metric, okrHint, own: ownVal, best, bestBrand, gapRatio, unit };
  });
}
