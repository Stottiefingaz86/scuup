import type {
  FrictionSeverity,
  FrictionType,
  JourneyStageResult,
  TopFriction,
} from "./types";
import { okrWhyLine } from "./okrs";

const SEVERITY_WEIGHT: Record<FrictionSeverity, number> = {
  critical: 100,
  high: 60,
  medium: 30,
  low: 10,
};

/** Score friction by measured effort + wait + severity + OKR stage weight.
 * Deposit → first bet path is weighted highest (Time to stake OKR). */
export function scoreStageFriction(stage: JourneyStageResult): number {
  if (!stage.friction || stage.evidence === "Skipped") return 0;
  const severity = stage.severity ?? "medium";
  const time = stage.timeSec ?? 0;
  const wait = stage.waitSec ?? 0;
  const steps = stage.steps ?? 0;
  const fields = stage.fieldCount ?? 0;
  const business =
    stage.stageId === "deposit" ||
    stage.stageId === "deposit_confirmation" ||
    stage.stageId === "first_bet"
      ? 1.6
      : stage.stageId === "verification" || stage.stageId === "registration"
        ? 1.35
        : stage.stageId === "game_select" || stage.stageId === "lobby"
          ? 1.2
          : stage.stageId === "days_1_14"
            ? 1.15
            : 1;
  return (
    (SEVERITY_WEIGHT[severity] +
      Math.min(time, 180) * 0.35 +
      Math.min(wait, 120) * 0.5 +
      steps * 4 +
      fields * 3) *
    business
  );
}

export function pickTopFriction(stages: JourneyStageResult[]): TopFriction[] {
  const ranked = stages
    .filter((s) => s.friction && s.evidence !== "Skipped")
    .map((s) => ({ stage: s, score: scoreStageFriction(s) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return ranked.map((r, i) => ({
    rank: (i + 1) as 1 | 2 | 3,
    friction: r.stage.friction ?? "",
    evidence:
      r.stage.evidence ||
      `${r.stage.label}: ${r.stage.timeSec ?? 0}s, ${r.stage.steps ?? 0} clicks` +
        (r.stage.waitSec ? `, ${r.stage.waitSec}s wait` : ""),
    impact: r.stage.userImpact || defaultImpact(r.stage),
    whyItMatters: whyItMatters(r.stage),
  }));
}

function defaultImpact(stage: JourneyStageResult): string {
  if (stage.severity === "critical") {
    return "May stop the player completing this stage — blocks funded play";
  }
  if ((stage.waitSec ?? 0) >= 20) {
    return "Adds idle wait on the path to first stake";
  }
  if ((stage.fieldCount ?? 0) >= 6 || (stage.steps ?? 0) >= 6) {
    return "Raises effort and drop-off before money is in play";
  }
  return "Adds friction on the path to first casino stake";
}

function whyItMatters(stage: JourneyStageResult): string {
  const parts: string[] = [okrWhyLine(stage.stageId)];
  if (stage.severity) parts.push(`${stage.severity} severity`);
  if (stage.timeSec != null) parts.push(`${stage.timeSec}s stage time`);
  if (stage.waitSec) parts.push(`${stage.waitSec}s wait`);
  if (stage.steps) parts.push(`${stage.steps} actions`);
  if (stage.fieldCount) parts.push(`${stage.fieldCount} fields`);
  return parts.join(" · ");
}

export function normalizeFrictionType(
  raw: string | null | undefined
): FrictionType | null {
  if (!raw) return null;
  const t = raw.toLowerCase().replace(/\s+/g, "_");
  const allowed: FrictionType[] = [
    "remove",
    "simplify",
    "automate",
    "clarify",
    "reassure",
    "speed_up",
    "personalise",
  ];
  return allowed.includes(t as FrictionType) ? (t as FrictionType) : null;
}

export const FRICTION_TYPE_HELP: Record<FrictionType, string> = {
  remove: "Drop an unnecessary step or field",
  simplify: "Reduce complexity without removing the outcome",
  automate: "System should do this for the player",
  clarify: "Copy, labels, or wayfinding need to be clearer",
  reassure: "Trust / safety messaging missing",
  speed_up: "Load or wait time is the issue",
  personalise: "Should adapt to returning or known players",
};
