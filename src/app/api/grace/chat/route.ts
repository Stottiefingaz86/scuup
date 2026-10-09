import { NextResponse, type NextRequest } from "next/server";
import { PLAIN_PROSE_RULE, sanitizeProse } from "@/lib/prose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "apply", "headline", "period", "positive", "negative", "mix"],
  properties: {
    reply: { type: "string" },
    apply: { type: "boolean" },
    headline: { type: "string" },
    period: { type: "string" },
    positive: { type: "string" },
    negative: { type: "string" },
    mix: { type: "string" },
  },
} as const;

interface ChatBody {
  message?: string;
  history?: { role: "user" | "assistant"; text: string }[];
  brand?: string;
  facts?: {
    month?: string;
    filter?: string;
    matchingCount?: number;
    monthTotal?: number;
    avgRating?: number;
    sentiment?: number;
    officialScore?: number | null;
    pokerScore?: number | null;
    pokerCount?: number;
    topics?: string[];
    current?: {
      headline?: string;
      period?: string[];
      positive?: string;
      negative?: string;
      mix?: string;
    };
  };
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set." }, { status: 503 });
  }
  try {
    const body = (await request.json()) as ChatBody;
    const message = String(body.message ?? "").trim();
    if (!message) return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
    const facts = body.facts ?? {};
    const matching = facts.matchingCount ?? 0;
    const monthTotal = facts.monthTotal ?? matching;
    const filtered = Boolean(facts.filter && facts.filter !== "All reviews" && monthTotal !== matching);
    const current = facts.current ?? {};
    const history = (body.history ?? [])
      .slice(-8)
      .map((m) => `${m.role === "user" ? "User" : "Grace"}: ${m.text}`)
      .join("\n");

    const prompt = `You are the analyst sitting next to a Trustpilot VoC report on ${body.brand ?? "this brand"}.
Answer questions about what the numbers and briefing mean. If the user asks you to change, rewrite, shorten, or fix the briefing, set apply=true and fill the fields they want changed. Leave a field as an empty string if you are not changing it.

HARD FACTS — never contradict:
- Month: ${facts.month ?? "this month"}
- Filter: ${facts.filter ?? "All reviews"}
- ${filtered ? `Exactly ${matching} of ${monthTotal} ${facts.month ?? "this month"} reviews match "${facts.filter}". The briefing is about those ${matching}, not all ${monthTotal}.` : `${matching} reviews in ${facts.month ?? "this month"}.`}
- Official TrustScore (whole brand, all products): ${facts.officialScore ?? "n/a"}
- Poker score (poker reviews, last 12 months): ${facts.pokerScore ?? "n/a"} from ${facts.pokerCount ?? 0} poker reviews
- Matching-set average: ${facts.avgRating ?? "n/a"}/5
- Do not cite the sentiment score (${facts.sentiment ?? "n/a"}). Say how many reviews are 1-2 star or 4-5 star.
- Topics: ${(facts.topics ?? []).join("; ") || "none"}

CURRENT BRIEFING
Headline: ${current.headline || "(none)"}
Period:
${(current.period ?? []).join("\n") || "(none)"}
Positive: ${current.positive || "(none)"}
Negative: ${current.negative || "(none)"}
Mix: ${current.mix || "(none)"}

${history ? `RECENT CHAT\n${history}\n` : ""}
USER
${message}

Return JSON:
- reply: 2 to 6 short sentences. Explain first. If you change copy, say what you changed.
- apply: true only when the user asked to change the briefing text.
- headline / period / positive / negative / mix: new text, or "" to leave as-is. period is newline-separated lines. Do not repeat "${matching} of ${monthTotal} match ${facts.filter}". If there is no praise, leave positive empty. Never write "there is no positive feedback".
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
          format: { type: "json_schema", name: "grace_chat", schema: SCHEMA, strict: true },
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      const friendly = /insufficient_quota|credit/i.test(detail)
        ? "OpenAI credits are exhausted — top up to chat."
        : `OpenAI failed (${res.status}).`;
      return NextResponse.json({ error: friendly }, { status: 502 });
    }
    const data = await res.json();
    const block = data.output?.find((o: { type: string }) => o.type === "message");
    const text = block?.content?.find((c: { type: string }) => c.type === "output_text")?.text;
    if (!text) throw new Error("OpenAI returned no output text");
    const parsed = JSON.parse(text) as {
      reply: string;
      apply: boolean;
      headline: string;
      period: string;
      positive: string;
      negative: string;
      mix: string;
    };
    return NextResponse.json({
      reply: sanitizeProse(parsed.reply ?? ""),
      apply: Boolean(parsed.apply),
      headline: sanitizeProse(parsed.headline ?? ""),
      period: sanitizeProse(parsed.period ?? ""),
      positive: sanitizeProse(parsed.positive ?? ""),
      negative: sanitizeProse(parsed.negative ?? ""),
      mix: sanitizeProse(parsed.mix ?? ""),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chat failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
