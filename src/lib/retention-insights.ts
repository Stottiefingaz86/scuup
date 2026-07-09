import type {
  Brand,
  JourneyAnalysis,
  RetentionMechanicNote,
} from "./types";
import {
  applyRetentionGates,
  canAdviseOnMechanic,
  fillGatedRetentionNotes,
  RETENTION_MECHANIC_META,
  type RetentionEvidence,
} from "./retention-scoring";

export interface MechanicInsight {
  key: string;
  label: string;
  requires: RetentionEvidence;
  ownScore: number | null;
  bestCompetitor: { name: string; score: number } | null;
  /** Negative = you trail the best competitor. */
  gap: number | null;
  note: string;
  improve: string;
  competitorNote: string | null;
  shot: number | null;
  screenshotUrl: string | null;
  /** False when login/tracked-play evidence is missing — no product advice yet. */
  canAdvise: boolean;
}

function retentionContext(analysis: JourneyAnalysis | null) {
  return (
    analysis?.retentionContext ?? { loggedIn: false, fromSession: false }
  );
}

function gatedScore(
  analysis: JourneyAnalysis | null,
  key: string
): number | null {
  if (!analysis?.retention) return null;
  const gated = applyRetentionGates(
    analysis.retention,
    retentionContext(analysis)
  );
  const v = gated?.[key];
  return v === undefined ? null : v;
}

function notesForAnalysis(
  analysis: JourneyAnalysis | null
): RetentionMechanicNote[] {
  if (!analysis) return [];
  const ctx = retentionContext(analysis);
  const gated = applyRetentionGates(analysis.retention, ctx);
  return fillGatedRetentionNotes(gated, ctx, analysis.retentionNotes ?? []);
}

function noteFor(
  analysis: JourneyAnalysis | null,
  key: string
): RetentionMechanicNote | undefined {
  return notesForAnalysis(analysis).find((n) => n.key === key);
}

function firstShot(analysis: JourneyAnalysis): number | null {
  for (const o of analysis.observations) {
    if (typeof o !== "string" && o.shot !== null) return o.shot;
  }
  return null;
}

function fallbackNote(
  analysis: JourneyAnalysis | null,
  key: string,
  score: number | null
): RetentionMechanicNote {
  if (!analysis) {
    return {
      key,
      note: "No loyalty analysis yet.",
      shot: null,
      improve: "Run the agent on the loyalty hub.",
    };
  }
  const text = [
    analysis.summary,
    ...analysis.heuristics.map((h) => `${h.name}: ${h.note}`),
    ...analysis.observations.map((o) =>
      typeof o === "string" ? o : o.text
    ),
  ].join(" ");
  const excerpt =
    text.length > 220 ? `${text.slice(0, 217).trim()}…` : text;
  return {
    key,
    note:
      score !== null
        ? excerpt ||
          "Score from loyalty visit — re-run the agent for per-mechanic evidence notes."
        : "Not scored on this visit.",
    shot: firstShot(analysis),
    improve:
      score !== null
        ? "Re-run the loyalty agent to refresh evidence-backed improvement notes."
        : "Launch a logged-in or tracked session to score this mechanic.",
  };
}

/** Build per-mechanic insights for the own brand vs competitors. */
export function buildMechanicInsights(
  ownBrand: Brand,
  competitors: Brand[],
  loyaltyOf: (brand: Brand) => JourneyAnalysis | null
): MechanicInsight[] {
  const ownAnalysis = loyaltyOf(ownBrand);

  return RETENTION_MECHANIC_META.map((meta) => {
    const ownScore = gatedScore(ownAnalysis, meta.key);
    const compScores = competitors
      .map((c) => ({
        brand: c,
        name: c.name,
        score: gatedScore(loyaltyOf(c), meta.key),
      }))
      .filter((c): c is typeof c & { score: number } => c.score !== null);
    const best = compScores.sort((a, b) => b.score - a.score)[0] ?? null;
    const gap =
      ownScore !== null && best ? ownScore - best.score : null;

    const stored = noteFor(ownAnalysis, meta.key);
    const ctx = retentionContext(ownAnalysis);
    const canAdvise =
      ownScore !== null && canAdviseOnMechanic(meta.key, ctx);
    const detail =
      stored ?? fallbackNote(ownAnalysis, meta.key, ownScore);
    const competitorDetail = best
      ? noteFor(loyaltyOf(best.brand), meta.key)
      : undefined;
    const shot = detail.shot;
    const screenshotUrl =
      shot !== null && ownAnalysis?.screenshots?.[shot]
        ? ownAnalysis.screenshots[shot]!
        : null;

    return {
      key: meta.key,
      label: meta.label,
      requires: meta.requires,
      ownScore,
      bestCompetitor: best
        ? { name: best.name, score: best.score }
        : null,
      gap,
      note: detail.note,
      improve: detail.improve,
      competitorNote: competitorDetail?.note ?? null,
      shot,
      screenshotUrl,
      canAdvise,
    };
  }).sort((a, b) => {
    const gapA = a.gap ?? 999;
    const gapB = b.gap ?? 999;
    if (gapA !== gapB) return gapA - gapB;
    if (a.canAdvise !== b.canAdvise) return a.canAdvise ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}
