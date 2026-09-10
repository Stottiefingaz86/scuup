import type {
  CompetitorTeardown,
  EmailWatchItem,
  JourneyRun,
  JourneyStageResult,
} from "./types";
import { comparisonMetricLabel } from "./okrs";
import { pickWelcomeEmail } from "./email-format";
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

export function isSkippedStage(s: JourneyStageResult | null | undefined): boolean {
  return Boolean(s && SKIPPED_RE.test(s.evidence ?? ""));
}

function stageOf(run: JourneyRun, id: string) {
  return run.stages.find((x) => x.stageId === id);
}

function stageDone(run: JourneyRun, id: string): boolean {
  const s = stageOf(run, id);
  return Boolean(
    s?.endedAt && !isSkippedStage(s) && (s.steps || s.timeSec),
  );
}

/** Form was seen (fields or shots) even if this run logged in instead of signing up. */
function stageObserved(run: JourneyRun, id: string): boolean {
  const s = stageOf(run, id);
  return Boolean(
    s &&
      ((s.fieldCount ?? 0) > 0 || (s.screenshotUrls?.length ?? 0) > 0),
  );
}

function evidenceShotTimes(urls: string[]): number[] {
  const out: number[] = [];
  for (const src of urls) {
    const file = src.split("/").pop() ?? "";
    const stamp = file.split("-")[0] ?? "";
    if (stamp.length < 6 || stamp.length > 12) continue;
    const ms = Number.parseInt(stamp, 36);
    if (!Number.isFinite(ms) || ms < 1.6e12 || ms > 2.1e12) continue;
    out.push(ms);
  }
  return out.sort((a, b) => a - b);
}

/**
 * A deposit-resume overwrites registration with "Skipped" / 0s but keeps the
 * original form shots and field count. Recover stopwatch numbers from that.
 */
export function recoverRegistrationMetrics(
  stage: JourneyStageResult | null | undefined,
): { timeSec: number | null; steps: number | null } {
  if (!stage) return { timeSec: null, steps: null };
  const skipped = isSkippedStage(stage);
  const liveTime =
    !skipped && stage.timeSec != null && stage.timeSec > 0
      ? stage.timeSec
      : null;
  const liveSteps =
    !skipped && stage.steps != null && stage.steps > 0 ? stage.steps : null;
  const times = evidenceShotTimes(stage.screenshotUrls ?? []);
  const shotSpan =
    times.length >= 2
      ? Math.max(1, Math.round((times[times.length - 1]! - times[0]!) / 1000))
      : null;
  const inferredSteps =
    (stage.fieldCount ?? 0) > 0
      ? stage.fieldCount
      : (stage.screenshotUrls?.length ?? 0) > 1
        ? stage.screenshotUrls!.length - 1
        : null;
  return {
    timeSec: liveTime ?? shotSpan,
    steps: liveSteps ?? inferredSteps ?? null,
  };
}

function pickNumber(
  ...vals: Array<number | null | undefined>
): number | null {
  for (const v of vals) {
    if (typeof v === "number") return v;
  }
  return null;
}

function welcomeFromEvidence(
  postSignup: JourneyRun["postSignup"],
  emails: EmailWatchItem[] | undefined,
  brandId: string,
): string | null {
  const onSite = welcomeTouchLabel(postSignup);
  if (onSite && onSite !== "None seen") return onSite;
  const mail = emails?.length ? pickWelcomeEmail(emails, brandId) : null;
  if (mail) return "Welcome email";
  return onSite;
}

/**
 * One brand may be covered by several runs — signup in one, deposit/play in
 * a later resume that logged in instead of registering. Merge newest-first,
 * taking each block from the most recent run that actually performed it.
 */
