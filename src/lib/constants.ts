import type { JourneyType } from "./types";

export const ALL_JOURNEYS: JourneyType[] = [
  "signup",
  "deposit",
  "withdraw",
  "casino",
  "sports_betslip",
  "loyalty_rewards",
  "support",
  "my_account",
];

export const JOURNEY_LABELS: Record<JourneyType, string> = {
  signup: "Sign Up",
  deposit: "Deposit",
  withdraw: "Withdraw",
  casino: "Casino Lobby",
  sports_betslip: "Sports Betslip",
  loyalty_rewards: "Loyalty & Rewards",
  support: "Support",
  my_account: "My Account",
};

/** The public first-impression audit every brand gets on project creation. */
export const LANDING = "landing" as const;

/** Journeys the agent can reach autonomously from the public homepage.
 * Mirrors AGENT_PLAYBOOKS in analyst.ts (server-only module). */
export const AGENT_JOURNEYS: JourneyType[] = [
  "signup",
  "casino",
  "sports_betslip",
  "loyalty_rewards",
  "support",
];

/** Journeys the agent can run once the brand has a saved logged-in session
 * (Accounts page). Mirrors LOGIN_PLAYBOOKS in analyst.ts. */
export const LOGIN_AGENT_JOURNEYS: JourneyType[] = [
  "deposit",
  "withdraw",
  "my_account",
];

/** True when the agent can score an area on its own — no login, no human. */
export function agentCanReach(area: string): boolean {
  return (
    area === LANDING || (AGENT_JOURNEYS as string[]).includes(area)
  );
}

/** True when the agent can score an area given a logged-in session. */
export function agentCanReachLoggedIn(area: string): boolean {
  return (
    agentCanReach(area) || (LOGIN_AGENT_JOURNEYS as string[]).includes(area)
  );
}

/** True when an area sits behind a login — its evidence comes from a
 * logged-in session, not the public site. */
export function journeyRequiresLogin(area: string): boolean {
  return (LOGIN_AGENT_JOURNEYS as string[]).includes(area);
}

export const ANALYSIS_AREA_LABELS: Record<string, string> = {
  [LANDING]: "First Impression",
  ...JOURNEY_LABELS,
};

/** Canonical heuristic names per area. The analyst is instructed to use
 * EXACTLY these, so every brand is scored on the same axes and the UI can
 * compare brands heuristic-by-heuristic ("why does Stake score higher"). */
export const JOURNEY_HEURISTICS: Record<string, string[]> = {
  [LANDING]: [
    "Above-the-fold product clarity",
    "Value proposition",
    "CTA hierarchy & decision ease",
    "Trust & compliance cues",
    "Content density & social proof",
    "Search & discovery",
  ],
  signup: [
    "Form effort",
    "Welcome vs loyalty offer clarity",
    "Speed to account",
    "Trust cues at the form",
    "Verification friction",
  ],
  deposit: [
    "Method breadth",
    "Fee & limit transparency",
    "Deposit speed",
    "Cashier UX",
    "Trust & security cues",
  ],
  withdraw: [
    "Withdrawal speed promise",
    "KYC clarity & timing",
    "Fee transparency",
    "Status tracking",
    "Cashier UX",
  ],
  casino: [
    "Search & discovery",
    "Lobby structure",
    "Personalisation & recency",
    "Originals & exclusives",
    "Social proof & energy",
  ],
  sports_betslip: [
    "Betslip speed",
    "Market depth & presentation",
    "Bet builder & tools",
    "Live betting experience",
    "Odds clarity",
  ],
  loyalty_rewards: [
    "Retention model (promo vs loop)",
    "Reward visibility",
    "Earning clarity",
    "Tier ladder & aspiration",
    "Gamification & reward cadence",
  ],
  support: [
    "Chat accessibility",
    "Money-issue help quality",
    "Channel breadth",
    "Response expectations",
    "Self-serve quality",
  ],
  my_account: [
    "Balance & bonus visibility",
    "Verification clarity",
    "Limits & RG tools",
    "Transaction history",
    "Rewards integration",
  ],
};

/** The eight canonical retention loop mechanics — each has explicit evidence
 * requirements (public / login / tracked play). See retention-scoring.ts. */
