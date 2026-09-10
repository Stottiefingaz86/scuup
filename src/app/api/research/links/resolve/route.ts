import { NextResponse, type NextRequest } from "next/server";
import {
  classifyDestination,
  resolveEmailLink,
} from "@/lib/research/post-deposit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_URLS = 30;

/**
 * Follow CRM tracking links to their landing page and classify it (casino,
 * sportsbook, cashier, bonus…). Body: { items: [{ id, urls[] , hint? }] }.
 * Returns the same ids with resolved destinations, so the client can store
 * them on the email and the Days 1–14 view can say where each mail sends you.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.items)
    ? (body.items as { id?: unknown; urls?: unknown; hint?: unknown }[])
    : [];
  let budget = MAX_URLS;
  const out: {
    id: string;
    resolvedLinks: {
      url: string;
      resolved: string | null;
      destination: ReturnType<typeof classifyDestination>;
    }[];
  }[] = [];
  for (const item of items) {
    if (typeof item.id !== "string" || !Array.isArray(item.urls)) continue;
    const urls = item.urls
      .filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u))
      .slice(0, 4);
    const hint = typeof item.hint === "string" ? item.hint : "";
    const resolvedLinks = await Promise.all(
      urls.map(async (url) => {
        if (budget <= 0) {
          return { url, resolved: null, destination: classifyDestination(url, hint) };
        }
        budget -= 1;
        const resolved = await resolveEmailLink(url).catch(() => url);
        return {
          url,
          resolved: resolved === url ? null : resolved,
          destination: classifyDestination(resolved, hint),
        };
      }),
    );
    out.push({ id: item.id, resolvedLinks });
  }
  return NextResponse.json({ items: out });
}
