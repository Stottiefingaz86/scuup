import type { GraceReview, GraceScrape, GraceWindow } from "./types";

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

/** Poker keyword list supplied by the product team, verbatim order. */
export const POKER_KEYWORDS: string[] = [
  "poker",
  "rewards",
  "rake",
  "mission",
  "cash game",
  "windfall",
  "poker bonus",
  "sit and go",
  "sng",
  "promotion",
  "rakeback",
  "freeroll",
  "lobby",
  "bad beat",
  "jackpot",
  "bbj",
  "mystery bounty",
  "mystery",
  "bounty",
  "mbj",
  "satellite",
  "GTD",
  "Hold'em",
  "omaha",
  "texas",
  "buyin",
  "leaderboard",
  "knockout",
  "PKO",
  "avatar",
  "blind",
  "flop",
  "turn",
  "river",
  "straddle",
  "wsop",
  "login",
  "poker game",
  "wallet transfer fund",
];

export interface CompetitorSet {
  id: string;
  label: string;
  /** The brand under study. */
  self: string;
  rivals: string[];
}

export const COMPETITOR_SETS: CompetitorSet[] = [
  {
    id: "bol",
    label: "BOL vs",
    self: "betonline.ag",
    rivals: [
      "coinpoker.com",
      "acrpoker.com",
      "globalpoker.com",
      "ggpoker.com",
      "bovada.lv",
    ],
  },
  {
    id: "sb",
    label: "SB vs",
    self: "sportsbetting.ag",
    rivals: [
      "pokerstars.com",
      "wsop.com",
      "betrivers.com",
      "betmgm.com",
      "draftkings.com",
    ],
  },
];

/** Broad topic buckets used for the competitor sentiment sliders. */
export const TOPIC_GROUPS: { id: string; label: string; terms: string[] }[] = [
  {
    id: "payments",
    label: "Payouts & deposits",
    terms: [
      "withdraw",
      "withdrawal",
      "payout",
      "cashout",
      "cash out",
      "deposit",
      "payment",
      "transfer",
      "wallet",
      "bitcoin",
      "crypto",
    ],
  },
  {
    id: "trust",
    label: "Trust & fairness",
    terms: [
      "scam",
      "rigged",
      "fake",
      "fraud",
      "legit",
      "trust",
      "honest",
      "cheat",
      "steal",
      "stole",
      "fair",
      "unfair",
      "liar",
      "stolen",
      "legitimate",
    ],
  },
  {
    id: "support",
    label: "Customer support",
    terms: [
      "support",
      "customer service",
      "live chat",
      "chat",
      "agent",
      "respond",
      "response",
      "email",
      "help",
      "ticket",
      "reply",
      "replied",
    ],
  },
  {
    id: "product",
    label: "App & website",
    terms: ["app", "website", "site", "login", "log in", "lag", "crash", "glitch", "bug", "load", "software", "interface"],
  },
  {
    id: "bonus",
    label: "Bonuses & promos",
    terms: ["bonus", "promo", "promotion", "rakeback", "reward", "free", "rollover", "wager"],
  },
  {
    id: "poker",
    label: "Poker",
    terms: POKER_KEYWORDS,
  },
];

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ALIASES: Record<string, string[]> = {
  "bad beat": ["bad beat", "bad bead", "badbeat"],
  "sit and go": ["sit and go", "sit & go", "sit n go", "sit-n-go", "sit'n'go"],
  "hold'em": ["hold'em", "holdem", "hold em", "hold'em"],
  buyin: ["buyin", "buy-in", "buy in"],
  "cash game": ["cash game", "cash games", "cash table"],
  "wallet transfer fund": ["wallet", "transfer", "fund"],
  login: ["login", "log in", "log-in", "sign in"],
  gtd: ["gtd", "guaranteed"],
  pko: ["pko", "progressive knockout"],
  bbj: ["bbj", "bad beat jackpot"],
  mbj: ["mbj", "mystery bounty jackpot"],
  sng: ["sng", "sngs", "sit and go"],
  rewards: ["rewards", "reward"],
  promotion: ["promotion", "promotions", "promo", "promos"],
  mission: ["mission", "missions"],
  satellite: ["satellite", "satellites", "sattelite"],
  freeroll: ["freeroll", "freerolls", "free roll"],
  blind: ["blind", "blinds"],
  bounty: ["bounty", "bounties"],
  leaderboard: ["leaderboard", "leaderboards", "leader board"],
};