export function teardownForBrand(
  runs: JourneyRun[],
  brandId: string,
  opts?: {
    emails?: EmailWatchItem[];
    stored?: CompetitorTeardown | null;
  },
): { teardown: CompetitorTeardown; sources: TeardownSources } | null {
  const mine = runs
    .filter((r) => r.brandId === brandId && r.kind === "new_player_first_bet")
    .reverse();
  const stored = opts?.stored ?? null;
  if (mine.length === 0) {
    return stored ? { teardown: stored, sources: { registration: null, deposit: null, activation: null } } : null;
  }

  const live = mine.filter((r) => !r.archived);
  const pick = (pred: (r: JourneyRun) => boolean) =>
    live.find(pred) ?? mine.find(pred) ?? null;

  const regRun = pick((r) => stageDone(r, "registration"));
  const fieldRun =
    regRun ?? pick((r) => stageObserved(r, "registration"));
  const depRun = pick((r) => stageDone(r, "deposit"));
  const actRun = pick(
    (r) =>
      r.metrics.depositToFirstBetSec != null ||
      stageDone(r, "first_bet") ||
      stageDone(r, "casino_discovery"),
  );
  const latest = live[0] ?? mine[0]!;

  const recovered = recoverRegistrationMetrics(
    stageOf(regRun ?? fieldRun ?? latest, "registration"),
  );
  const registrationTimeSec = pickNumber(
    regRun ? stageTime(regRun.stages, "registration") || null : null,
    recovered.timeSec,
    stored?.registrationTimeSec,
  );
  const registrationSteps = pickNumber(
    regRun ? stageSteps(regRun.stages, "registration") || null : null,
    recovered.steps,
    stored?.registrationSteps,
  );
  const totalFields = pickNumber(
    fieldRun ? stageFields(fieldRun.stages, "registration") || null : null,
    stored?.totalFields,
  );
  const playSec = actRun
    ? stageTime(
        actRun.stages,
        "casino_discovery",
        "game_launch",
        "first_bet",
      ) || null
    : null;
  const depositTimeSec = pickNumber(
    depRun
      ? (depRun.clockFair
          ? stageTime(depRun.stages, "deposit")
          : stageTime(depRun.stages, "deposit", "deposit_confirmation")) ||
        null
      : null,
    stored?.depositTimeSec,
  );
  const depositSteps = pickNumber(
    depRun ? stageSteps(depRun.stages, "deposit") || null : null,
    stored?.depositSteps,
  );
  const depositToFirstBetSec = pickNumber(
    actRun?.clockFair ? playSec : null,
    actRun?.metrics.depositToFirstBetSec,
    playSec,
    stored?.depositToFirstBetSec,
  );
  const depositToFirstBetClicks = pickNumber(
    actRun?.metrics.depositToFirstBetClicks,
    stored?.depositToFirstBetClicks,
  );

  // Totals: sum the blocks when they come from different runs; otherwise the
  // run's own stopwatch total.
  const sameRun = regRun && regRun === depRun && depRun === actRun;
  const totalOnboardingTimeSec = sameRun
    ? (latest.metrics.totalTimeSec ?? stored?.totalOnboardingTimeSec ?? null)
    : [registrationTimeSec, depositTimeSec, depositToFirstBetSec].some(
          (v) => v != null,
        )
      ? (registrationTimeSec ?? 0) +
        (depositTimeSec ?? 0) +
        (depositToFirstBetSec ?? 0)
      : (stored?.totalOnboardingTimeSec ?? null);
  const totalOnboardingActions = sameRun
    ? (latest.metrics.totalActions ?? stored?.totalOnboardingActions ?? null)
    : [registrationSteps, depositSteps, depositToFirstBetClicks].some(
          (v) => v != null,
        )
      ? (registrationSteps ?? 0) +
        (depositSteps ?? 0) +
        (depositToFirstBetClicks ?? 0)
      : (stored?.totalOnboardingActions ?? null);

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
      welcomeTouch:
        welcomeFromEvidence(
          welcomeRun?.postSignup,
          opts?.emails,
          brandId,
        ) ?? stored?.welcomeTouch ?? null,
    },
    sources: {
      registration: regRun ?? fieldRun,
      deposit: depRun,
      activation: actRun,
    },
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
