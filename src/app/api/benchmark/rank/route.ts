import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireUser } from "@/lib/auth-server";
import { brandSlugFromUrl } from "@/lib/showcase";
import { globalRankForScore } from "@/lib/showcase-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Where a CX score sits among every brand Scuup has scored. */
export async function GET(request: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }

  const { searchParams } = request.nextUrl;
  const scoreRaw = searchParams.get("score");
  const score = scoreRaw == null ? NaN : Number(scoreRaw);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return NextResponse.json(
      { error: "score must be a number 0–100" },
      { status: 400 }
    );
  }

  const market = searchParams.get("market") || undefined;
  const brandUrl = searchParams.get("brandUrl") || undefined;
  const brandSlug = brandUrl ? brandSlugFromUrl(brandUrl) : undefined;

  try {
    const rank = await globalRankForScore(score, { market, brandSlug });
    return NextResponse.json(rank);
  } catch (e) {
    const message = e instanceof Error ? e.message : "rank failed";
    console.error("[benchmark/rank]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
