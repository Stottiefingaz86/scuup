import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["labels"],
  properties: {
    labels: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "poker"],
        properties: {
          id: { type: "string" },
          poker: { type: "boolean" },
        },
      },
    },
  },
} as const;

/**
 * Decide whether an ambiguous Trustpilot review is actually about poker
 * (not casino, sportsbook, or the main site).
 */
export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set." }, { status: 503 });
  }
  try {
    const body = (await request.json()) as { reviews?: { id: string; snippet: string }[] };
    const reviews = (body.reviews ?? []).slice(0, 40);
    if (!reviews.length) return NextResponse.json({ labels: [] });

    const list = reviews.map((r, i) => `${i + 1}. ${r.snippet}`).join("\n");
    const prompt = `You label Trustpilot reviews for a gambling brand that sells poker AND casino, sportsbook, and a main website.

poker=true ONLY if the customer is clearly talking about the poker product. You need assuring context — not a single shared word.

Assuring: they name poker itself, or several poker-only terms together (rake, Hold'em, Omaha, sit & go, bad beat, KO/PKO, poker lobby, poker client, poker bonus, blinds + flop/turn/river as card streets).

poker=false when they mean any of these, even if a weak word appears:
- casino, slots, live dealer, sportsbook, or the brand's main website
- login / sign-in / app access on the main site — not the poker client or poker site
- promo / rewards / missions / jackpot / windfall on the main site or casino — not a poker bonus or poker promo
- wallet, transfer, deposit, withdraw with no cash-game or tournament context
- "turn" as in "my turn to withdraw", "turn around", "took a turn for the worse", or anything that is not the poker street
- one weak word (login, promo, rewards, lobby, jackpot, turn, flop, river, texas, bounty, freeroll, cash game) and the rest of the comment is about something else

If you are not sure it is the poker product, label poker=false.

Return one label per review id. Use the id exactly as given after the number.
${list}`;

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
        reasoning: { effort: "medium" },
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        text: {
          format: { type: "json_schema", name: "grace_poker_labels", schema: SCHEMA, strict: true },
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      const friendly = /insufficient_quota|credit/i.test(detail)
        ? "OpenAI credits are exhausted — top up to classify poker reviews."
        : `OpenAI failed (${res.status}).`;
      return NextResponse.json({ error: friendly }, { status: 502 });
    }
    const data = await res.json();
    const message = data.output?.find((o: { type: string }) => o.type === "message");
    const text = message?.content?.find((c: { type: string }) => c.type === "output_text")?.text;
    if (!text) throw new Error("OpenAI returned no output text");
    const parsed = JSON.parse(text) as { labels: { id: string; poker: boolean }[] };
    const known = new Set(reviews.map((r) => r.id));
    const labels = (parsed.labels ?? []).filter((l) => known.has(l.id));
    return NextResponse.json({ labels });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Classify failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}