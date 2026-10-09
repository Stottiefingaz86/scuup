import { NextResponse, type NextRequest } from "next/server";
import { PLAIN_PROSE_RULE, sanitizeProse } from "@/lib/prose";
import type { ReportSnapshot, SavedReportSummary } from "@/lib/grace/reports";
import { EMPTY_COMMENTARY } from "@/lib/grace/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface SummaryInput {
  brand: string;
  window: string;
  filterLabel: string;
  keywords: string[];
  trustScore?: number | null;
  pokerScore?: number | null;
  pokerCount?: number;
  monthTotal?: number;
  stats: {
    count: number;
    avgRating: number;
    sentiment: number;
    positivePct: number;
    negativePct: number;
    neutralPct: number;
  };
  topics: { topic: string; total: number; positive: number; negative: number }[];
  reviews: { rating: number; title: string; text: string; date: string }[];
  competitors?: {
    name: string;
    trust: number | null;
    pokerScore?: number | null;
    pokerCount?: number;
    count: number;
    sentiment: number;
  }[];
  previous?: {
    name: string;
    snapshot: ReportSnapshot;
    copy?: Partial<SavedReportSummary> | null;
  } | null;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "period",
    "mix",
    "positive",
    "negative",
    "watch",
    "changed",
    "competitor",
    "wins",
    "pains",
    "actions",
    "commentary",
  ],
  properties: {
    headline: { type: "string" },
    period: { type: "array", items: { type: "string" } },
    mix: { type: "string" },
    positive: { type: "string" },
    negative: { type: "string" },
    watch: { type: "array", items: { type: "string" } },
    changed: { type: "array", items: { type: "string" } },
    competitor: { type: "array", items: { type: "string" } },
    wins: { type: "array", items: { type: "string" } },
    pains: { type: "array", items: { type: "string" } },
    actions: { type: "array", items: { type: "string" } },
    commentary: {
      type: "object",
      additionalProperties: false,
      required: ["topics", "comments", "competitors", "charts", "keywords", "actions"],
      properties: {
        topics: { type: "string" },
        comments: { type: "string" },
        competitors: { type: "string" },
        charts: { type: "string" },
        keywords: { type: "string" },
        actions: { type: "string" },
      },
    },
  },
} as const;

function clean(s: string): string {
  return sanitizeProse(s);
}

function cleanList(xs: string[]): string[] {
  return xs.map(clean).filter(Boolean);
}

/** Writes the left-column Trustpilot Business briefing, and a vs-last-report
 * delta when a previous snapshot is supplied. */
