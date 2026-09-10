export const SITE_GATE_COOKIE = "scuup_site_access";

/** 4-digit PIN for scuup.io. Override with SITE_PIN (or a 4-digit SITE_ACCESS_PASSWORD). */
export function siteAccessPassword(): string {
  const pin = process.env.SITE_PIN?.trim();
  if (pin && /^\d{4}$/.test(pin)) return pin;
  const legacy = process.env.SITE_ACCESS_PASSWORD?.trim();
  if (legacy && /^\d{4}$/.test(legacy)) return legacy;
  return "1986";
}

/** Production is always PIN-gated. Locally, SITE_GATE_DISABLED=1 opens the site. */
export function siteGateEnabled(): boolean {
  const prod =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";
  if (prod) return true;
  return process.env.SITE_GATE_DISABLED !== "1";
}

/**
 * HttpOnly cookie value after unlock. Not the PIN itself — derived so
 * changing the PIN invalidates old cookies. Edge-safe (no Node crypto).
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
