import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireUser } from "@/lib/auth-server";
import { MARKET_OPTIONS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Best-effort market availability for one brand, from licensing/geo
 * knowledge. Markets missing from both lists are unknown. */
export interface BrandMarketAvailability {
  url: string;
  blocked: string[];
  available: string[];
}

// Serverless instances are short-lived, but wizard back-and-forth within one
// warm instance shouldn't re-pay the model call per brand.
const store = globalThis as unknown as {
  __marketAvailability?: Map<string, BrandMarketAvailability>;
};
const cache = (store.__marketAvailability ??= new Map());

function hostnameOf(url: string): string | null {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return null;
  }
}

const SCHEMA = {
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
} as const;

async function lookupAvailability(
  urls: string[],
  markets: string[]
): Promise<BrandMarketAvailability[]> {
  const prompt = `You are an iGaming market-access expert. For each casino/sportsbook brand below, classify the listed markets by whether a player physically located there can actually use the site — considering the brand's licences (UKGC, MGA, AGCO/Ontario, US state licences, Curacao/Anjouan), its geo-blocking policy, and national bans. Crypto casinos (Stake, Rainbet, Roobet class) typically geo-block the UK, US, Netherlands, France, Spain, Italy, Germany, Australia and Ontario, while serving Canada (outside Ontario), Finland, Norway, Japan, New Zealand, Brazil and much of LatAm. Regulated operators (bet365, Betfair class) serve their licensed markets and block the rest.

Rules:
- "blocked": you are confident players there are geo-blocked or the brand holds no right to serve them.
- "available": you are confident the brand serves that market.
- OMIT markets you are not sure about — do not guess. Omitted = unknown.
- Use the market labels EXACTLY as given.
- If you don't recognise a brand at all, return empty lists for it.

Markets: ${markets.join(" | ")}

Brands: ${urls.join(", ")}`;

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
    (o: { type: string }) => o.type === "message"
  );
  const text = message?.content?.find(
    (c: { type: string }) => c.type === "output_text"
  )?.text;
  if (!text) throw new Error("OpenAI returned no output text");
  const parsed = JSON.parse(text) as { brands: BrandMarketAvailability[] };
  const valid = new Set(markets);
  return parsed.brands.map((b) => ({
    url: b.url,
    blocked: b.blocked.filter((m) => valid.has(m)),
    available: b.available.filter((m) => valid.has(m)),
  }));
}

export async function POST(request: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }

  let urls: string[] = [];
  try {
    const body = await request.json();
    if (Array.isArray(body.brands)) {
      urls = body.brands
        .filter((b: unknown): b is string => typeof b === "string")
        .slice(0, 4);
    }
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const hosts = urls
    .map((u) => ({ url: u, host: hostnameOf(u) }))
    .filter((h): h is { url: string; host: string } => h.host !== null);
  if (hosts.length === 0) {
    return NextResponse.json({ brands: [] });
  }

  // Only the geo-routed markets are worth classifying.
  const markets = MARKET_OPTIONS.filter((m) => m.geo).map((m) => m.label);

  const missing = hosts.filter((h) => !cache.has(h.host));
  if (missing.length > 0) {
    try {
      const fresh = await lookupAvailability(
        missing.map((h) => h.host),
        markets
      );
      for (const entry of fresh) {
        const host = hostnameOf(entry.url);
        if (host) cache.set(host, entry);
      }
    } catch (e) {
      console.error(
        "[market-availability] lookup failed:",
        e instanceof Error ? e.message : e
      );
      // Fall through — return what the cache has; unknown is a safe answer.
    }
  }

  return NextResponse.json({
    brands: hosts.map((h) => {
      const hit = cache.get(h.host);
      return {
        url: h.url,
        blocked: hit?.blocked ?? [],
        available: hit?.available ?? [],
      };
    }),
  });
}