const regexCache = new Map<string, RegExp>();

/** Case-insensitive keyword matcher; short tokens are whole-word only,
 * longer words allow a plural / suffix. Multi-word phrases tolerate any
 * whitespace. */
export function keywordRegex(keyword: string): RegExp {
  const key = keyword.toLowerCase().trim();
  const cached = regexCache.get(key);
  if (cached) return cached;
  const variants = ALIASES[key] ?? [key];
  const parts = variants.map((v) => {
    const words = v.split(/\s+/).map(escapeRe);
    const body = words.join("\\s+");
    const last = words[words.length - 1];
    const suffix = last.length <= 3 ? "\\b" : "\\w{0,3}\\b";
    return `\\b${body}${suffix}`;
  });
  const re = new RegExp(`(${parts.join("|")})`, "gi");
  regexCache.set(key, re);
  return re;
}

export function reviewMatches(review: GraceReview, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const hay = `${review.title}\n${review.text}`;
  return keywords.some((k) => {
    const re = keywordRegex(k);
    re.lastIndex = 0;
    return re.test(hay);
  });
}

export function reviewsSinceDays(reviews: GraceReview[], days: number): GraceReview[] {
  const cutoff = Date.now() - days * 86_400_000;
  return reviews.filter((r) => {
    const t = Date.parse(r.date);
    return !Number.isNaN(t) && t >= cutoff;
  });
}

export function reviewsInMonth(reviews: GraceReview[], ym: string): GraceReview[] {
  if (!ym) return reviews;
  return reviews.filter((r) => {
    const t = Date.parse(r.date);
    if (Number.isNaN(t)) return false;
    const d = new Date(t);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return key === ym;
  });
}

