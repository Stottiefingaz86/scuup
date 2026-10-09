import { NextResponse, type NextRequest } from "next/server";
import { pullRedditMentions } from "@/lib/grace/reddit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** Reddit mentions for /grace. Uses official API keys when set, otherwise
 * public search pages through Browserbase. Body: { slug, displayName }. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      slug?: string;
      displayName?: string;
    };
    const slug = String(body.slug ?? "").trim();
    const displayName = String(body.displayName ?? slug).trim();
    if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
    const result = await pullRedditMentions({ slug, displayName });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Reddit pull failed";
    console.error("[grace/reddit] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
