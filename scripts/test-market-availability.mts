// Sanity-check the market-availability prompt for a few known brands.
// Run: npx tsx scripts/test-market-availability.mts [url ...]
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const { MARKET_OPTIONS } = await import("../src/lib/constants");
const markets = MARKET_OPTIONS.filter((m) => m.geo).map((m) => m.label);
const brands =
  process.argv.length > 2
    ? process.argv.slice(2)
    : ["stake.com", "rainbet.com", "bet365.com"];

const prompt = `You are an iGaming market-access expert. For each casino/sportsbook brand below, classify the listed markets by whether a player physically located there can actually use the site — considering the brand's licences (UKGC, MGA, AGCO/Ontario, US state licences, Curacao/Anjouan), its geo-blocking policy, and national bans. Crypto casinos (Stake, Rainbet, Roobet class) typically geo-block the UK, US, Netherlands, France, Spain, Italy, Germany, Australia and Ontario, while serving Canada (outside Ontario), Finland, Norway, Japan, New Zealand, Brazil and much of LatAm. Regulated operators (bet365, Betfair class) serve their licensed markets and block the rest.

Rules:
- "blocked": you are confident players there are geo-blocked or the brand holds no right to serve them.
- "available": you are confident the brand serves that market.
- OMIT markets you are not sure about — do not guess. Omitted = unknown.
- Use the market labels EXACTLY as given.
- If you don't recognise a brand at all, return empty lists for it.

Markets: ${markets.join(" | ")}

Brands: ${brands.join(", ")}`;

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
      format: {
        type: "json_schema",
        name: "market_availability",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            brands: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  url: { type: "string" },
                  blocked: { type: "array", items: { type: "string" } },
                  available: { type: "array", items: { type: "string" } },
                },
                required: ["url", "blocked", "available"],
              },
            },
          },
          required: ["brands"],
        },
      },
    },
  }),
});
if (!res.ok) {
  console.error("OpenAI failed:", res.status, await res.text());
  process.exit(1);
}
const data = await res.json();
const text = data.output
  ?.find((o: { type: string }) => o.type === "message")
  ?.content?.find((c: { type: string }) => c.type === "output_text")?.text;
for (const b of JSON.parse(text).brands) {
  console.log("\n==", b.url);
  console.log("blocked:", b.blocked.join(", ") || "(none)");
  console.log("available:", b.available.join(", ") || "(none)");
}
