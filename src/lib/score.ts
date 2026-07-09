/** Five-tier scoring system used across chips, gauges and matrices. */
export type Tier = 1 | 2 | 3 | 4 | 5;

export const TIERS: {
  tier: Tier;
  label: string;
  range: string;
  min: number;
}[] = [
  { tier: 1, label: "Very poor", range: "0–45", min: 0 },
  { tier: 2, label: "Poor", range: "46–60", min: 46 },
  { tier: 3, label: "Average", range: "61–75", min: 61 },
  { tier: 4, label: "Good", range: "76–90", min: 76 },
  { tier: 5, label: "Excellent", range: "91–100", min: 91 },
];

export function tierOf(score: number): Tier {
  if (score >= 91) return 5;
  if (score >= 76) return 4;
  if (score >= 61) return 3;
  if (score >= 46) return 2;
  return 1;
}

export function tierLabel(score: number): string {
  return TIERS[tierOf(score) - 1].label;
}

export const TIER_TEXT: Record<Tier, string> = {
  1: "text-tier-1",
  2: "text-tier-2",
  3: "text-tier-3",
  4: "text-tier-4",
  5: "text-tier-5",
};

export const TIER_BG: Record<Tier, string> = {
  1: "bg-tier-1",
  2: "bg-tier-2",
  3: "bg-tier-3",
  4: "bg-tier-4",
  5: "bg-tier-5",
};

/** Soft chip treatment: tinted background + readable tier-colored text. */
export const TIER_CHIP: Record<Tier, string> = {
  1: "bg-tier-1/15 text-tier-1 ring-tier-1/30",
  2: "bg-tier-2/15 text-tier-2 ring-tier-2/30",
  3: "bg-tier-3/15 text-tier-3 ring-tier-3/30",
  4: "bg-tier-4/15 text-tier-4 ring-tier-4/30",
  5: "bg-tier-5/15 text-tier-5 ring-tier-5/30",
};

/* Hover-reveal variants: muted competitor scores show their tier colour on
 * hover so the detail is a gesture away without adding permanent noise. */
export const TIER_CHIP_HOVER: Record<Tier, string> = {
  1: "hover:bg-tier-1/15 hover:text-tier-1 hover:ring-tier-1/30",
  2: "hover:bg-tier-2/15 hover:text-tier-2 hover:ring-tier-2/30",
  3: "hover:bg-tier-3/15 hover:text-tier-3 hover:ring-tier-3/30",
  4: "hover:bg-tier-4/15 hover:text-tier-4 hover:ring-tier-4/30",
  5: "hover:bg-tier-5/15 hover:text-tier-5 hover:ring-tier-5/30",
};

export const TIER_TEXT_GROUP_HOVER: Record<Tier, string> = {
  1: "group-hover/score:text-tier-1",
  2: "group-hover/score:text-tier-2",
  3: "group-hover/score:text-tier-3",
  4: "group-hover/score:text-tier-4",
  5: "group-hover/score:text-tier-5",
};

export const TIER_BG_GROUP_HOVER: Record<Tier, string> = {
  1: "group-hover/score:bg-tier-1",
  2: "group-hover/score:bg-tier-2",
  3: "group-hover/score:bg-tier-3",
  4: "group-hover/score:bg-tier-4",
  5: "group-hover/score:bg-tier-5",
};

export function tierTextClass(score: number): string {
  return TIER_TEXT[tierOf(score)];
}

export function tierBgClass(score: number): string {
  return TIER_BG[tierOf(score)];
}

export function tierChipClass(score: number): string {
  return TIER_CHIP[tierOf(score)];
}

/* Legacy three-tone helpers (kept for components not yet migrated). */
export function scoreTone(score: number): "strong" | "mid" | "weak" {
  if (score >= 75) return "strong";
  if (score >= 55) return "mid";
  return "weak";
}

export function scoreTextClass(score: number): string {
  return tierTextClass(score);
}

export function scoreBgClass(score: number): string {
  return tierBgClass(score);
}

/** For 1-10 heuristic scores. */
export function heuristicTone(score: number): "strong" | "mid" | "weak" {
  return scoreTone(score * 10);
}
