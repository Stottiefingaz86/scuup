import { LANDING } from "./constants";
import type {
  ActionPlan,
  Brand,
  JourneyAnalysis,
  Project,
} from "./types";

/** Generic demo data for the marketing page — no operator names. */

function analysis(
  area: string,
  score: number,
  heuristics: { name: string; score: number; note: string }[] = []
): JourneyAnalysis {
  return {
    area,
    analysedAt: "2026-01-01T00:00:00.000Z",
    score,
    blocked: false,
    blockReason: null,
    summary: "",
    heuristics,
    observations: [],
    features: [],
    finalUrl: "",
  };
}

export const DEMO_PROJECT_ID = "demo-preview";

export const DEMO_SITES: Brand[] = [
  {
    id: "demo-own",
    name: "You",
    url: "https://yoursite.com",
    favicon: "",
    role: "own_brand",
    analyses: {
      [LANDING]: analysis(LANDING, 62, [
        { name: "Above-the-fold product clarity", score: 58, note: "Welcome promo dominates; casino product buried below fold." },
        { name: "Value proposition", score: 55, note: "Deposit match headline; ongoing player value not explained." },
        { name: "CTA hierarchy & decision ease", score: 64, note: "Join and login compete; no single primary path." },
      ]),
      signup: analysis("signup", 54),
      casino: analysis("casino", 61),
      loyalty_rewards: analysis("loyalty_rewards", 48),
    },
  },
  {
    id: "demo-leader",
    name: "Leader",
    url: "https://leader.example",
    favicon: "",
    role: "competitor",
    analyses: {
      [LANDING]: analysis(LANDING, 88),
      signup: analysis("signup", 91),
      casino: analysis("casino", 86),
      loyalty_rewards: analysis("loyalty_rewards", 92),
    },
  },
  {
    id: "demo-b",
    name: "Site 2",
    url: "https://site-2.example",
    favicon: "",
    role: "competitor",
    analyses: {
      [LANDING]: analysis(LANDING, 79),
      signup: analysis("signup", 76),
      casino: analysis("casino", 81),
      loyalty_rewards: analysis("loyalty_rewards", 74),
    },
  },
  {
    id: "demo-c",
    name: "Site 3",
    url: "https://site-3.example",
    favicon: "",
    role: "competitor",
    analyses: {
      [LANDING]: analysis(LANDING, 71),
      signup: analysis("signup", 68),
      casino: analysis("casino", 73),
      loyalty_rewards: analysis("loyalty_rewards", 65),
    },
  },
];

/** @deprecated use DEMO_SITES */
export const DEMO_BRANDS = DEMO_SITES;

export const DEMO_LEADER = DEMO_SITES[1];
export const DEMO_OWN = DEMO_SITES[0];

export const DEMO_LOYALTY_GAP = {
  viewed: analysis("loyalty_rewards", 48, [
    { name: "Retention model (promo vs loop)", score: 42, note: "VIP points exist but cadence and progress are buried behind login." },
    { name: "Gamification & reward cadence", score: 38, note: "Reload promos on a carousel — no daily or weekly claim rhythm." },
    { name: "Tier transparency", score: 51, note: "Tier names visible logged out; thresholds and conversion opaque." },
    { name: "Value-back clarity", score: 45, note: "Cashback mentioned in T&Cs, not surfaced as permanent player value." },
  ]),
  rival: analysis("loyalty_rewards", 92, [
    { name: "Retention model (promo vs loop)", score: 95, note: "Lifetime value-back plus VIP ladder — retention is the product." },
    { name: "Gamification & reward cadence", score: 94, note: "Daily, weekly and level-up rewards with cadence explained in the hub." },
    { name: "Tier transparency", score: 91, note: "Full tier grid with wager thresholds and value-back per level." },
    { name: "Value-back clarity", score: 88, note: "Claim tiles and progress visible in-session." },
  ]),
};

export const DEMO_ACTION_PLAN: ActionPlan = {
  generatedAt: "2026-01-01T00:00:00.000Z",
  basedOnAnalyses: 12,
  recommendations: [
    {
      id: "r1",
      type: "fix_now",
      title: "Surface VIP progress on the rewards hub",
      description: "The leader shows tier thresholds and next reward moment logged out — yours hides progress until login.",
      area: "loyalty_rewards",
      impact: "high",
      effort: "low",
      confidence: "high",
      owner: "Product",
      evidence: "Leader's rewards hub shows tier ladder and claim tiles; yours is a promo carousel only.",
    },
    {
      id: "r2",
      type: "fix_now",
      title: "Clarify welcome vs ongoing value on signup",
      description: "Lead with permanent player value, not just the deposit match — acquisition copy should match retention reality.",
      area: "signup",
      impact: "high",
      effort: "medium",
      confidence: "high",
      owner: "CRM",
      evidence: "Your signup hero is 100% welcome offer; the leader leads with ongoing value-back promise.",
    },
    {
      id: "r3",
      type: "improve_next",
      title: "Add in-session rewards modal",
      description: "Keep players in the product when claiming reloads and tier bonuses — don't send them to a separate promotions page.",
      area: "loyalty_rewards",
      impact: "high",
      effort: "high",
      confidence: "medium",
      owner: "Product",
      evidence: "The leader uses a Bonus Center modal; your rewards live on a detached promotions URL.",
    },
    {
      id: "r4",
      type: "strategic_bet",
      title: "Permanent value-back layer alongside welcome promo",
      description: "Hybrid retention — keep acquisition promos but add systemic rakeback or points that don't expire with the welcome offer.",
      area: "cross_journey",
      impact: "high",
      effort: "high",
      confidence: "medium",
      owner: "Executive",
      evidence: "Gap analysis shows 44pt delta on retention model vs the leader across the set.",
    },
  ],
};

export const DEMO_PROJECT: Project = {
  id: DEMO_PROJECT_ID,
  name: "Q3 Market Audit",
  market: "United Kingdom",
  products: ["Casino", "Sports", "Rewards"],
  journeys: ["signup", "casino", "loyalty_rewards"],
  analysisMode: "Public Audit Mode",
  brands: DEMO_SITES,
  sessions: [],
  actionPlan: DEMO_ACTION_PLAN,
  status: "complete",
  createdAt: "2026-01-01T00:00:00.000Z",
  analysedAt: "2026-01-01T00:00:00.000Z",
};
