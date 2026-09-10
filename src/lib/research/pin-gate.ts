/**
 * PIN gate for the Research product (research.scuup.io). Separate from the
 * site password: a short 4-digit code on a 30-day HttpOnly cookie.
 * Edge-safe (no Node crypto) — this runs in the proxy.
 */
export const RESEARCH_PIN_COOKIE = "scuup_research_pin";

/** Code visitors must enter. Override with RESEARCH_PIN. */
export function researchPin(): string {
  return process.env.RESEARCH_PIN?.trim() || "1966";
}

/** Set RESEARCH_PIN_DISABLED=1 to open Research without a code. */
export function researchPinEnabled(): boolean {
  return process.env.RESEARCH_PIN_DISABLED !== "1";
}

/** Cookie value after unlock — derived, so changing the PIN logs everyone out. */
export function researchPinCookieValue(): string {
  const s = `scuup-research-pin:${researchPin()}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `r${(h >>> 0).toString(16).padStart(8, "0")}`;
}

export function isResearchPinUnlocked(
  cookieValue: string | undefined,
): boolean {
  if (!researchPinEnabled()) return true;
  return cookieValue === researchPinCookieValue();
}

/** Path of the PIN screen inside the app (research host shows it as /pin). */
export const RESEARCH_PIN_PATH = "/research/pin";
