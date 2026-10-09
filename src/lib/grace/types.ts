/** Shared types for the standalone Trustpilot report at /grace. */

/** Calendar month key, e.g. "2026-08". */
export type GraceWindow = string;

export function isMonthWindow(w: string | null | undefined): w is GraceWindow {
  return Boolean(w && /^\d{4}-\d{2}$/.test(w));
}

export function monthKey(d: Date = new Date()): GraceWindow {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Last complete calendar month (VoC month). */
export function defaultMonth(now = new Date()): GraceWindow {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return monthKey(d);
}

export function previousMonthKey(ym: string): GraceWindow {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return monthKey(d);
}

export function monthLabel(ym: string, style: "long" | "short" = "long"): string {
  if (!isMonthWindow(ym)) return ym;
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", {
    month: style,
    year: "numeric",
    timeZone: "UTC",
  });
}

export function recentMonths(count = 14, now = new Date()): { id: GraceWindow; label: string; short: string }[] {
  const out: { id: GraceWindow; label: string; short: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const id = monthKey(d);
    out.push({ id, label: monthLabel(id), short: monthLabel(id, "short") });
  }
  return out;
}

export function coerceMonth(w: string | null | undefined): GraceWindow {
  return isMonthWindow(w) ? w : defaultMonth();
}

/** Inclusive UTC bounds for a calendar month. */
export function monthBounds(ym: string): { start: string; end: string } {
  const key = coerceMonth(ym);
  const [y, m] = key.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start: start.toISOString(), end: end.toISOString() };
}

export const GRACE_WINDOWS = recentMonths(14);

export interface GraceReview {
  id: string;
  rating: number;
  title: string;
  text: string;
  /** ISO publish date. */
  date: string;
  author: string;
  country: string | null;
  verified: boolean;
  likes: number;
  reply: string | null;
  replyDate: string | null;
  language: string | null;
}

export type StarCounts = Record<1 | 2 | 3 | 4 | 5, number>;

export interface GraceScrape {
  slug: string;
  displayName: string;
  sourceUrl: string;
  window: GraceWindow;
  since: string;
  fetchedAt: string;
  trustScore: number | null;
  totalReviews: number | null;
  /** Profile-wide star counts when Trustpilot exposes them. */
  starDistribution: StarCounts | null;
  /** Exact number of reviews Trustpilot reports inside the window. */
  windowTotal: number | null;
  /** Exact per-star counts inside the window (only when we sliced by star). */
  windowStars: StarCounts | null;
  /** Per-star capture coverage when sliced. */
  coverage: { star: 1 | 2 | 3 | 4 | 5; total: number; captured: number }[];
  /** Keyword terms that were deep-pulled through Trustpilot search. */
  searched: string[];
  reviews: GraceReview[];
  pagesRead: number;
  /** True when Trustpilot's 10-page cap or our time budget cut a slice short. */
  truncated: boolean;
}