export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set." },
      { status: 503 },
    );
  }
  try {
    const body = (await request.json()) as SummaryInput;
    const monthCount = body.stats?.count ?? 0;
    const monthTotal = body.monthTotal ?? monthCount;
    const filtered = Boolean(body.filterLabel && body.filterLabel !== "All reviews" && monthTotal !== monthCount);
    const shown = (body.reviews ?? []).slice(0, 160);
    const reviewBlock = shown
      .map(
        (r, i) =>
          `${i + 1}. [${r.rating}★ ${r.date.slice(0, 10)}] ${r.title ? `${r.title} — ` : ""}${r.text.slice(0, 420)}`,
      )
      .join("\n");
    const topicBlock = (body.topics ?? [])
      .slice(0, 20)
      .map((t) => `${t.topic}: ${t.total} mentions (${t.positive} positive / ${t.negative} negative)`)
      .join("\n");
    const rivalBlock = (body.competitors ?? [])
      .map(
        (c) =>
          `${c.name}: TrustScore ${c.trust ?? "n/a"}, poker score ${c.pokerScore ?? "n/a"} (${c.pokerCount ?? 0} poker reviews), ${c.count} matching this month, sentiment ${c.sentiment}`,
      )
      .join("\n");

    const prev = body.previous;
    const prevBlock = prev
      ? `PREVIOUS REPORT TO COMPARE (${prev.name})
Window: ${prev.snapshot.window}. Filter: ${prev.snapshot.filterLabel}.
TrustScore ${prev.snapshot.trustScore ?? "n/a"}. Reviews ${prev.snapshot.stats.count}. Avg ${prev.snapshot.stats.avgRating}. Sentiment ${prev.snapshot.stats.sentiment}. Positive ${prev.snapshot.stats.positivePct}% / Neutral ${prev.snapshot.stats.neutralPct}% / Negative ${prev.snapshot.stats.negativePct}%.
Topics: ${(prev.snapshot.topics ?? []).slice(0, 12).map((t) => `${t.topic} ${t.total} (${t.positive}+/${t.negative}-)`).join("; ") || "none"}
Prior briefing: ${prev.copy?.headline ?? ""} ${prev.copy?.negative ?? ""} ${prev.copy?.watch?.join("; ") ?? ""}

This is last month. Compare month on month. In "changed", write 3 to 6 concrete callouts: volume, sentiment, new complaints, fading issues. Use the exact numbers. If something got worse, say so as an issue that has risen.`
      : `No previous month exists yet. Leave "changed" empty. In "period", describe how this month is doing on its own — volume, sentiment, rating — do not invent a comparison.`;

    const prompt = `You write the briefing copy for a monthly Trustpilot VoC report on ${body.brand}, filter "${body.filterLabel}", month ${body.window}.
Tone: a sharp internal analyst. Short sentences. No hype. Only what the reviews support. Never invent counts.

HARD FACTS — do not contradict these:
- ${body.window} has ${monthTotal} review${monthTotal === 1 ? "" : "s"} in the pull${filtered ? `, and exactly ${monthCount} match the "${body.filterLabel}" filter` : ""}.
- The briefing is about the ${filtered ? `${monthCount} matching` : monthTotal} review${(filtered ? monthCount : monthTotal) === 1 ? "" : "s"}. Do not write as if all ${monthTotal} month reviews are ${body.filterLabel}.
- If a number is not 1, never write "one review", "a single review", or "only 1 review".
- Official Trustpilot TrustScore for the whole brand: ${body.trustScore ?? "n/a"}. That mixes poker and every other product.
- Standalone poker score (mean of poker reviews in the last-12-months pull): ${body.pokerScore ?? "n/a"} from ${body.pokerCount ?? 0} poker reviews. Do not treat the TrustScore as the poker score.
- Average rating of the matching set: ${body.stats.avgRating}/5. Sentiment ${body.stats.sentiment} (positive share minus negative share).
- Mix of the matching set: Positive ${body.stats.positivePct}%, Neutral ${body.stats.neutralPct}%, Negative ${body.stats.negativePct}%.
Week-level or quoted reviews below are samples. They are not the month total.

THIS MONTH
${filtered ? `Matching ${body.filterLabel}: ${monthCount} of ${monthTotal} ${body.window} reviews.` : `Reviews: ${monthCount}.`} Average: ${body.stats.avgRating}/5. Sentiment: ${body.stats.sentiment}.

TOPICS
${topicBlock || "(none)"}

COMPETITORS
${rivalBlock || "(none pulled)"}

REVIEWS (${shown.length} of ${monthCount} matching, recent first)
${reviewBlock || "(none)"}

${prevBlock}

Return JSON:
- headline: one line for the cover (not a title case slogan).
- period: 3 to 5 short lines on how this month is doing. The first line MUST state ${filtered ? `${monthCount} of ${monthTotal} ${body.window} reviews match ${body.filterLabel}` : `exactly ${monthCount} reviews`}. If a previous month exists, compare matching counts, not the unfiltered month.
- mix: one line "Overall: Positive – X%  |  Neutral – Y%  |  Negative – Z%" using the given percentages.
- positive: 1 to 2 sentences on what they praise, named themes.
- negative: 1 to 2 sentences on the main concern (fairness, payouts, support, etc.).
- watch: up to 5 issues that have risen or keep recurring. Each one sentence.
- changed: vs the previous report only — what moved, new issues, anything that got worse. Empty array if none.
- competitor: 3 to 6 short lines for the competitors slide (TrustScore lead, website/UX/trust themes). Empty if no competitor data.
- wins / pains: up to 5 each, a theme plus a short quoted fragment.
- actions: up to 5 concrete moves — how to improve, what to fix first.
- commentary: one or two sentences per slide, explaining what the page is showing. topics = what the topic bars say and any spike. comments = what the quotes prove. competitors = who is ahead and why it matters. charts = what the month graph is doing (up, down, flat, a spike). keywords = which words are loud. actions = threats and the biggest concern.
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
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        text: {
          format: { type: "json_schema", name: "grace_briefing", schema: SCHEMA, strict: true },
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      const friendly = /insufficient_quota|credit/i.test(detail)
        ? "OpenAI credits are exhausted — top up to generate the briefing."
        : `OpenAI failed (${res.status}).`;
      return NextResponse.json({ error: friendly }, { status: 502 });
    }
    const data = await res.json();
    const message = data.output?.find((o: { type: string }) => o.type === "message");
    const text = message?.content?.find((c: { type: string }) => c.type === "output_text")?.text;
    if (!text) throw new Error("OpenAI returned no output text");
    const parsed = JSON.parse(text) as SavedReportSummary;
    const summary: SavedReportSummary = {
      headline: clean(parsed.headline),
      period: cleanList(parsed.period ?? []),
      mix: clean(parsed.mix ?? ""),
      positive: clean(parsed.positive ?? ""),
      negative: clean(parsed.negative ?? ""),
      watch: cleanList(parsed.watch ?? []),
      changed: cleanList(parsed.changed ?? []),
      competitor: cleanList(parsed.competitor ?? []),
      wins: cleanList(parsed.wins ?? []),
      pains: cleanList(parsed.pains ?? []),
      actions: cleanList(parsed.actions ?? []),
      commentary: {
        topics: clean(parsed.commentary?.topics ?? EMPTY_COMMENTARY.topics),
        comments: clean(parsed.commentary?.comments ?? EMPTY_COMMENTARY.comments),
        competitors: clean(parsed.commentary?.competitors ?? EMPTY_COMMENTARY.competitors),
        charts: clean(parsed.commentary?.charts ?? EMPTY_COMMENTARY.charts),
        keywords: clean(parsed.commentary?.keywords ?? EMPTY_COMMENTARY.keywords),
        actions: clean(parsed.commentary?.actions ?? EMPTY_COMMENTARY.actions),
      },
    };
    return NextResponse.json({ summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Summary failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