export {
  RETENTION_MECHANICS,
  RETENTION_MECHANIC_META,
  type RetentionEvidence,
  type RetentionMechanicMeta,
} from "./retention-scoring";

export interface MarketOption {
  label: string;
  /** Legacy emoji — prefer CircleMarketFlag for UI. */
  flag: string;
  /** Browserbase proxy geolocation code: "GB", "US-NJ", "CA-ON".
   * Undefined = session runs without regional routing. */
  geo?: string;
  group: "Europe" | "North America" | "Latin America" | "Asia-Pacific" | "Africa" | "Other";
  popular?: boolean;
  /** Good pick for crypto casinos — most geo-block the UK, US and much of the EU. */
  cryptoFriendly?: boolean;
}

/** ISO code for HatScripts/circle-flags SVGs (geo prefix, with global override). */
export function marketCircleFlagCode(
  market: Pick<MarketOption, "geo" | "label">
): string {
  if (!market.geo) return "xx";
  if (market.label === "Global (US routing)") return "un";
  return market.geo.split("-")[0].toLowerCase();
}

/** Every market a session can browse from, NordVPN-style. Each maps to a
 * residential proxy geolocation so geo-gated offers, payment methods and
 * compliance content match what a real local player sees. */
export const MARKET_OPTIONS: MarketOption[] = [
  // Europe
  { label: "United Kingdom", flag: "🇬🇧", geo: "GB", group: "Europe", popular: true },
  { label: "Ireland", flag: "🇮🇪", geo: "IE", group: "Europe", popular: true },
  { label: "Germany", flag: "🇩🇪", geo: "DE", group: "Europe", popular: true },
  { label: "Netherlands", flag: "🇳🇱", geo: "NL", group: "Europe", popular: true },
  { label: "Sweden", flag: "🇸🇪", geo: "SE", group: "Europe", popular: true },
  { label: "Denmark", flag: "🇩🇰", geo: "DK", group: "Europe" },
  { label: "Finland", flag: "🇫🇮", geo: "FI", group: "Europe", cryptoFriendly: true },
  { label: "Norway", flag: "🇳🇴", geo: "NO", group: "Europe" },
  { label: "Spain", flag: "🇪🇸", geo: "ES", group: "Europe" },
  { label: "Italy", flag: "🇮🇹", geo: "IT", group: "Europe" },
  { label: "France", flag: "🇫🇷", geo: "FR", group: "Europe" },
  { label: "Portugal", flag: "🇵🇹", geo: "PT", group: "Europe" },
  { label: "Belgium", flag: "🇧🇪", geo: "BE", group: "Europe" },
  { label: "Austria", flag: "🇦🇹", geo: "AT", group: "Europe" },
  { label: "Switzerland", flag: "🇨🇭", geo: "CH", group: "Europe" },
  { label: "Poland", flag: "🇵🇱", geo: "PL", group: "Europe" },
  { label: "Czechia", flag: "🇨🇿", geo: "CZ", group: "Europe" },
  { label: "Romania", flag: "🇷🇴", geo: "RO", group: "Europe" },
  { label: "Greece", flag: "🇬🇷", geo: "GR", group: "Europe" },
  { label: "Malta", flag: "🇲🇹", geo: "MT", group: "Europe" },
  // North America — US iGaming is state-licensed; offshore crypto books
  // serve unlicensed states (TX proxy as the "rest of US" baseline).
  { label: "New Jersey, US", flag: "🇺🇸", geo: "US-NJ", group: "North America", popular: true },
  { label: "Pennsylvania, US", flag: "🇺🇸", geo: "US-PA", group: "North America" },
  { label: "Michigan, US", flag: "🇺🇸", geo: "US-MI", group: "North America" },
  { label: "US (rest / offshore)", flag: "🇺🇸", geo: "US-TX", group: "North America", popular: true, cryptoFriendly: true },
  { label: "Ontario, Canada", flag: "🇨🇦", geo: "CA-ON", group: "North America", popular: true },
  { label: "Canada (rest / crypto)", flag: "🇨🇦", geo: "CA-BC", group: "North America", popular: true, cryptoFriendly: true },
  // Latin America
  { label: "Brazil", flag: "🇧🇷", geo: "BR", group: "Latin America", popular: true, cryptoFriendly: true },
  { label: "Mexico", flag: "🇲🇽", geo: "MX", group: "Latin America" },
  { label: "Argentina", flag: "🇦🇷", geo: "AR", group: "Latin America" },
  { label: "Chile", flag: "🇨🇱", geo: "CL", group: "Latin America" },
  { label: "Colombia", flag: "🇨🇴", geo: "CO", group: "Latin America" },
  { label: "Peru", flag: "🇵🇪", geo: "PE", group: "Latin America" },
  // Asia-Pacific
  { label: "Japan", flag: "🇯🇵", geo: "JP", group: "Asia-Pacific", cryptoFriendly: true },
  { label: "India", flag: "🇮🇳", geo: "IN", group: "Asia-Pacific" },
  { label: "New Zealand", flag: "🇳🇿", geo: "NZ", group: "Asia-Pacific", cryptoFriendly: true },
  { label: "Australia", flag: "🇦🇺", geo: "AU", group: "Asia-Pacific" },
  { label: "Philippines", flag: "🇵🇭", geo: "PH", group: "Asia-Pacific" },
  // Africa
  { label: "South Africa", flag: "🇿🇦", geo: "ZA", group: "Africa" },
  { label: "Nigeria", flag: "🇳🇬", geo: "NG", group: "Africa" },
  { label: "Kenya", flag: "🇰🇪", geo: "KE", group: "Africa" },
  // Other — global audits appear from the US, the most common baseline for
  // crypto-first operators, instead of the datacenter's own region.
  { label: "Global (US routing)", flag: "🌐", geo: "US", group: "Other" },
];

