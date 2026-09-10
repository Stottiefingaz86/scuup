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

const US_LICENSED = ["New Jersey, US", "Pennsylvania, US", "Michigan, US"];

/** Every US-routed market — crypto offshore sites block the whole country. */
const US_ALL = [...US_LICENSED, "US (rest / offshore)", "Global (US routing)"];

interface CuratedBrandMarkets {
  hosts: string[];
  blocked: string[];
  available: string[];
  /** Markets the brand serves from a different licensed domain — the audit
   * must visit that domain or the main site geo-blocks the proxy IP. */
  marketUrls?: Record<string, string>;
  /** When set, Browserbase always egresses from this market — even if the
   * project market is listed as available. Used when a market works for
   * marketing copy but the residential tunnel fails (e.g. BetOnline + BR). */
  preferredProxyMarket?: string;
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
      "Australia",
    ],
    available: [
      "Canada",
      "Finland",
      "Norway",
      "Brazil",
      "Japan",
      "New Zealand",
      "Mexico",
      "Argentina",
    ],
    preferredProxyMarket: "Canada",
  },
  {
    // Winna-class crypto — same geo pattern as Rainbet; Canada often works.
    hosts: ["winna.com", "winna.io", "winna.bet"],
    blocked: [
      ...EU_REGULATED_BLOCKED,
      ...US_ALL,
      "Ontario, Canada",
      "Australia",
    ],
    available: [
      "Canada",
      "Canada (rest / crypto)",
      "Finland",
      "Norway",
      "Brazil",
      "Japan",
      "New Zealand",
      "Mexico",
    ],
    preferredProxyMarket: "Canada",
  },
  {
    // Bovada is US-offshore only (Bodog is the Canada / LatAm sister).
    // Canada hard-blocks Register. Licensed US states are also blocked.
    // Texas ("US rest / offshore") is not on Bovada's restricted list.
    hosts: ["bovada.lv", "bovada.com"],
    blocked: [
      ...EU_REGULATED_BLOCKED,
      ...US_LICENSED,
      "Ontario, Canada",
      "Canada",
      "Canada (rest / crypto)",
      "Brazil",
      "Mexico",
      "Australia",
    ],
    available: ["US (rest / offshore)"],
    preferredProxyMarket: "US (rest / offshore)",
  },
  {
    // US offshore books — the inverse: they serve unlicensed US states, not EU.
    // Brazil is listed as available but Browserbase BR tunnels often fail on
    // api.betonline.ag (ERR_TUNNEL_CONNECTION_FAILED) — pin CA instead.
    hosts: ["betonline.ag", "mybookie.ag", "betwhale.ag", "sportsbetting.ag"],
    blocked: [...EU_REGULATED_BLOCKED, "Ontario, Canada"],
    available: [
      "US (rest / offshore)",
      "Canada (rest / crypto)",
      "Brazil",
      "Mexico",
    ],
    preferredProxyMarket: "Canada (rest / crypto)",
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
  allMarkets: string[],
): { blocked: string[]; available: string[] } | null {
  const rule = CURATED_BRAND_MARKETS.find((r) =>
    r.hosts.some((h) => hostMatches(host, h)),
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
    r.hosts.some((h) => hostMatches(url, h)),
  );
  return rule?.marketUrls?.[market] ?? url;
}

/** Market label used for Browserbase residential geo. Falls back to the
 * project market unless the brand pins a preferred proxy (US offshore → CA).
 * If the project market is blocked for this brand, use an available market
 * instead — wrong-geo IPs often fail Cloudflare Turnstile. */
export function proxyMarketForBrand(
  url: string,
  projectMarket: string,
): string {
  const rule = CURATED_BRAND_MARKETS.find((r) =>
    r.hosts.some((h) => hostMatches(url, h)),
  );
  if (!rule) return projectMarket;
  if (rule.preferredProxyMarket) return rule.preferredProxyMarket;
  if (
    rule.blocked?.includes(projectMarket) &&
    rule.available?.length
  ) {
    return rule.available[0]!;
  }
  return projectMarket;
}

/** Tie-break order when several markets work for the whole brand set. */
const AUTO_MARKET_PREFERENCE = [
  "Canada (rest / crypto)",
  "Finland",
  "Brazil",
  "Mexico",
  "US (rest / offshore)",
  "New Zealand",
  "Japan",
];

/**
 * Pick the project-level routing market automatically. Curated brands pin
 * their own proxy via `preferredProxyMarket`; this only has to be a sane
 * default for brands we haven't catalogued — so choose the market the most
 * known brands in the set accept, then the preference order above.
 */
export function autoMarketForBrands(urls: string[]): string {
  const score = new Map<string, number>();
  for (const url of urls) {
    const rule = CURATED_BRAND_MARKETS.find((r) =>
      r.hosts.some((h) => hostMatches(url, h)),
    );
    if (!rule) continue;
    for (const m of rule.available) score.set(m, (score.get(m) ?? 0) + 1);
    for (const m of rule.blocked) score.set(m, (score.get(m) ?? 0) - 2);
  }
  let best = AUTO_MARKET_PREFERENCE[0]!;
  let bestScore = -Infinity;
  for (const m of AUTO_MARKET_PREFERENCE) {
    const s = score.get(m) ?? 0;
    if (s > bestScore) {
      best = m;
      bestScore = s;
    }
  }
  return best;
}

/** Markets we know this brand serves (curated), or [] when unknown. */
export function knownServedMarkets(url: string): string[] {
  const rule = CURATED_BRAND_MARKETS.find((r) =>
    r.hosts.some((h) => hostMatches(url, h)),
  );
  return rule?.available ?? [];
}

/**
 * Geo-wall copy operators show when the visitor's IP is outside their
 * licence. Tight phrasing — "restricted" alone matches T&Cs on every site.
 */
const GEO_BLOCK_RE =
  /(not|isn'?t|is not|aren'?t|are not)\s+(currently\s+)?(available|accessible|offered|permitted|allowed)\s+(in|from|to)\s+your\s+(country|region|jurisdiction|location|state|area|territory)|(unavailable|restricted|prohibited|blocked)\s+in\s+your\s+(country|region|jurisdiction|location|state|area|territory)|access\s+(is\s+)?(denied|restricted|blocked)\s+(from|in|based on)\s+your\s+(country|region|location|jurisdiction)|(due to|because of)\s+your\s+(current\s+)?(location|country|region|jurisdiction)|residents?\s+of\s+your\s+(country|region|jurisdiction)\s+(are|is)\s+not|we\s+(do\s+not|don'?t)\s+(accept|serve)\s+(players|customers|users|visitors)\s+from\s+your|(this\s+)?(site|service|website|content)\s+is\s+(geo[- ]?)?(restricted|blocked)|vpn\s+or\s+proxy\s+detected|geo[- ]?(restriction|blocked|block)/i;

export function looksGeoBlocked(pageText: string): boolean {
  return GEO_BLOCK_RE.test(pageText.replace(/\s+/g, " ").slice(0, 15000));
}

/** Curated rules win on conflict — they reflect live audit ground truth. */
export function mergeAvailability(
  curated: { blocked: string[]; available: string[] } | null,
  llm: { blocked: string[]; available: string[] },
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
