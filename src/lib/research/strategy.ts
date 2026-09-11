/**
 * Product Strategy 2026–2028 (PLT briefing) — the lens Research uses when
 * comparing brands and writing insights.
 *
 * Corporate direction (fixed): casino first, sports as the funnel, rewards
 * as the priority. Research delivers journey audits and competitor
 * stopwatch teardowns for activation decisions.
 */

import type { CompetitorTeardown, JourneyRun, TopFriction } from "./types";
import { PRODUCT_OKRS } from "./okrs";

/** Three things we intend to be measurably best at. */
export const STRATEGY_PILLARS = [
  {
    id: "widest_bet",
    title: "Widest place to find a bet",
    meaning:
      "Sportsbook breadth + a casino worth leading with — one account, one balance, one experience.",
  },
  {
    id: "most_rewarding",
    title: "Most rewarding place to play",
    meaning:
      "Make it rain rewards — easy to find, easy to win, easy to use. Frequency beats size.",
  },
  {
    id: "straightest_cash",
    title: "Straightest place to get paid (or fund)",
    meaning:
      "Instant withdrawals, published payout times, trusted cashier. Biggest new-account drop is initial funding friction.",
  },
] as const;

/** Hypothesis 1 — activation is the biggest win (journey map owns the path). */
export const ACTIVATION_THESIS = {
  id: "H1_activation",
  claim:
    "If we rebuild the first ninety seconds and the first fourteen days, we move more OKRs than any other single piece of work.",
  path: [
    "ad_or_affiliate",
    "landing",
    "registration",
    "verification",
    "deposit",
    "first_bet",
    "days_1_14",
  ] as const,
  northStar:
    "Highest leverage moment = first casino bet. Everything before it is friction we control.",
  killCondition:
    "If early casino bettors were always going to be higher value (selection, not activation), speeding everyone into casino moves the metric without the money.",
  pmObjectives: [4, 5, 1, 6],
};

/** What Rainbet / Stake do well that traditional welcome-bonus models miss. */
export const COMPETITOR_REWARD_PATTERNS = [
  {
    pattern: "Frequency beats size",
    detail:
      "Claim loops every ~15 min, multiple reloads/day, daily/weekly/monthly races — many small moments, not one big welcome.",
    brands: ["Rainbet", "Stake"],
  },
  {
    pattern: "Expiry creates return",
    detail:
      "Reloads die in 24h; weekly bonus lands on a fixed appointment. Rewards act as push notifications.",
    brands: ["Rainbet", "Stake"],
  },
  {
    pattern: "Rewards on the homepage",
    detail:
      "Bonus structure and live countdown lead the front page — not buried in a promotions tab.",
    brands: ["Rainbet"],
  },
  {
    pattern: "No strings attached cash",
    detail:
      "Instantly withdrawable bonuses without wagering caps — opposite of dripped spins with a cashout cap.",
    brands: ["Stake"],
  },
  {
    pattern: "Cross-sell dial on the meter",
    detail:
      "Sportsbook wagers can count 3× toward race placement — pull players between verticals with one meter.",
    brands: ["Rainbet"],
  },
] as const;

export const RESEARCH_WORKSTREAMS = [
  {
    id: "journey_audit",
    priority: true,
    title: "Journey audit",
    question:
      "What does a new player experience from first touch → first casino bet (and every login after)?",
    bringBack:
      "End-to-end map with step counts + elapsed time per stage, three worst drop-offs, same for login.",
  },
  {
    id: "activation_analytics",
    priority: true,
    title: "Activation analytics",
    question:
      "Baseline deposit → first casino bet — where does time go (payment, verify, nav, game load)?",
    bringBack: "Baseline by stage and acquisition channel.",
  },
  {
    id: "competitor_benchmark",
    priority: true,
    title: "Competitor benchmarking",
    question:
      "How long does onboarding take at peers — measured, not estimated?",
    bringBack: "Feature matrix + stopwatch teardown of competitor onboarding.",
  },
] as const;

export function strategyNorthStarBlurb(): string {
  return `${ACTIVATION_THESIS.northStar} OKR focus: Time to stake ≤12 min, then retention and rewards frequency.`;
}

/** Gap insight: what a competitor does better on timed onboarding. */
export type CompetitorGapInsight = {
  title: string;
  body: string;
  tone: "protect" | "gap" | "next";
};

