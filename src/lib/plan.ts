import type { JourneyType } from "./types";

/** Client-safe plan model. Server-side plan lookup lives in auth-server. */
export type Plan = "free" | "pro";

/** Free tier: audit your own brand on public pages — first impression is
 * always included, plus these journeys. Everything needing accounts or
 * competitors is Pro. */
export const FREE_JOURNEYS: JourneyType[] = ["casino", "sports_betslip"];

export const PLAN_COMPETITOR_LIMIT: Record<Plan, number> = {
  free: 0,
  pro: 3,
};

/** How many reports a plan may create. */
export const PLAN_PROJECT_LIMIT: Record<Plan, number> = {
  free: 1,
  pro: Number.POSITIVE_INFINITY,
};

export function journeyAllowedOnPlan(plan: Plan, journey: string): boolean {
  if (plan === "pro") return true;
  return journey === "landing" || (FREE_JOURNEYS as string[]).includes(journey);
}

export const PRO_PRICE_MONTHLY = 249;

/** What Pro unlocks — single source for every upsell surface. */
export const PRO_SELLING_POINTS = [
  "Benchmark up to 3 competitors side by side",
  "All 8 player journeys — signup, deposit, withdraw, support and more",
  "Logged-in audits with managed test accounts",
  "Prioritised action plan and gap comparisons",
  "Unlimited reports, every market",
];
