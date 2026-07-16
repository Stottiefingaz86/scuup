import type { JourneyAnalysis } from "./types";

/**
 * Score guardrail for report re-runs.
 *
 * A monthly subscriber's report is re-scored by a vision model, which has
 * natural run-to-run noise. Trust dies the moment a score jumps 15 points
 * when the casino didn't change — so the previous run acts as an anchor:
 *
 * - Moves within the dead band are treated as model noise and the previous
 *   score is kept (the prose, evidence and features still refresh).
 * - Moves beyond the max step are capped; a genuine sustained change still
 *   gets there over runs, one step at a time, instead of whiplashing.
 *
 * Heuristic scores are shifted together with the overall so "overall =
 * average of the checks" stays true and auditable. The model's unanchored
 * number is kept in rawScore for the record.
 */

/** Score moves this small are indistinguishable from model noise. */
const DEAD_BAND = 3;
/** The most a published score may move in one re-run. */
const MAX_STEP = 10;

function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function applyScoreGuardrail(
  next: JourneyAnalysis,
  prev: JourneyAnalysis | null | undefined
): JourneyAnalysis {
  // First runs and capture failures publish as-is: a blocked run scores 0
  // by convention and must never be smoothed into a real-looking number.
  if (!prev || prev.blocked || next.blocked) return next;
  if (!next.heuristics.length) return next;

  const raw = next.score;
  const delta = raw - prev.score;

  let published = raw;
  if (Math.abs(delta) <= DEAD_BAND) {
    published = prev.score;
  } else if (Math.abs(delta) > MAX_STEP) {
    published = prev.score + Math.sign(delta) * MAX_STEP;
  }
  if (published === raw) return next;

  const shift = published - raw;
  const heuristics = next.heuristics.map((h) => ({
    ...h,
    score: clamp01to100(h.score + shift),
  }));
  // Recompute from the shifted checks so the published overall is exactly
  // their average — the number stays auditable, never hand-set.
  const score = clamp01to100(
    heuristics.reduce((s, h) => s + h.score, 0) / heuristics.length
  );

  return { ...next, score, heuristics, rawScore: raw };
}
