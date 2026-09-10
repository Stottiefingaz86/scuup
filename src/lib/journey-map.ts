import { ANALYSIS_AREA_LABELS } from "./constants";
import { toObservation, type Brand, type JourneyAnalysis } from "./types";

/** iGaming player lifecycle — onboarding first, then play, then retain. */
export const JOURNEY_MAP_PHASES = [
  {
    key: "onboarding",
    label: "Onboarding",
    description: "First impression → sign up → first time deposit",
    areas: ["landing", "signup", "deposit"],
  },
  {
    key: "play",
    label: "Play",
    description: "Casino, sports and bingo",
    areas: ["casino", "bingo", "sports_betslip"],
  },
  {
    key: "retain",
    label: "Retain & account",
    description: "Withdraw, rewards, support and account",
    areas: ["withdraw", "loyalty_rewards", "support", "my_account"],
  },
] as const;

/** Flat order derived from phases — deposit comes before play lobbies. */
export const JOURNEY_MAP_ORDER = JOURNEY_MAP_PHASES.flatMap((p) => p.areas);

export type JourneyMapStageStatus = "walked" | "blocked" | "pending";

export interface JourneyMapStage {
  area: string;
  label: string;
  phase: (typeof JOURNEY_MAP_PHASES)[number]["key"];
  phaseLabel: string;
  status: JourneyMapStageStatus;
  score: number | null;
  summary: string | null;
  blockReason: string | null;
  /** Agent trail for this journey — what the walk actually did. */
  trailSteps: string[];
  /** Trail steps that look like friction or dead ends. */
  frictionSteps: string[];
  /** Plain-language friction notes from the analysis. */
  observations: string[];
  screenshot: string | null;
  analysedAt: string | null;
  finalUrl: string | null;
  loggedIn: boolean;
}

const FRICTION_RE =
  /\b(reject|failed|error|validation|stuck|block|wall|could not|exhaust|invalid|incorrect|denied|timeout|unable)\b/i;

function areaPhase(area: string): (typeof JOURNEY_MAP_PHASES)[number]["key"] {
  for (const phase of JOURNEY_MAP_PHASES) {
    if ((phase.areas as readonly string[]).includes(area)) return phase.key;
  }
  return "onboarding";
}

function areaPhaseLabel(area: string): string {
  const phase = JOURNEY_MAP_PHASES.find((p) =>
    (p.areas as readonly string[]).includes(area)
  );
  return phase?.label ?? "Onboarding";
}

function mapLabel(area: string): string {
  return ANALYSIS_AREA_LABELS[area] ?? area;
}

function frictionTrailSteps(trail: string[]): string[] {
  return trail.filter((step) => FRICTION_RE.test(step));
}

function frictionObservations(analysis: JourneyAnalysis): string[] {
  return analysis.observations
    .map(toObservation)
    .map((o) => o.text)
    .filter((text) => FRICTION_RE.test(text))
    .slice(0, 3);
}

function stageFromAnalysis(
  area: string,
  analysis: JourneyAnalysis | undefined
): JourneyMapStage {
  const label = mapLabel(area);
  const phase = areaPhase(area);
  const phaseLabel = areaPhaseLabel(area);

  if (!analysis) {
    return {
      area,
      label,
      phase,
      phaseLabel,
      status: "pending",
      score: null,
      summary: null,
      blockReason: null,
      trailSteps: [],
      frictionSteps: [],
      observations: [],
      screenshot: null,
      analysedAt: null,
      finalUrl: null,
      loggedIn: false,
    };
  }

  if (analysis.blocked) {
    const trail = analysis.trail ?? [];
    return {
      area,
      label,
      phase,
      phaseLabel,
      status: "blocked",
      score: null,
      summary: analysis.summary,
      blockReason: analysis.blockReason,
      trailSteps: trail,
      frictionSteps: frictionTrailSteps(trail),
      observations: frictionObservations(analysis),
      screenshot: analysis.screenshots?.[0] ?? null,
      analysedAt: analysis.analysedAt,
      finalUrl: analysis.finalUrl,
      loggedIn: analysis.loggedIn ?? analysis.authenticated ?? false,
    };
  }

  const trail = analysis.trail ?? [];
  const obs =
    frictionObservations(analysis).length > 0
      ? frictionObservations(analysis)
      : analysis.observations
          .map(toObservation)
          .map((o) => o.text)
          .slice(0, 2);

  return {
    area,
    label,
    phase,
    phaseLabel,
    status: "walked",
    score: analysis.score,
    summary: analysis.summary,
    blockReason: null,
    trailSteps: trail,
    frictionSteps: frictionTrailSteps(trail),
    observations: obs,
    screenshot: analysis.screenshots?.[0] ?? null,
    analysedAt: analysis.analysedAt,
    finalUrl: analysis.finalUrl,
    loggedIn: analysis.loggedIn ?? analysis.authenticated ?? false,
  };
}

/** Build the ordered journey map for one brand from captured analyses. */
export function buildJourneyMap(
  brand: Brand,
  areas: string[]
): JourneyMapStage[] {
  const inScope = new Set(areas);
  return JOURNEY_MAP_ORDER.filter((area) => inScope.has(area)).map((area) =>
    stageFromAnalysis(area, brand.analyses[area])
  );
}

/** Group stages by lifecycle phase for sectioned rendering. */
export function groupStagesByPhase(
  stages: JourneyMapStage[]
): { phase: (typeof JOURNEY_MAP_PHASES)[number]; stages: JourneyMapStage[] }[] {
  return JOURNEY_MAP_PHASES.map((phase) => ({
    phase,
    stages: stages.filter((s) => s.phase === phase.key),
  })).filter((g) => g.stages.length > 0);
}

/** Count how far the agent got before the first block or gap. */
export function mapProgress(stages: JourneyMapStage[]): {
  walked: number;
  total: number;
  stoppedAt: JourneyMapStage | null;
} {
  const walked = stages.filter((s) => s.status === "walked").length;
  const stoppedAt =
    stages.find((s) => s.status === "blocked" || s.status === "pending") ??
    null;
  return { walked, total: stages.length, stoppedAt };
}
