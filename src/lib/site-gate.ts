export const SITE_GATE_COOKIE = "scuup_site_access";

/** Password visitors must enter. Override with SITE_ACCESS_PASSWORD. */
export function siteAccessPassword(): string {
  return process.env.SITE_ACCESS_PASSWORD?.trim() || "1986";
}

/** Set SITE_GATE_DISABLED=1 to open the site without a password. */
export function siteGateEnabled(): boolean {
  return process.env.SITE_GATE_DISABLED !== "1";
}

/**
 * HttpOnly cookie value after unlock. Not the password itself — derived so
 * changing SITE_ACCESS_PASSWORD invalidates old cookies. Edge-safe (no Node crypto).
 */
export function siteGateCookieValue(): string {
  const s = `scuup-site-gate:${siteAccessPassword()}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `g${(h >>> 0).toString(16).padStart(8, "0")}`;
}

export function isSiteGateUnlocked(
  cookieValue: string | undefined
): boolean {
  if (!siteGateEnabled()) return true;
  return cookieValue === siteGateCookieValue();
}
