/** Shared types for the standalone Trustpilot report at /grace. */

/** Calendar month (`2026-08`) or trailing range (`6m` / `12m`). */
export type GraceWindow = string;

export const RANGE_WINDOWS = ["6m", "12m"] as const;
export type GraceRangeWindow = (typeof RANGE_WINDOWS)[number];

export function isMonthWindow(w: string | null | undefined): w is GraceWindow {
  return Boolean(w && /^\d{4}-\d{2}$/.test(w));
}

export function isRangeWindow(w: string | null | undefined): w is GraceRangeWindow {
  return w === "6m" || w === "12m";
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
  if (ym === "6m") return "6m-prev";
  if (ym === "12m") return "12m-prev";
  if (!isMonthWindow(ym)) return defaultMonth();
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return monthKey(d);
}

export function monthLabel(ym: string, style: "long" | "short" = "long"): string {
  if (ym === "6m") return style === "short" ? "6 months" : "Last 6 months";
  if (ym === "12m") return style === "short" ? "12 months" : "Last 12 months";
  if (ym === "6m-prev") return style === "short" ? "Prev 6m" : "Previous 6 months";
  if (ym === "12m-prev") return style === "short" ? "Prev 12m" : "Previous 12 months";
  if (!isMonthWindow(ym)) return ym;
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", {
    month: style,
    year: "numeric",
    timeZone: "UTC",
  });
}

export function recentMonths(count = 26, now = new Date()): { id: GraceWindow; label: string; short: string }[] {
  const out: { id: GraceWindow; label: string; short: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const id = monthKey(d);
    out.push({ id, label: monthLabel(id), short: monthLabel(id, "short") });
  }
  return out;
}

export function coerceMonth(w: string | null | undefined): GraceWindow {
  if (isRangeWindow(w) || isMonthWindow(w)) return w;
  return defaultMonth();
}

/** Inclusive UTC bounds for a calendar month or trailing 6m/12m range. */
export function monthBounds(ym: string, now = new Date()): { start: string; end: string } {
  const range = rangeWindowBounds(ym, now);
  if (range) return range;
  const key = isMonthWindow(ym) ? ym : defaultMonth();
  const [y, m] = key.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Last N calendar months including the current month, or the N before that. */
export function rangeWindowBounds(
  ym: string,
  now = new Date(),
): { start: string; end: string } | null {
  const span = ym === "6m" || ym === "6m-prev" ? 6 : ym === "12m" || ym === "12m-prev" ? 12 : 0;
  if (!span) return null;
  const prev = ym.endsWith("-prev");
  const endOffset = prev ? span : 0;
  const startOffset = prev ? span * 2 - 1 : span - 1;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - startOffset, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - endOffset + 1, 0, 23, 59, 59, 999));
  return { start: start.toISOString(), end: end.toISOString() };
}

export const GRACE_WINDOWS = recentMonths(26);

export type GraceSource = "trustpilot" | "reddit" | "twoplustwo" | "web";

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
  /** Defaults to Trustpilot for older cached pulls. */
  source?: GraceSource;
  /** Permalink when the row is not a Trustpilot review. */
  url?: string;
  /** Reddit community, without the r/ prefix. */
  subreddit?: string;
}

export function redditSubreddit(r: GraceReview): string | undefined {
  const raw = r.subreddit?.replace(/^r\//i, "").trim();
  if (raw) return raw;
  const m = r.url?.match(/\/r\/([^/?#]+)/i);
  const fromUrl = m?.[1]?.trim();
  if (fromUrl && !/^(all|popular)$/i.test(fromUrl)) return fromUrl;
  return undefined;
}

export function reviewSource(r: GraceReview): GraceSource {
  return r.source ?? "trustpilot";
}

/** Trustpilot stars only. Reddit and other sources have no star rating. */
export function hasStars(r: GraceReview): boolean {
  return reviewSource(r) === "trustpilot" && r.rating > 0;
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
  /** LLM verdict for ambiguous keyword hits. Assured poker reviews are omitted. */
  pokerById?: Record<string, boolean>;
  /** How far the main Trustpilot date filter reached. Poker search may go further. */
  horizonMonths?: 12 | 24;
}
