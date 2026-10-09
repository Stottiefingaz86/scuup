import { POKER_KEYWORDS, reviewMatches } from "./analysis";
import type { GraceReview } from "./types";

/** One of these is enough — the review is about the poker product. */
export const STRONG_POKER = [
  "poker",
  "poker game",
  "poker bonus",
  "poker room",
  "poker table",
  "poker client",
  "rake",
  "rakeback",
  "sit and go",
  "sng",
  "bad beat",
  "bbj",
  "mystery bounty",
  "mbj",
  "Hold'em",
  "omaha",
  "PKO",
  "straddle",
  "wsop",
  "nlhe",
  "plo",
] as const;

/**
 * Also appear on casino, sportsbook, or the main site.
 * Alone they prove nothing — the model has to read the comment.
 */
export const WEAK_POKER = [
  "turn",
  "flop",
  "river",
  "blind",
  "login",
  "promotion",
  "rewards",
  "mission",
  "lobby",
  "jackpot",
  "mystery",
  "bounty",
  "texas",
  "buyin",
  "leaderboard",
  "knockout",
  "avatar",
  "wallet transfer fund",
  "cash game",
  "freeroll",
  "satellite",
  "GTD",
  "windfall",
] as const;

const STREET = ["flop", "turn", "river", "blind", "straddle"] as const;

export type PokerSignal = "assured" | "maybe" | "none";

function haystack(review: GraceReview): string {
  return `${review.title}\n${review.text}`;
}

/** Weak-term match that ignores loose aliases (wallet OR fund, generic “guaranteed”). */
function weakMatch(review: GraceReview, term: string): boolean {
  const hay = haystack(review);
  if (term === "wallet transfer fund") {
    const parts = ["wallet", "transfer", "fund"].filter((w) => new RegExp(`\\b${w}\\w{0,3}\\b`, "i").test(hay));
    return parts.length >= 2;
  }
  if (term === "GTD") {
    return /\bgtd\b/i.test(hay) || /\bguaranteed\s+(prize|tournament|sng|mtt|event)\b/i.test(hay);
  }
  return reviewMatches(review, [term]);
}

function hitCount(review: GraceReview, terms: readonly string[], weak = false): number {
  return terms.filter((k) => (weak ? weakMatch(review, k) : reviewMatches(review, [k]))).length;
}

export function pokerHits(review: GraceReview, terms: readonly string[]): string[] {
  return terms.filter((k) =>
    WEAK_POKER.includes(k as (typeof WEAK_POKER)[number]) ? weakMatch(review, k) : reviewMatches(review, [k]),
  );
}

export function pokerSignal(review: GraceReview): PokerSignal {
  if (hitCount(review, STRONG_POKER) > 0) return "assured";
  if (hitCount(review, STREET) >= 2) return "assured";
  if (hitCount(review, WEAK_POKER, true) > 0) return "maybe";
  return "none";
}

/** True when every selected keyword belongs to the poker group. */
export function isPokerLens(keywords: string[], pokerTerms: string[] = POKER_KEYWORDS): boolean {
  if (!keywords.length) return false;
  const set = new Set(pokerTerms.map((k) => k.toLowerCase()));
  return keywords.every((k) => set.has(k.toLowerCase()));
}

export function isAllPokerFilter(keywords: string[], pokerTerms: string[] = POKER_KEYWORDS): boolean {
  if (!keywords.length || !pokerTerms.length) return false;
  const set = new Set(keywords.map((k) => k.toLowerCase()));
  return pokerTerms.every((k) => set.has(k.toLowerCase()));
}

export function isPokerReview(
  review: GraceReview,
  labels?: Record<string, boolean> | null,
): boolean {
  const signal = pokerSignal(review);
  if (signal === "assured") return true;
  if (signal === "none") return false;
  // Weak hit: keep it until the model says it is not poker.
  return labels?.[review.id] !== false;
}

export function pokerCohort(
  reviews: GraceReview[],
  labels?: Record<string, boolean> | null,
): GraceReview[] {
  return reviews.filter((r) => isPokerReview(r, labels));
}

export function needsPokerClassify(
  reviews: GraceReview[],
  labels?: Record<string, boolean> | null,
): GraceReview[] {
  return reviews.filter((r) => pokerSignal(r) === "maybe" && labels?.[r.id] == null);
}

export function classifySnippet(review: GraceReview): string {
  const strong = pokerHits(review, STRONG_POKER);
  const weak = pokerHits(review, WEAK_POKER);
  const text = `${review.title ? `${review.title} — ` : ""}${review.text}`.replace(/\s+/g, " ").trim();
  return `${review.id} | strong: ${strong.join(", ") || "none"} | weak: ${weak.join(", ") || "none"} | ${text.slice(0, 480)}`;
}
