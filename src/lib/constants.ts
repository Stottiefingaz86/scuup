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

export const MARKETS = [
  "United Kingdom",
  "Ireland",
  "Ontario, Canada",
  "New Jersey, US",
  "Germany",
  "Netherlands",
  "Nordics",
  "Global / Crypto",
];

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

/** Market → the country the agent's browser should appear from. iGaming
 * sites geo-gate content, offers and payment methods, so auditing from the
 * wrong region skews every score. Sessions route through a residential
 * proxy in this country — the user never needs a VPN. Global/Crypto has no
 * mapping: those brands serve one worldwide experience. */
export const MARKET_PROXY_COUNTRY: Record<string, string> = {
  "United Kingdom": "GB",
  Ireland: "IE",
  "Ontario, Canada": "CA",
  "New Jersey, US": "US",
  Germany: "DE",
  Netherlands: "NL",
  Nordics: "SE",
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
