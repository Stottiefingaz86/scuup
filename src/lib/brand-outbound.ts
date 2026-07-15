/** Outbound brand URLs for showcase cards — swap in affiliate tracking links per slug. */
const AFFILIATE_URL_BY_SLUG: Record<string, string> = {
  // Example: stake: "https://stake.com/?c=scuup",
  // Add full tracking URLs here as rev-share deals are signed.
};

function normalizeBrandUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "https://";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Public URL for "View site" on showcase cards.
 * Uses a per-brand affiliate link when configured; otherwise the brand homepage.
 * Set NEXT_PUBLIC_SHOWCASE_AFFILIATE_SUBID to append ?subId=… (or &subId=…) on fallbacks.
 */
export function brandSiteOutboundUrl(
  brandUrl: string,
  brandSlug: string
): string {
  const slug = brandSlug.toLowerCase();
  const affiliate = AFFILIATE_URL_BY_SLUG[slug];
  if (affiliate) return affiliate;

  const base = normalizeBrandUrl(brandUrl);
  const subId = process.env.NEXT_PUBLIC_SHOWCASE_AFFILIATE_SUBID?.trim();
  if (!subId) return base;

  const param = `subId=${encodeURIComponent(subId)}`;
  return base.includes("?") ? `${base}&${param}` : `${base}?${param}`;
}
