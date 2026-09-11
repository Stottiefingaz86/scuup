/**
 * Client-safe brand ↔ inbox matching. Keep IMAP (server-only) out of this file
 * so the project store can attribute CRM mail without pulling Node deps.
 */

/** ESP / mailbox labels — never treat these as a brand slug in From: search. */
const GENERIC_MAIL_ROOTS = new Set([
  "email",
  "mail",
  "info",
  "news",
  "support",
  "noreply",
  "hello",
  "notify",
  "crm",
  "go",
  "updates",
  "promo",
]);

export function isGenericMailRoot(root: string): boolean {
  return GENERIC_MAIL_ROOTS.has(root.toLowerCase());
}

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
  stake: ["stake"],
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
  if (
    name.length >= 4 &&
    new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(text)
  ) {
    return true;
  }
  const root = brandRoot(brand.url);
  return Boolean(
    root && new RegExp(`\\b${escapeRegExp(root)}\\b`, "i").test(text),
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `winna` from `scuup678+rswinnaet2hl09@gmail.com` (+rs + slug + 7-char nonce). */
export function brandNameSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 10);
}

function plusRsTags(hay: string): string[] {
  return [...hay.toLowerCase().matchAll(/\+rs([a-z0-9]+)(?:@|$)/g)].map(
    (m) => m[1],
  );
}

function slugsFromAliases(aliases: string[]): string[] {
  return plusRsTags(aliases.join(" ")).map((tag) =>
    tag.length > 7 ? tag.slice(0, -7) : tag,
  );
}

export function brandWatchSlugs(brand: {
  name: string;
  url?: string | null;
  accountEmail?: string | null;
}): string[] {
  const slugs = new Set<string>();
  const name = brandNameSlug(brand.name);
  if (name.length >= 3) slugs.add(name);
  const root = brandRoot(brand.url);
  if (root.length >= 3) slugs.add(root);
  for (const tag of plusRsTags(brand.accountEmail ?? "")) {
    slugs.add(tag.length > 7 ? tag.slice(0, -7) : tag);
  }
  return [...slugs];
}

/** Same brand, different nonce — `+rswinnacajwudz` still belongs to Winna. */
export function plusTagMatchesBrand(hay: string, brandName: string): boolean {
  const slug = brandNameSlug(brandName);
  if (slug.length < 3) return false;
  return new RegExp(`\\+rs${escapeRegExp(slug)}[a-z0-9]*(?:@|$)`, "i").test(
    hay,
  );
}

export function plusTagMatchesProjectBrand(
  hay: string,
  brand: { name: string; url?: string | null; accountEmail?: string | null },
): boolean {
  const slugs = brandWatchSlugs(brand);
  return plusRsTags(hay).some((tag) => slugs.some((s) => tag.startsWith(s)));
}

export function plusTagMatchesWatchedBrand(
  to: string,
  aliases: string[],
  extraSlugs: string[] = [],
): boolean {
  const slugs = [...slugsFromAliases(aliases), ...extraSlugs];
  if (!slugs.length) return false;
  return plusRsTags(to).some((tag) => slugs.some((s) => tag.startsWith(s)));
}

/** +rs tag for a brand we are not watching (sibling teardown). */
export function isForeignResearchAlias(
  to: string,
  aliases: string[],
  extraSlugs: string[] = [],
): boolean {
  const tags = plusRsTags(to);
  if (!tags.length) return false;
  const slugs = [...slugsFromAliases(aliases), ...extraSlugs];
  if (!slugs.length) return false;
  return tags.every((tag) => !slugs.some((s) => tag.startsWith(s)));
}