export function filterReviews(
  reviews: GraceReview[],
  opts: {
    keywords: string[];
    query: string;
    windowDays?: number;
    month?: string;
    /** When set, only these review ids count as poker — used with the poker lens. */
    pokerIds?: Set<string>;
    allPoker?: boolean;
  },
): GraceReview[] {
  const scoped = opts.month ? reviewsInMonth(reviews, opts.month) : reviews;
  const q = opts.query.trim().toLowerCase();
  const cutoff = opts.windowDays ? Date.now() - opts.windowDays * 86_400_000 : 0;
  return scoped.filter((r) => {
    if (cutoff && Date.parse(r.date) < cutoff) return false;
    if (opts.pokerIds && !opts.pokerIds.has(r.id)) return false;
    if (!opts.allPoker && !reviewMatches(r, opts.keywords)) return false;
    if (q) {
      const hay = `${r.title}\n${r.text}\n${r.author}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Statistics                                                          */
/* ------------------------------------------------------------------ */

export interface ReviewStats {
  count: number;
  avgRating: number;
  positive: number;
  neutral: number;
  negative: number;
  positivePct: number;
  negativePct: number;
  /** -100 .. 100, positive share minus negative share. */
  sentiment: number;
  stars: Record<1 | 2 | 3 | 4 | 5, number>;
  replied: number;
  repliedPct: number;
}

export function isPositive(r: GraceReview): boolean {
  return r.rating >= 4;
}
export function isNegative(r: GraceReview): boolean {
  return r.rating <= 2;
}

/** Label the captured set from its oldest review, not from Trustpilot's official score. */
export function pullSpanLabel(reviews: GraceReview[]): string {
  const times = reviews.map((r) => Date.parse(r.date)).filter((n) => !Number.isNaN(n));
  if (!times.length) return "this pull";
  const months = Math.max(1, Math.round((Date.now() - Math.min(...times)) / (30.44 * 86_400_000)));
  if (months >= 20) return "last 24 months";
  if (months >= 10) return "last 12 months";
  return `last ${months} month${months === 1 ? "" : "s"}`;
}

/** Mean star rating to one decimal — a standalone TrustScore-style number. */
export function standaloneScore(reviews: GraceReview[]): number | null {
  if (!reviews.length) return null;
  const sum = reviews.reduce((n, r) => n + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

export function reviewStats(reviews: GraceReview[]): ReviewStats {
  const stars: ReviewStats["stars"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let replied = 0;
  for (const r of reviews) {
    const s = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    stars[s] += 1;
    sum += r.rating;
    if (r.reply) replied += 1;
  }
  const count = reviews.length;
  const positive = stars[4] + stars[5];
  const negative = stars[1] + stars[2];
  const neutral = stars[3];
  const pct = (n: number) => (count ? Math.round((n / count) * 1000) / 10 : 0);
  return {
    count,
    avgRating: count ? Math.round((sum / count) * 100) / 100 : 0,
    positive,
    neutral,
    negative,
    positivePct: pct(positive),
    negativePct: pct(negative),
    sentiment: count ? Math.round(((positive - negative) / count) * 100) : 0,
    stars,
    replied,
    repliedPct: pct(replied),
  };
}

/** Stats from exact per-star counts (Trustpilot's own window totals). */
export function statsFromStarCounts(stars: ReviewStats["stars"]): ReviewStats {
  const count = stars[1] + stars[2] + stars[3] + stars[4] + stars[5];
  const sum = stars[1] + 2 * stars[2] + 3 * stars[3] + 4 * stars[4] + 5 * stars[5];
  const positive = stars[4] + stars[5];
  const negative = stars[1] + stars[2];
  const pct = (n: number) => (count ? Math.round((n / count) * 1000) / 10 : 0);
  return {
    count,
    avgRating: count ? Math.round((sum / count) * 100) / 100 : 0,
    positive,
    neutral: stars[3],
    negative,
    positivePct: pct(positive),
    negativePct: pct(negative),
    sentiment: count ? Math.round(((positive - negative) / count) * 100) : 0,
    stars: { ...stars },
    replied: 0,
    repliedPct: 0,
  };
}

/** Best available unfiltered window stats: exact counts when we sliced by
 * star, otherwise the captured sample (which is then complete anyway). */
export function windowBaseline(scrape: GraceScrape): ReviewStats {
  if (scrape.windowStars) {
    const exact = statsFromStarCounts(scrape.windowStars);
    const sample = reviewStats(scrape.reviews);
    return { ...exact, replied: sample.replied, repliedPct: sample.repliedPct };
  }
  return reviewStats(scrape.reviews);
}

/** Merge a deep-pull into an existing scrape, deduping by review id. */
export function mergeScrapes(base: GraceScrape, extra: GraceScrape): GraceScrape {
  const seen = new Set(base.reviews.map((r) => r.id));
  const reviews = [...base.reviews];
  for (const r of extra.reviews) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    reviews.push(r);
  }
  reviews.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return {
    ...base,
    reviews,
    searched: [...new Set([...base.searched, ...extra.searched])],
    pokerById: { ...base.pokerById, ...extra.pokerById },
    horizonMonths: Math.max(base.horizonMonths ?? 12, extra.horizonMonths ?? 12) as 12 | 24,
    pagesRead: base.pagesRead + extra.pagesRead,
    fetchedAt: extra.fetchedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Topics                                                              */
/* ------------------------------------------------------------------ */

export interface TopicRow {
  topic: string;
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  sentiment: number;
  avgRating: number;
}

export function topicBreakdown(
  reviews: GraceReview[],
  topics: string[],
): TopicRow[] {
  const rows: TopicRow[] = [];
  for (const topic of topics) {
    const re = keywordRegex(topic);
    let total = 0;
    let positive = 0;
    let negative = 0;
    let sum = 0;
    for (const r of reviews) {
      re.lastIndex = 0;
      if (!re.test(`${r.title}\n${r.text}`)) continue;
      total += 1;
      sum += r.rating;
      if (isPositive(r)) positive += 1;
      else if (isNegative(r)) negative += 1;
    }
    if (total === 0) continue;
    rows.push({
      topic,
      total,
      positive,
      negative,
      neutral: total - positive - negative,
      sentiment: Math.round(((positive - negative) / total) * 100),
      avgRating: Math.round((sum / total) * 100) / 100,
    });
  }
  return rows.sort((a, b) => b.total - a.total);
}

/** Broad topic groups expressed as TopicRows (for the by-topic bars when
 * no keyword filter is active). */
export function topicGroupRows(reviews: GraceReview[]): TopicRow[] {
  const rows: TopicRow[] = [];
  for (const g of TOPIC_GROUPS) {
    let total = 0;
    let positive = 0;
    let negative = 0;
    let sum = 0;
    for (const r of reviews) {
      if (!reviewMatches(r, g.terms)) continue;
      total += 1;
      sum += r.rating;
      if (isPositive(r)) positive += 1;
      else if (isNegative(r)) negative += 1;
    }
    if (total === 0) continue;
    rows.push({
      topic: g.label,
      total,
      positive,
      negative,
      neutral: total - positive - negative,
      sentiment: Math.round(((positive - negative) / total) * 100),
      avgRating: Math.round((sum / total) * 100) / 100,
    });
  }
  return rows.sort((a, b) => b.total - a.total);
}

export interface TopicGroupScore {
  id: string;
  label: string;
  count: number;
  sentiment: number;
}

export function topicGroupScores(reviews: GraceReview[]): TopicGroupScore[] {
  return TOPIC_GROUPS.map((g) => {
    let total = 0;
    let pos = 0;
    let neg = 0;
    for (const r of reviews) {
      if (!reviewMatches(r, g.terms)) continue;
      total += 1;
      if (isPositive(r)) pos += 1;
      else if (isNegative(r)) neg += 1;
    }
    return {
      id: g.id,
      label: g.label,
      count: total,
      sentiment: total ? Math.round(((pos - neg) / total) * 100) : 0,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

export interface TimelinePoint {
  key: string;
  label: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
  sentiment: number;
  avgRating: number;
}

export type Granularity = "day" | "week" | "month";

export function granularityFor(window: GraceWindow): Granularity {
  return /^\d{4}-\d{2}$/.test(window) ? "week" : "month";
}

function startOfWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // Monday = 0
  x.setUTCDate(x.getUTCDate() - day);
  return x;
}

function bucketKey(d: Date, g: Granularity): { key: string; label: string } {
  if (g === "month") {
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
    };
  }
  const base = g === "week" ? startOfWeek(d) : d;
  const key = base.toISOString().slice(0, 10);
  return {
    key,
    label: base.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
  };
}

export function timeline(
  reviews: GraceReview[],
  granularity: Granularity,
  sinceIso?: string,
  untilIso?: string,
): TimelinePoint[] {
  const map = new Map<string, TimelinePoint & { sum: number }>();
  // Seed empty buckets so quiet periods still render.
  const start = sinceIso ? new Date(sinceIso) : null;
  if (start) {
    const cursor = new Date(start);
    const end = untilIso ? new Date(untilIso) : new Date();
    let guard = 0;
    while (cursor <= end && guard++ < 400) {
      const b = bucketKey(cursor, granularity);
      if (!map.has(b.key)) {
        map.set(b.key, { ...b, count: 0, positive: 0, negative: 0, neutral: 0, sentiment: 0, avgRating: 0, sum: 0 });
      }
      if (granularity === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      else cursor.setUTCDate(cursor.getUTCDate() + (granularity === "week" ? 7 : 1));
    }
  }
  for (const r of reviews) {
    const d = new Date(r.date);
    if (Number.isNaN(d.getTime())) continue;
    const b = bucketKey(d, granularity);
    let p = map.get(b.key);
    if (!p) {
      p = { ...b, count: 0, positive: 0, negative: 0, neutral: 0, sentiment: 0, avgRating: 0, sum: 0 };
      map.set(b.key, p);
    }
    p.count += 1;
    p.sum += r.rating;
    if (isPositive(r)) p.positive += 1;
    else if (isNegative(r)) p.negative += 1;
    else p.neutral += 1;
  }
  const rows = [...map.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ sum, ...p }) => {
      const label =
        granularity === "week" && start && new Date(p.key) < start
          ? start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
          : p.label;
      return {
        ...p,
        label,
        sentiment: p.count ? Math.round(((p.positive - p.negative) / p.count) * 100) : 0,
        avgRating: p.count ? Math.round((sum / p.count) * 100) / 100 : 0,
      };
    });
  while (rows.length && rows[0].count === 0) rows.shift();
  while (rows.length && rows[rows.length - 1].count === 0) rows.pop();
  return rows;
}

/* ------------------------------------------------------------------ */
/* Tag cloud                                                           */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set(
  `a about above after again against all also am an and any are aren't as at be because been before being below between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each even ever few for from further get got had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself just let's like me more most mustn't my myself no nor not now of off on once one only or other ought our ours ourselves out over own really same shan't she she'd she'll she's should shouldn't so some still such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until up us use used very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's will with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves
  thing things way day days week weeks month months year years time times back much many well make made making take took taken go going went come came say said says see seen told tell know knew think thought want wanted need needed also always never again around every since already yet still try tried trying put something anything nothing everything someone anyone everyone first last next two three four five ten site website review reviews trustpilot customer customers company people person account money`
    .split(/\s+/)
    .filter(Boolean),
);

export interface CloudWord {
  word: string;
  count: number;
  /** -1..1 lean of the reviews that mention it. */
  lean: number;
}

/** Word frequencies across the filtered reviews, with the brand's own name
 * and generic stopwords removed so the cloud describes the experience, not
 * the company. */
export function tagCloud(
  reviews: GraceReview[],
  brandTokens: string[],
  limit = 36,
): CloudWord[] {
  const banned = new Set<string>(STOPWORDS);
  for (const t of brandTokens) {
    for (const piece of t.toLowerCase().split(/[^a-z0-9]+/)) {
      if (piece.length >= 2) banned.add(piece);
    }
  }
  const counts = new Map<string, { count: number; pos: number; neg: number }>();
  for (const r of reviews) {
    const seenHere = new Set<string>();
    const tokens = `${r.title} ${r.text}`
      .toLowerCase()
      .replace(/[’`]/g, "'")
      .split(/[^a-z0-9']+/);
    for (let tok of tokens) {
      tok = tok.replace(/^'+|'+$/g, "").replace(/'s$/, "");
      if (tok.length < 4 || /^\d+$/.test(tok) || banned.has(tok)) continue;
      // Collapse the brand's host fragments (betonline, bet-online…)
      if (brandTokens.some((b) => tok.includes(b.toLowerCase().replace(/[^a-z0-9]/g, "")) && b.length >= 4)) continue;
      if (seenHere.has(tok)) continue;
      seenHere.add(tok);
      const e = counts.get(tok) ?? { count: 0, pos: 0, neg: 0 };
      e.count += 1;
      if (isPositive(r)) e.pos += 1;
      else if (isNegative(r)) e.neg += 1;
      counts.set(tok, e);
    }
  }
  return [...counts.entries()]
    .filter(([, v]) => v.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([word, v]) => ({
      word,
      count: v.count,
      lean: v.count ? (v.pos - v.neg) / v.count : 0,
    }));
}

/** Tokens to scrub from the cloud: domain root + display name words. */
export function brandTokensFor(slug: string, displayName: string): string[] {
  const root = slug.replace(/^www\./, "").split(".")[0] ?? slug;
  const nameWords = displayName.split(/[^A-Za-z0-9]+/).filter((w) => w.length >= 3);
  return [root, displayName, ...nameWords];
}

/* ------------------------------------------------------------------ */
/* Highlighting                                                        */
/* ------------------------------------------------------------------ */

export interface TextSegment {
  text: string;
  hit: boolean;
}

/** Split text into segments marking keyword hits (first regex wins). */
export function highlightSegments(text: string, keywords: string[]): TextSegment[] {
  if (!text) return [];
  if (keywords.length === 0) return [{ text, hit: false }];
  const sources = keywords.map((k) => keywordRegex(k).source.slice(1, -1));
  const re = new RegExp(`(${sources.join("|")})`, "gi");
  const out: TextSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), hit: false });
    out.push({ text: m[0], hit: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out;
}

/** True when copy treats the unfiltered month total as the matching set. */
export function copyContradictsCounts(text: string, matching: number, monthTotal: number): boolean {
  if (!text || matching === monthTotal) return false;
  const hasTotal = new RegExp(`\\b${monthTotal}\\b`).test(text);
  const hasMatchOfTotal = new RegExp(`${matching}\\s+of\\s+${monthTotal}`).test(text);
  return hasTotal && !hasMatchOfTotal;
}

/** True when the model wrote "there is no praise" instead of real copy. */
export function isHollowPraise(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return /no positive|not enough positive|there is no positive|no review praised|nothing to praise|no praise in/i.test(t);
}

/** True when a period line only restates the header count. */
export function isCountRestatement(line: string, matching: number, monthTotal: number): boolean {
  const t = line.trim();
  if (!t) return true;
  if (new RegExp(`^${matching}\\s+of\\s+${monthTotal}\\b`).test(t)) return true;
  if (new RegExp(`had ${matching} of ${monthTotal}\\b`).test(t)) return true;
  if (new RegExp(`${matching}\\s+of\\s+${monthTotal}\\s+\\S.*\\bmatch`).test(t)) return true;
  return false;
}

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function mentionsOtherMonth(text: string, windowLabel: string): boolean {
  const current = windowLabel.split(/\s+/)[0]?.toLowerCase() ?? "";
  return MONTH_NAMES.some((m) => m !== current && new RegExp(`\\b${m}\\b`, "i").test(text));
}

/** True when a headline claims a trend without naming the other month. */
export function headlineOverclaims(text: string, windowLabel: string): boolean {
  if (!/\b(fewer|more|sharper|stayed|continued|worse)\b/i.test(text)) return false;
  return !mentionsOtherMonth(text, windowLabel);
}

/** Sentiment-score lines read as jargon next to the star mix. */
export function isJargonLine(line: string): boolean {
  return /sentiment is|sentiment score/i.test(line);
}

/** Short quotes for the report: the sentence containing a keyword hit. */
export function quoteFor(review: GraceReview, keywords: string[], max = 220): string {
  const body = review.text || review.title;
  if (keywords.length === 0) return body.length > max ? `${body.slice(0, max - 1)}…` : body;
  const sentences = body.split(/(?<=[.!?])\s+/);
  const hit = sentences.find((s) => reviewMatches({ ...review, title: "", text: s }, keywords));
  const q = hit ?? body;
  return q.length > max ? `${q.slice(0, max - 1)}…` : q;
}

/** Left-column copy for the Trustpilot-style analytics slide. */
export function reportNarrative(opts: {
  brand: string;
  filterLabel: string;
  windowLabel: string;
  stats: ReviewStats;
  monthTotal?: number;
  topics: TopicRow[];
  points: TimelinePoint[];
}): { bullets: string[]; positive: string; negative: string } {
  const { filterLabel, windowLabel, stats, topics } = opts;
  const monthTotal = opts.monthTotal ?? stats.count;
  const filtered = filterLabel !== "All reviews" && monthTotal !== stats.count;
  const bullets: string[] = [];
  if (stats.negative === stats.count && stats.count > 0) {
    bullets.push(`All ${stats.count} matching review${stats.count === 1 ? " is" : "s are"} negative. Average ${stats.avgRating}/5.`);
  } else if (stats.positive === stats.count && stats.count > 0) {
    bullets.push(`All ${stats.count} matching review${stats.count === 1 ? " is" : "s are"} positive. Average ${stats.avgRating}/5.`);
  } else {
    bullets.push(
      `${stats.negative} negative, ${stats.neutral} neutral, ${stats.positive} positive. Average ${stats.avgRating}/5.`,
    );
  }
  if (!filtered) {
    bullets.unshift(
      `${windowLabel} had ${stats.count} review${stats.count === 1 ? "" : "s"}.`,
    );
  }

  const pos = topics.filter((t) => t.positive > 0).sort((a, b) => b.positive - a.positive).slice(0, 4);
  const neg = topics.filter((t) => t.negative > 0).sort((a, b) => b.negative - a.negative).slice(0, 4);
  const list = (rows: TopicRow[]) =>
    rows.length
      ? rows.map((t) => t.topic).join(", ").replace(/, ([^,]+)$/, " and $1")
      : null;
  return {
    bullets,
    positive: list(pos) ? `Players mention ${list(pos)}.` : "",
    negative: list(neg) ? `They complain about ${list(neg)}.` : "",
  };
}

export function competitorNarrative(
  brands: { name: string; self: boolean; trust: number | null; sentiment: number; count: number }[],
): string[] {
  const withScore = brands.filter((b) => b.trust != null).sort((a, b) => (b.trust ?? 0) - (a.trust ?? 0));
  const you = brands.find((b) => b.self);
  const lines: string[] = [];
  if (withScore[0] && you) {
    const lead = withScore[0];
    const rest = withScore.filter((b) => b.name !== lead.name);
    lines.push(
      `Overall TrustScore: ${lead.name} leads at ${lead.trust!.toFixed(1)}${
        rest[0] ? `, ahead of ${rest[0].name} (${rest[0].trust!.toFixed(1)})` : ""
      }${rest.length > 1 ? `, with other brands below ${rest[1]?.trust?.toFixed(1) ?? "3.0"}` : ""}.`,
    );
    if (you.count) {
      lines.push(
        `${you.name} filtered sentiment is ${you.sentiment > 0 ? `+${you.sentiment}` : you.sentiment} across ${you.count} matching reviews.`,
      );
    }
  }
  return lines;
}
