import { NextResponse, type NextRequest } from "next/server";
import { PLAIN_PROSE_RULE, sanitizeProse } from "@/lib/prose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: { text: { type: "string" } },
} as const;

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set." }, { status: 503 });
  }
  try {
    const body = (await request.json()) as {
      text?: string;
      field?: string;
      brand?: string;
      note?: string;
      facts?: {
        month?: string;
        reviewCount?: number;
        avgRating?: number;
        sentiment?: number;
        filter?: string;
      };
    };
    const current = String(body.text ?? "").trim();
    if (!current) return NextResponse.json({ error: "Nothing to rewrite." }, { status: 400 });
    const facts = body.facts;
    const factBlock =
      facts && typeof facts.reviewCount === "number"
        ? `GROUND TRUTH — do not contradict:
- Month: ${facts.month ?? "this month"}
- Filter: ${facts.filter ?? "this filter"}
- Matching reviews this month: exactly ${facts.reviewCount}. Never write "one review" or "a single review" unless that number is 1.
- Average: ${facts.avgRating ?? "n/a"}/5. Sentiment: ${facts.sentiment ?? "n/a"}.
`
        : "";

    const prompt = `Rewrite this ${body.field ?? "briefing"} copy for a Trustpilot report on ${body.brand ?? "the brand"}.
Keep the same facts and numbers. Sharper, shorter. No new claims.
${factBlock}${body.note ? `Editor note: ${body.note}\n` : ""}
CURRENT
${current}

Return JSON { "text": "..." }. If the current text is several lines, keep it as several lines separated by newlines.
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
          format: { type: "json_schema", name: "grace_rewrite", schema: SCHEMA, strict: true },
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      const friendly = /insufficient_quota|credit/i.test(detail)
        ? "OpenAI credits are exhausted — top up to rewrite."
        : `OpenAI failed (${res.status}).`;
      return NextResponse.json({ error: friendly }, { status: 502 });
    }
    const data = await res.json();
    const message = data.output?.find((o: { type: string }) => o.type === "message");
    const text = message?.content?.find((c: { type: string }) => c.type === "output_text")?.text;
    if (!text) throw new Error("OpenAI returned no output text");
    const parsed = JSON.parse(text) as { text: string };
    return NextResponse.json({ text: sanitizeProse(parsed.text ?? "") });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Rewrite failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
