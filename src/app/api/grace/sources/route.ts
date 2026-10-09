import { NextResponse, type NextRequest } from "next/server";
import { pullExtraMentions } from "@/lib/grace/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Reddit, Two Plus Two, and optional extra public URLs. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      slug?: string;
      displayName?: string;
      urls?: string[];
      reddit?: boolean;
      twoplustwo?: boolean;
    };
    const slug = String(body.slug ?? "").trim();
    const displayName = String(body.displayName ?? slug).trim();
    if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
    const result = await pullExtraMentions({
      slug,
      displayName,
      urls: Array.isArray(body.urls) ? body.urls.filter((u): u is string => typeof u === "string") : [],
      reddit: body.reddit !== false,
      twoplustwo: body.twoplustwo !== false,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Source pull failed";
    console.error("[grace/sources] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
