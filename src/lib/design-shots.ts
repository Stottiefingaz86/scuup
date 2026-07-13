import { LANDING } from "./constants";
import type { Brand, JourneyAnalysis } from "./types";

/** Product surfaces first — login/cashier last. Design is judged on what
 * players browse, not auth walls masquerading as casino. */
export const DESIGN_REVIEW_AREA_ORDER = [
  LANDING,
  "casino",
  "sports_betslip",
  "loyalty_rewards",
  "signup",
  "deposit",
  "withdraw",
  "my_account",
  "support",
] as const;

const PRODUCT_AREAS = new Set([
  "casino",
  "sports_betslip",
  "loyalty_rewards",
  "deposit",
  "withdraw",
  "my_account",
]);

const LOGIN_URL =
  /\/(login|log-?in|sign-?in|auth|authenticate|members\/login)\b/i;

function observationText(o: string | { text: string }): string {
  return typeof o === "string" ? o : o.text;
}

/** True when the captured visit never reached the product surface — only a
 * login/sign-in wall (common when logged-out agents hit gated lobbies). */
export function isLoginGateAnalysis(analysis: JourneyAnalysis): boolean {
  if (analysis.area === "signup") return false;
  const url = analysis.finalUrl ?? "";
  if (LOGIN_URL.test(url)) return true;
  if (!PRODUCT_AREAS.has(analysis.area)) return false;
  const prose = [
    analysis.summary,
    ...analysis.observations.slice(0, 3).map(observationText),
  ]
    .join(" ")
    .toLowerCase();
  return /\b(log\s*in|sign\s*in|member login|enter your (email|password))\b/.test(
    prose
  );
}

/** Pick the frame that best represents design for this journey — not the
 * first login redirect when the agent never reached the lobby. */
export function pickDesignScreenshot(
  area: string,
  analysis: JourneyAnalysis
): string | undefined {
  const shots = analysis.screenshots ?? [];
  if (shots.length === 0) return undefined;

  if (area === LANDING || area === "signup") {
    return shots[0];
  }

  if (isLoginGateAnalysis(analysis)) {
    if (shots.length > 1) return shots[shots.length - 1];
    return undefined;
  }

  if (shots.length === 1) return shots[0];
  return shots[shots.length - 1];
}

export interface DesignReviewShot {
  area: string;
  screenshot: string;
}

/** Canonical set of journey screens sent to the design reviewer. */
export function collectDesignReviewShots(brand: Brand): DesignReviewShot[] {
  const out: DesignReviewShot[] = [];
  for (const area of DESIGN_REVIEW_AREA_ORDER) {
    const analysis = brand.analyses[area];
    if (!analysis || analysis.blocked) continue;
    const screenshot = pickDesignScreenshot(area, analysis);
    if (!screenshot) continue;
    out.push({ area, screenshot });
    if (out.length >= 7) break;
  }
  return out;
}

export function alignJourneyNotes(
  shots: DesignReviewShot[],
  notes: { area: string; note: string }[],
  labels: Record<string, string>
): { area: string; note: string }[] {
  const byKey = new Map<string, string>();
  for (const n of notes) {
    byKey.set(n.area.toLowerCase(), n.note);
    const key = Object.entries(labels).find(
      ([, label]) => label.toLowerCase() === n.area.toLowerCase()
    )?.[0];
    if (key) byKey.set(key, n.note);
  }
  return shots
    .map((s, i) => ({
      area: s.area,
      note:
        notes[i]?.note ??
        byKey.get(s.area) ??
        byKey.get((labels[s.area] ?? s.area).toLowerCase()) ??
        "",
    }))
    .filter((n) => n.note.trim().length > 0);
}