export function competitorGapInsights(
  ownName: string,
  own: CompetitorTeardown | null,
  others: { name: string; teardown: CompetitorTeardown }[],
): CompetitorGapInsight[] {
  const lines: CompetitorGapInsight[] = [];
  if (!own) {
    lines.push({
      tone: "next",
      title: "No baseline yet",
      body: `Run ${ownName} signup → deposit → first bet to baseline the journey audit.`,
    });
    return lines;
  }

  const timeToStake = own.depositToFirstBetSec;
  const targetSec = 12 * 60;
  if (timeToStake != null) {
    if (timeToStake > targetSec) {
      lines.push({
        tone: "gap",
        title: `Time to stake ${Math.round(timeToStake / 60)} min`,
        body: `Outside the ≤12 min OKR — funded money is not reaching play fast enough.`,
      });
    } else {
      lines.push({
        tone: "protect",
        title: `Time to stake ${Math.round(timeToStake / 60)} min`,
        body: `Inside the ≤12 min OKR target — protect this path.`,
      });
    }
  }

  type Key = keyof CompetitorTeardown;
  const checks: { key: Key; label: string; strategy: string }[] = [
    {
      key: "depositToFirstBetSec",
      label: "deposit → first stake",
      strategy:
        "Put a first casino bet within reach the moment funds clear.",
    },
    {
      key: "registrationTimeSec",
      label: "registration",
      strategy: "Straightest fund path — cut friction before money.",
    },
    {
      key: "depositTimeSec",
      label: "deposit / cashier",
      strategy: "Trust and performance on initial funding.",
    },
    {
      key: "totalOnboardingTimeSec",
      label: "full onboarding",
      strategy: "Shorten the distance from click to first bet.",
    },
    {
      key: "totalOnboardingActions",
      label: "onboarding actions",
      strategy:
        "Fewer clicks is better — more actions means more activation effort, not a richer product.",
    },
  ];

  for (const c of checks) {
    const ownVal = own[c.key];
    if (typeof ownVal !== "number") continue;
    let best: number | null = null;
    let bestName: string | null = null;
    for (const o of others) {
      const v = o.teardown[c.key];
      if (typeof v !== "number") continue;
      if (best == null || v < best) {
        best = v;
        bestName = o.name;
      }
    }
    if (best != null && bestName && ownVal > best * 1.15) {
      const ratio = Math.round((ownVal / best) * 10) / 10;
      const faster =
        c.key === "totalOnboardingActions" ||
        c.key === "registrationSteps" ||
        c.key === "depositSteps" ||
        c.key === "depositToFirstBetClicks" ||
        c.key === "totalFields"
          ? "leaner"
          : "faster";
      lines.push({
        tone: "gap",
        title: `${bestName} is ${ratio}× ${faster} on ${c.label}`,
        body: c.strategy,
      });
    }
  }

  if (lines.length < 2) {
    lines.push({
      tone: "next",
      title: "Next lens",
      body: "Compare reward surfaces (homepage meter, claim cadence) — peers often win on frequency, not just onboarding speed.",
    });
  }

  return lines.slice(0, 5);
}

/** Friction → strategy line for executive read. */
export function frictionStrategyLine(f: TopFriction): string {
  const text = `${f.friction} ${f.whyItMatters}`.toLowerCase();
  if (/deposit|cashier|fund|payment|withdraw/.test(text)) {
    return "Pillar: straightest fund/payout · OKR: Time to stake";
  }
  if (/login|otp|2fa|password|session/.test(text)) {
    return "H1: every return entry · frictionless login / account protection";
  }
  if (/reward|bonus|promo|vip|rake/.test(text)) {
    return "Pillar: most rewarding · frequency + visibility vs welcome-cap model";
  }
  if (/lobby|game|search|discover|iframe/.test(text)) {
    return "H4: discovery vs supply · OKR: distinct games played";
  }
  if (/register|field|verify|email|otp/.test(text)) {
    return "H1 activation · path to first casino bet";
  }
  return "Activation journey";
}

/** Compact strategy card copy for Overview / Report. */
export function strategyBriefForUi(): {
  want: string;
  how: string;
  compare: string;
} {
  return {
    want: "Best casino + sports platform — widest bet, most rewarding play, straightest fund/payout.",
    how: "Own activation end-to-end (first touch → first casino bet → days 1–14). Remove friction; never add urgency. First stake the moment funds clear.",
    compare:
      "Stopwatch competitors on onboarding; note where Rainbet/Stake beat us on reward frequency and homepage visibility.",
  };
}

export function okrWeightSummary(): string {
  return PRODUCT_OKRS.map((o) => `${o.weightPct}% ${o.feeds}`).join(" · ");
}

/** Prefer complete runs when summarizing a brand. */
export function latestCompleteRun(
  runs: JourneyRun[],
  brandId: string
): JourneyRun | null {
  for (let i = runs.length - 1; i >= 0; i--) {
    const r = runs[i]!;
    if (r.brandId === brandId && r.status === "complete") return r;
  }
  return null;
}
