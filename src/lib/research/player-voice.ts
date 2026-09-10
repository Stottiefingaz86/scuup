/**
 * Voice of Player — what players complain about, ask for and get stuck on,
 * from the brand's public Trustpilot reviews over the last six months.
 *
 * The scrape is shared with the main app (`@/lib/voc`). The synthesis here
 * is tuned to the research teardown: themes are tagged by vertical and by
 * kind (complaint / ask / stuck / praise), mapped to journey stages, and
 * cross-checked against what the agent measured on the site.
 */
import { PLAIN_PROSE_RULE } from "@/lib/prose";
import type { TrustpilotScrape } from "@/lib/voc";
import type {
  PlayerVoice,
  PlayerVoiceAlignment,
  PlayerVoiceMonth,
  PlayerVoiceReview,
  PlayerVoiceTheme,
} from "./types";

export const PLAYER_VOICE_WINDOW_MONTHS = 6;

const VERTICALS = [
  "Sports",
  "Casino",
  "Payments",
  "Account & KYC",
  "Bonuses & rewards",
  "Support",
  "Community",
  "Platform",
  "Other",
] as const;

const THEME_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      theme: { type: "string" },
      kind: { type: "string", enum: ["complaint", "ask", "stuck", "praise"] },
      vertical: { type: "string", enum: [...VERTICALS] },
      mentions: { type: "number" },
      stage: { type: ["string", "null"] },
      insight: { type: "string" },
      reviewIds: { type: "array", items: { type: "number" } },
      quotes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string" },
            rating: { type: "number" },
            date: { type: "string" },
          },
          required: ["text", "rating", "date"],
        },
      },
    },
    required: [
      "theme",
      "kind",
      "vertical",
      "mentions",
      "stage",
      "insight",
      "reviewIds",
      "quotes",
    ],
  },
} as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    complaints: THEME_SCHEMA,
    asks: THEME_SCHEMA,
    stuck: THEME_SCHEMA,
    praise: THEME_SCHEMA,
    community: {
      type: "object",
      additionalProperties: false,
      properties: {
        verdict: {
          type: "string",
          enum: ["players want it", "indifferent", "no signal", "against"],
        },
        note: { type: "string" },
      },
      required: ["verdict", "note"],
    },
    alignment: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          area: { type: "string" },
          verdict: { type: "string", enum: ["confirms", "contradicts", "gap"] },
          note: { type: "string" },
        },
        required: ["area", "verdict", "note"],
      },
    },
    authenticityNote: { type: ["string", "null"] },
  },
  required: [
    "summary",
    "complaints",
    "asks",
    "stuck",
    "praise",
    "community",
    "alignment",
    "authenticityNote",
  ],
} as const;

/** Month-by-month volume and sentiment across the window. */
export function monthlyBreakdown(
  scrape: TrustpilotScrape,
  windowMonths: number,
): PlayerVoiceMonth[] {
  const now = new Date();
  const months: PlayerVoiceMonth[] = [];
  for (let i = windowMonths - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    months.push({
      month: d.toISOString().slice(0, 7),
      count: 0,
      positive: 0,
      negative: 0,
      avgRating: null,
    });
  }
  const sums = new Map<string, number>();
  for (const r of scrape.reviews) {
    const key = r.date.slice(0, 7);
    const m = months.find((x) => x.month === key);
    if (!m) continue;
    m.count++;
    if (r.rating >= 4) m.positive++;
    else if (r.rating <= 2) m.negative++;
    sums.set(key, (sums.get(key) ?? 0) + r.rating);
  }
  for (const m of months) {
    m.avgRating = m.count
      ? Math.round(((sums.get(m.month) ?? 0) / m.count) * 10) / 10
      : null;
  }
  return months;
}

function stripDashes(s: string): string {
  return s.replace(/\s[—–]\s/g, ": ").replace(/[—–]/g, "-");
}

const STOP = new Set(
  "about after again against also another around because before being between both cannot could during either every first from have having into just like more most much never only other over same some such than that their them then there these they this those through under until very what when where which while with would your your".split(
    " ",
  ),
);

/** Significant words from a theme + its quotes — used to recover reviews the
 * model forgot to list in reviewIds. */
