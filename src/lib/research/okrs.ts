/**
 * Product OKRs that Research insights and comparisons should serve.
 * Measured journeys are leading indicators for these outcomes — especially
 * time-to-stake (deposit → first casino bet).
 */

export type OkrDirection = "higher" | "lower";

export interface ProductOkr {
  id: string;
  metric: string;
  direction: OkrDirection;
  weightPct: number;
  target: string;
  stretch: string;
  feeds: string;
  why: string;
  /** Research stages / metrics that act as leading indicators. */
  researchLevers: string[];
}

export const PRODUCT_OKRS: ProductOkr[] = [
  {
    id: "nr_per_player",
    metric: "Uplift in casino net revenue per active player (vs control)",
    direction: "higher",
    weightPct: 30,
    target: "5.0%",
    stretch: "6.0%",
    feeds: "Casino net revenue",
    why: "Grow the value of every reached player from product releases.",
    researchLevers: [
      "first_bet",
      "game_select",
      "lobby",
      "depositToFirstBetSec",
    ],
  },
  {
    id: "play_days",
    metric: "Growth in casino play days per active player",
    direction: "higher",
    weightPct: 15,
    target: "8.0%",
    stretch: "9.6%",
    feeds: "Casino active player days",
    why: "Bring players back more often — stickiness vs same period last year.",
    researchLevers: ["days_1_14", "verification", "returning_login"],
  },
  {
    id: "distinct_games",
    metric: "Growth in distinct casino games played per active player",
    direction: "higher",
    weightPct: 10,
    target: "8.0%",
    stretch: "9.6%",
    feeds: "Casino active player days",
    why: "Content discovery via lobby / search / filters.",
    researchLevers: ["game_select", "lobby"],
  },
  {
    id: "time_to_stake",
    metric: "Median time from first deposit to first casino stake",
    direction: "lower",
    weightPct: 15,
    target: "12 min",
    stretch: "10 min",
    feeds: "Funding conversion and time to play",
    why: "Get funded money into play without friction — activation focus.",
    researchLevers: [
      "deposit",
      "deposit_confirmation",
      "game_select",
      "first_bet",
      "depositToFirstBetSec",
      "registration",
      "verification",
    ],
  },
  {
    id: "return_30d",
    metric: "Uplift in 30-day return rate (vs control)",
    direction: "higher",
    weightPct: 15,
    target: "5.0%",
    stretch: "6.0%",
    feeds: "90-day player retention",
    why: "Retain more players who hit new product journeys.",
    researchLevers: ["days_1_14", "verification"],
  },
  {
    id: "nr_outside_casino",
    metric: "Growth in net revenue per active player outside casino",
    direction: "higher",
    weightPct: 10,
    target: "5.0%",
    stretch: "6.0%",
    feeds: "Net revenue across the rest of the portfolio",
    why: "Raise player value in non-casino products.",
    researchLevers: ["landing", "first_touch"],
  },
  {
    id: "opex_removed",
    metric: "Operating cost removed per month by shipped product change",
    direction: "higher",
    weightPct: 5,
    target: "$84k",
    stretch: "$167k",
    feeds: "Company operating cost",
    why: "Recurring monthly run-rate savings verified by Finance.",
    researchLevers: [],
  },
];

const STAGE_PRIMARY_OKR: Record<string, string> = {
  first_touch: "time_to_stake",
  landing: "time_to_stake",
  registration: "time_to_stake",
  verification: "time_to_stake",
  deposit: "time_to_stake",
  deposit_confirmation: "time_to_stake",
  game_select: "distinct_games",
  first_bet: "time_to_stake",
  days_1_14: "return_30d",
};

/** Primary OKR a journey stage feeds (for insight copy). */
export function okrForStage(stageId: string): ProductOkr | null {
  const id = STAGE_PRIMARY_OKR[stageId];
  return PRODUCT_OKRS.find((o) => o.id === id) ?? null;
}

/** Short OKR lens line for friction / report copy. */
export function okrWhyLine(stageId: string): string {
  const okr = okrForStage(stageId);
  if (!okr) return "On the path to funded play and retention";
  if (okr.id === "time_to_stake") {
    return `Hits Time to stake (target ≤${okr.target}) — funded money into play`;
  }
  if (okr.id === "distinct_games") {
    return `Hits Distinct games played (+${okr.target} target) — discovery / lobby`;
  }
  if (okr.id === "return_30d") {
    return `Hits 30-day return (+${okr.target} target) — early retention signals`;
  }
  if (okr.id === "play_days") {
    return `Hits Play days (+${okr.target} target) — come-back stickiness`;
  }
  return `Feeds ${okr.feeds} (${okr.weightPct}% OKR weight)`;
}

/** Map teardown comparison rows onto OKR language. */
export function comparisonMetricLabel(key: string): {
  label: string;
  okrHint: string;
} {
  switch (key) {
    case "depositToFirstBetSec":
      return {
        label: "Time to stake (deposit → first bet)",
        okrHint: "OKR · lower is better · target ≤12 min",
      };
    case "depositToFirstBetClicks":
      return {
        label: "Clicks deposit → first stake",
        okrHint: "OKR · Time to stake effort",
      };
    case "registrationTimeSec":
    case "registrationSteps":
    case "totalFields":
      return {
        label:
          key === "totalFields"
            ? "Registration fields"
            : key === "registrationSteps"
              ? "Registration steps"
              : "Registration time",
        okrHint: "Leading · Time to stake / funding conversion",
      };
    case "depositTimeSec":
    case "depositSteps":
      return {
        label: key === "depositSteps" ? "Deposit steps" : "Deposit time",
        okrHint: "Leading · Time to stake",
      };
    case "totalOnboardingTimeSec":
      return {
        label: "Total onboarding time",
        okrHint: "Leading · activation speed",
      };
    case "totalOnboardingActions":
      return {
        label: "Total onboarding actions",
        okrHint: "Leading · activation effort",
      };
    default:
      return { label: key, okrHint: "" };
  }
}

/** One-line exec framing for overview / report. */
export function okrNorthStarBlurb(): string {
  return "Prioritise friction that slows Time to stake (deposit → first bet ≤12 min) and anything that blocks funded play, discovery, or early return.";
}
