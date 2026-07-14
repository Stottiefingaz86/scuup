import type { JourneyType } from "./types";

/** Client-safe plan model. Server-side plan lookup lives in auth-server. */
export type Plan = "free" | "pro" | "pro_plus";

/** Free tier: own brand only on public journeys — one report, no re-runs. */
export const FREE_JOURNEYS: JourneyType[] = ["casino", "sports_betslip"];

export const PLAN_COMPETITOR_LIMIT: Record<Plan, number> = {
  free: 0,
  pro: 4,
  pro_plus: 4,
};

/** Total reports a plan may ever create. */
export const PLAN_PROJECT_LIMIT: Record<Plan, number> = {
  free: 1,
  pro: Number.POSITIVE_INFINITY,
  pro_plus: Number.POSITIVE_INFINITY,
};

/** Live (non-archived) reports allowed at once. */
export const PLAN_ACTIVE_PROJECT_LIMIT: Record<Plan, number> = {
  free: 1,
  pro: 1,
  pro_plus: 5,
};

/** Team members (read-only viewers) that can be invited to each report. */
export const PLAN_INVITE_LIMIT: Record<Plan, number> = {
  free: 1,
  pro: 5,
  pro_plus: 15,
};

export const PRO_PRICE_MONTHLY = 79;
export const PRO_PLUS_PRICE_MONTHLY = 349;

export function isPaidPlan(plan: Plan): boolean {
  return plan !== "free";
}

export function journeyAllowedOnPlan(plan: Plan, journey: string): boolean {
  if (isPaidPlan(plan)) return true;
  return journey === "landing" || (FREE_JOURNEYS as string[]).includes(journey);
}

export const FREE_PLAN_FEATURES = [
  "Your brand only — no competitors",
  "First impression, casino & sports journeys",
  "Full heuristic scoring and evidence",
  "One report — no updates or re-runs",
];

/** What Pro unlocks — single source for every upsell surface. */
export const PRO_SELLING_POINTS = [
  "One report — your brand + up to 4 competitors",
  "All 9 journey areas including logged-in flows",
  "Signup, deposit, withdraw, rewards & support",
  "Prioritised action plan and gap comparisons",
  "Re-run and refresh on your monthly plan",
];

export const PRO_PLUS_SELLING_POINTS = [
  "Five reports — each with your brand + 4 competitors",
  "Track multiple markets or brand lines in parallel",
  "All Pro journeys, evidence and action plans",
  "Share links for leadership, product and design",
  "Priority analysis queue",
];
