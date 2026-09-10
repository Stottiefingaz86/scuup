/**
 * Client-safe brand ↔ inbox matching. Keep IMAP (server-only) out of this file
 * so the project store can attribute CRM mail without pulling Node deps.
 */

export function brandHost(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function brandRoot(url: string | null | undefined): string {
  const host = brandHost(url);
  const root = host.split(".")[0] ?? "";
  return root.length >= 4 ? root : "";
}

const SENDER_FAMILY: Record<string, string[]> = {
  bovada: ["bovada", "bodog"],
  bodog: ["bodog", "bovada"],
  winna: ["winna"],
  rainbet: ["rainbet"],
  betonline: ["betonline"],
};

/** True when From: is this operator (or its mail / ESP subdomain). */
export function senderLooksLikeBrand(
  from: string,
  brandUrl: string | null | undefined,
): boolean {
  const fromLower = (from ?? "").toLowerCase();
  if (!fromLower) return false;
  const host = brandHost(brandUrl);
  if (
    host &&
    (fromLower.endsWith(`@${host}`) ||
      fromLower.endsWith(`.${host}`) ||
      fromLower.includes(`@${host}`) ||
      fromLower.includes(`.${host}`))
  ) {
    return true;
  }
  const root = brandRoot(brandUrl);
  if (root && fromLower.includes(root)) return true;
  const extra = SENDER_FAMILY[root];
  return Boolean(extra?.some((tok) => fromLower.includes(tok)));
}

/** Subject/body names the brand — used when To: is the shared inbox without +tag. */
export function bodyLooksLikeBrand(
  hay: string,
  brand: { name: string; url: string },
): boolean {
  const text = hay.toLowerCase();
  const name = brand.name.trim().toLowerCase();
  if (name.length >= 4 && new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(text)) {
    return true;
  }
  const root = brandRoot(brand.url);
  return Boolean(root && new RegExp(`\\b${escapeRegExp(root)}\\b`, "i").test(text));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