export const MARKETS = MARKET_OPTIONS.map((m) => m.label);

/** Default test-account inbox for agent logins. Gmail plus-addresses per
 * brand (stottiefingaz+stake@gmail.com) all land here — one inbox for every
 * site's verification email. */
export const DEFAULT_TEST_EMAIL = "stottiefingaz@gmail.com";

/** Per-brand signup email — same inbox, unique address per operator. */
export function defaultTestEmailForBrand(brandName: string): string {
  const slug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
  if (!slug) return DEFAULT_TEST_EMAIL;
  const at = DEFAULT_TEST_EMAIL.indexOf("@");
  if (at === -1) return DEFAULT_TEST_EMAIL;
  return `${DEFAULT_TEST_EMAIL.slice(0, at)}+${slug}${DEFAULT_TEST_EMAIL.slice(at)}`;
}

/** Market label → proxy geolocation code ("GB", "US-NJ"). iGaming sites
 * geo-gate content, offers and payment methods, so auditing from the wrong
 * region skews every score. Sessions route through a residential proxy in
 * this location — the user never needs a VPN. Includes aliases for market
 * labels stored on older projects. */
export const MARKET_PROXY_COUNTRY: Record<string, string> = {
  ...Object.fromEntries(
    MARKET_OPTIONS.filter((m) => m.geo).map((m) => [m.label, m.geo!])
  ),
  Nordics: "SE",
  // Aliases stored on older projects.
  "Canada (rest)": "CA-BC",
  "Global (no routing)": "US",
  "Global / Crypto": "US",
  Global: "US",
};

export const PRODUCTS = [
  "Casino",
  "Live Casino",
  "Sports",
  "Poker",
  "Bingo",
  "Payments",
  "Rewards",
];

/** Product-specific journeys, hidden unless the matching product is picked.
 * Signup, support, and account apply to every operator and are always offered. */
const JOURNEY_PRODUCT_GATE: Partial<Record<JourneyType, string[]>> = {
  casino: ["Casino", "Live Casino"],
  sports_betslip: ["Sports"],
  loyalty_rewards: ["Rewards"],
  deposit: ["Payments"],
  withdraw: ["Payments"],
};

/** The journeys relevant to a product selection, in canonical order. */
export function journeysForProducts(products: string[]): JourneyType[] {
  return ALL_JOURNEYS.filter((j) => {
    const gate = JOURNEY_PRODUCT_GATE[j];
    return !gate || gate.some((p) => products.includes(p));
  });
}

export function faviconUrl(siteUrl: string, size = 64): string {
  try {
    const host = new URL(
      siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`
    ).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=${size}`;
  } catch {
    return "";
  }
}
