/** Curated brand → market access from licensing policy and live audit
 * results. Overrides LLM guesses for well-known operators. */

const EU_REGULATED_BLOCKED = [
  "United Kingdom",
  "Germany",
  "Netherlands",
  "France",
  "Spain",
  "Italy",
  "Sweden",
  "Denmark",
  "Belgium",
  "Austria",
  "Switzerland",
  "Poland",
  "Czechia",
  "Romania",
  "Greece",
  "Portugal",
  "Ireland",
];

const US_LICENSED = [
  "New Jersey, US",
  "Pennsylvania, US",
  "Michigan, US",
];

/** Every US-routed market — crypto offshore sites block the whole country. */
const US_ALL = [
  ...US_LICENSED,
  "US (rest / offshore)",
  "Global (US routing)",
];

interface CuratedBrandMarkets {
  hosts: string[];
  blocked: string[];
  available: string[];
  /** Markets the brand serves from a different licensed domain — the audit
   * must visit that domain or the main site geo-blocks the proxy IP. */
  marketUrls?: Record<string, string>;
}

/** Ground-truth market lists for brands we audit often. */
export const CURATED_BRAND_MARKETS: CuratedBrandMarkets[] = [
  {
    // Stake geo-blocks Canada entirely (not just Ontario) — confirmed in
    // live audits routing via CA-BC.
    hosts: ["stake.com", "stake.bet"],
    blocked: [
      ...EU_REGULATED_BLOCKED,
      ...US_ALL,
      "Ontario, Canada",
      "Canada (rest / crypto)",
      "Australia",
    ],
    available: [
      "Finland",
      "Norway",
      "Brazil",
      "Mexico",
      "Argentina",
      "Chile",
      "Japan",
      "New Zealand",
      "Philippines",
      "South Africa",
    ],
    // stake.com geo-blocks these countries and points players at the
    // locally licensed domains instead.
    marketUrls: {
      Mexico: "https://stake.mx",
      Brazil: "https://stake.bet.br",
    },
  },
  {
    hosts: ["rainbet.com", "roobet.com", "rollbit.com"],
    blocked: [
      ...EU_REGULATED_BLOCKED,
      ...US_ALL,
      "Ontario, Canada",
      "Canada (rest / crypto)",
      "Australia",
    ],
    available: [
      "Finland",
      "Norway",
      "Brazil",
      "Japan",
      "New Zealand",
      "Mexico",
      "Argentina",
    ],
  },
  {
    // Winna-class crypto — same geo pattern as Rainbet; Canada often works.
    hosts: ["winna.com", "winna.io", "winna.bet"],
    blocked: [...EU_REGULATED_BLOCKED, ...US_ALL, "Ontario, Canada", "Australia"],
    available: [
      "Canada (rest / crypto)",
      "Finland",
      "Norway",
      "Brazil",
      "Japan",
      "New Zealand",
      "Mexico",
    ],
  },
  {
    // US offshore books — the inverse: they serve unlicensed US states, not EU.
    hosts: [
      "betonline.ag",
      "bovada.lv",
      "mybookie.ag",
      "betwhale.ag",
      "sportsbetting.ag",
    ],
    blocked: [...EU_REGULATED_BLOCKED, "Ontario, Canada"],
    available: [
      "US (rest / offshore)",
      "Canada (rest / crypto)",
      "Brazil",
      "Mexico",
    ],
  },
  {
    hosts: ["bet365.com", "bet365.eu"],
    blocked: ["Netherlands", "Switzerland", "Global (US routing)"],
    available: [
      "United Kingdom",
      "Ireland",
      "Germany",
      "Sweden",
      "Denmark",
      "Finland",
      "Spain",
      "Italy",
      "France",
      "New Jersey, US",
      "Ontario, Canada",
      "Canada (rest / crypto)",
      "Australia",
      "Brazil",
      "India",
    ],
  },
];

export function normalizeBrandHost(urlOrHost: string): string {
  try {
    const host = urlOrHost.includes("://")
      ? new URL(urlOrHost).hostname
      : urlOrHost;
    return host.replace(/^www\./, "").toLowerCase();
  } catch {
    return urlOrHost.replace(/^www\./, "").toLowerCase();
  }
}

function hostMatches(host: string, pattern: string): boolean {
  const h = normalizeBrandHost(host);
  const p = pattern.toLowerCase();
  return h === p || h.endsWith("." + p);
}

/** Curated lists for a hostname, or null when this brand isn't in the table. */
export function curatedAvailability(
  host: string,
  allMarkets: string[]
): { blocked: string[]; available: string[] } | null {
  const rule = CURATED_BRAND_MARKETS.find((r) =>
    r.hosts.some((h) => hostMatches(host, h))
  );
  if (!rule) return null;
  const valid = new Set(allMarkets);
  return {
    blocked: rule.blocked.filter((m) => valid.has(m)),
    available: rule.available.filter((m) => valid.has(m)),
  };
}

/** The URL the audit should visit for a brand in a market — the locally
 * licensed domain when one exists (e.g. stake.mx for Mexico), otherwise the
 * brand's own URL. */
export function auditUrlForMarket(url: string, market: string): string {
  const rule = CURATED_BRAND_MARKETS.find((r) =>
    r.hosts.some((h) => hostMatches(url, h))
  );
  return rule?.marketUrls?.[market] ?? url;
}

/** Curated rules win on conflict — they reflect live audit ground truth. */
export function mergeAvailability(
  curated: { blocked: string[]; available: string[] } | null,
  llm: { blocked: string[]; available: string[] }
): { blocked: string[]; available: string[] } {
  if (!curated) return llm;

  const blocked = new Set([...curated.blocked, ...llm.blocked]);
  for (const m of curated.available) blocked.delete(m);
  for (const m of curated.blocked) blocked.add(m);

  const available = new Set<string>();
  for (const m of curated.available) {
    if (!blocked.has(m)) available.add(m);
  }
  for (const m of llm.available) {
    if (!blocked.has(m)) available.add(m);
  }
  for (const m of blocked) available.delete(m);

  return { blocked: [...blocked], available: [...available] };
}