export function themeKeywords(theme: {
  theme: string;
  quotes?: { text: string }[];
}): string[] {
  const raw =
    `${theme.theme} ${(theme.quotes ?? []).map((q) => q.text).join(" ")}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of raw.split(/\s+/)) {
    if (w.length < 4 || STOP.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out.slice(0, 12);
}

/**
 * Every review index that backs a theme: the model's list, plus any review
 * whose text matches a quote or enough theme keywords. Mentions become the
 * size of this set — never a number the model invented without evidence.
 */
export function matchThemeReviews(
  theme: {
    theme: string;
    kind?: string;
    reviewIds?: number[];
    quotes?: { text: string }[];
  },
  reviews: { rating: number; title: string; text: string }[],
): number[] {
  const ids = new Set<number>();
  for (const i of theme.reviewIds ?? []) {
    if (Number.isInteger(i) && i >= 0 && i < reviews.length) ids.add(i);
  }
  for (const q of theme.quotes ?? []) {
    const needle = (q.text || "").replace(/\s+/g, " ").trim().slice(0, 48);
    if (needle.length < 12) continue;
    reviews.forEach((r, i) => {
      const hay = `${r.title} ${r.text}`.replace(/\s+/g, " ");
      if (hay.includes(needle) || needle.includes(hay.slice(0, 40))) ids.add(i);
    });
  }
  // Theme-title words first (e.g. "rigged", "voided", "withdrawal") — one
  // strong hit is enough. Quote-derived words need two hits.
  const titleKeys = themeKeywords({ theme: theme.theme, quotes: [] });
  const quoteKeys = themeKeywords({
    theme: "",
    quotes: theme.quotes,
  }).filter((k) => !titleKeys.includes(k));
  const ratingOk = (r: { rating: number }) => {
    if (theme.kind === "complaint" || theme.kind === "stuck")
      return r.rating <= 3;
    if (theme.kind === "praise") return r.rating >= 4;
    return true;
  };
  reviews.forEach((r, i) => {
    if (ids.has(i) || !ratingOk(r)) return;
    const hay = `${r.title} ${r.text}`.toLowerCase();
    if (titleKeys.some((k) => k.length >= 5 && hay.includes(k))) {
      ids.add(i);
      return;
    }
    let hits = 0;
    for (const k of [...titleKeys, ...quoteKeys]) {
      if (hay.includes(k)) hits++;
      if (hits >= 2) {
        ids.add(i);
        return;
      }
    }
  });
  return [...ids].sort((a, b) => a - b);
}

function slimReview(r: {
  rating: number;
  title: string;
  text: string;
  date: string;
  replied: boolean;
}): PlayerVoiceReview {
  return {
    rating: r.rating,
    title: r.title.slice(0, 120),
    text: r.text.slice(0, 500),
    date: r.date,
    replied: r.replied,
  };
}

function cleanThemes(
  list: PlayerVoiceTheme[],
  reviews: {
    rating: number;
    title: string;
    text: string;
    date: string;
    replied: boolean;
  }[],
): PlayerVoiceTheme[] {
  return list.map((t) => {
    const reviewIds = matchThemeReviews(t, reviews);
    const evidence = reviewIds
      .map((i) => reviews[i])
      .filter(Boolean)
      .map(slimReview)
      // Cap so localStorage stays under quota; 40 is plenty to read.
      .slice(0, 40);
    return {
      ...t,
      theme: stripDashes(t.theme),
      insight: stripDashes(t.insight),
      mentions: evidence.length || reviewIds.length || t.mentions,
      reviewIds,
      evidence,
      quotes: t.quotes
        .slice(0, 2)
        .map((q) => ({ ...q, text: stripDashes(q.text) })),
    };
  });
}

/**
 * Turn the scraped window into the research read. `journeyContext` is what
 * the agent measured (stages, friction, features) so alignment notes point
 * at real observations.
 */
export async function buildPlayerVoice(
  brandName: string,
  scrape: TrustpilotScrape,
  journeyContext: string,
): Promise<PlayerVoice> {
  const split = { positive: 0, neutral: 0, negative: 0 };
  let replied = 0;
  for (const r of scrape.reviews) {
    if (r.rating >= 4) split.positive++;
    else if (r.rating === 3) split.neutral++;
    else split.negative++;
    if (r.replied) replied++;
  }

  const reviewBlock = scrape.reviews
    .map(
      (r, i) =>
        `[${i}] ${r.rating}★ ${r.date.slice(0, 10)}${r.replied ? " (brand replied)" : ""} — ${r.title ? r.title + ": " : ""}${r.text.replace(/\s+/g, " ")}`,
    )
    .join("\n");

  const prompt = `You are the Voice of Player analyst for an iGaming product research team. Below are ${scrape.reviews.length} public Trustpilot reviews of ${brandName} from the last ${PLAYER_VOICE_WINDOW_MONTHS} months, plus what our agent measured walking the brand's real signup, deposit and first-bet journey.

Answer three questions in the players' own words:
1. What do players COMPLAIN about? (kind = "complaint")
2. What do players ASK FOR? Features, options, payment methods, sports, games, limits they wish existed. (kind = "ask")
3. Where do players GET STUCK? Points in the journey where they could not proceed: verification / KYC, withdrawals held, bonus terms, login, geo blocks, app crashes. (kind = "stuck")
Also capture what they PRAISE (kind = "praise") so the team knows what not to break.

RULES:
- Themes must come from the reviews, in player language ("Withdrawal stuck for 5 days", not "payment friction"). Merge duplicates. For every theme list "reviewIds": the [index] of EVERY review that raises it; "mentions" must equal that list's length. A theme needs 2+ reviews unless severe (funds held, account closed with balance).
- For "ask" themes be concrete about the feature or option wanted (e.g. "Cash App and Venmo cashouts", "Same-game parlays on NHL") so they read as a feature request list.
- Tag every theme with one vertical from [${VERTICALS.join(", ")}] and, when it maps to a journey stage, set "stage" to one of: landing, registration, verification, login, deposit, deposit_confirmation, casino_discovery, game_launch, first_bet, withdrawal, retention. Otherwise null.
- 3-5 themes per list, strongest first. Each theme gets 1-2 SHORT verbatim quotes (one sentence, translated to English if needed) with the review's rating and date. "insight" is one sentence a product team can act on.
- community: do players want community (chat, leaderboards, streamers, forums, social features) or is that something the brand pushes without demand? Judge only from the reviews. If nobody mentions it, verdict "no signal".
- alignment: compare the reviews with our journey measurements below. For each meaningful link output one item: "confirms" (reviews echo what we saw), "contradicts" (reviews clash with our observation), or "gap" (reviews reveal something the agent cannot see from a fresh account: real payout speed, support after deposit, account closures, bonus confiscation). Cite the measurement in the note. 2-5 items.
- authenticityNote: if many 5★ reviews are one-line generic praise in bursts, or reviews look incentivised, say so in one sentence; else null. Do not count farmed praise as a real strength.
- summary: 2 sentences max, the verdict a product lead reads first: overall sentiment, the one thing to fix, whether reviews look organic.
- Never invent numbers. Mention counts must be countable in the reviews provided.

WHAT OUR AGENT MEASURED ON ${brandName.toUpperCase()} (for alignment only; do not restate as player opinion):
${journeyContext || "(no journey run yet)"}

REVIEWS (recent first):
${reviewBlock}

${PLAIN_PROSE_RULE}`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      reasoning: { effort: "low" },
      input: [
        { role: "user", content: [{ type: "input_text", text: prompt }] },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "player_voice",
          schema: SCHEMA,
          strict: true,
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const message = data.output?.find(
    (o: { type: string }) => o.type === "message",
  );
  const text = message?.content?.find(
    (c: { type: string }) => c.type === "output_text",
  )?.text;
  if (!text) throw new Error("OpenAI returned no output text");
  const parsed = JSON.parse(text) as {
    summary: string;
    complaints: PlayerVoiceTheme[];
    asks: PlayerVoiceTheme[];
    stuck: PlayerVoiceTheme[];
    praise: PlayerVoiceTheme[];
    community: PlayerVoice["community"];
    alignment: PlayerVoiceAlignment[];
    authenticityNote: string | null;
  };

  return {
    source: "trustpilot",
    sourceUrl: scrape.sourceUrl,
    fetchedAt: new Date().toISOString(),
    windowMonths: PLAYER_VOICE_WINDOW_MONTHS,
    trustScore: scrape.trustScore,
    totalReviews: scrape.totalReviews,
    sampled: scrape.reviews.length,
    ratingSplit: split,
    replyRate: scrape.reviews.length
      ? Math.round((replied / scrape.reviews.length) * 100) / 100
      : null,
    monthly: monthlyBreakdown(scrape, PLAYER_VOICE_WINDOW_MONTHS),
    summary: stripDashes(parsed.summary),
    complaints: cleanThemes(parsed.complaints, scrape.reviews),
    asks: cleanThemes(parsed.asks, scrape.reviews),
    stuck: cleanThemes(parsed.stuck, scrape.reviews),
    praise: cleanThemes(parsed.praise, scrape.reviews),
    community: {
      verdict: parsed.community.verdict,
      note: stripDashes(parsed.community.note),
    },
    alignment: parsed.alignment.map((a) => ({
      ...a,
      note: stripDashes(a.note),
    })),
    authenticityNote: parsed.authenticityNote
      ? stripDashes(parsed.authenticityNote)
      : null,
    reviews: scrape.reviews.map((r) => ({
      rating: r.rating,
      title: r.title.slice(0, 120),
      text: r.text.slice(0, 400),
      date: r.date,
      replied: r.replied,
    })),
  };
}
