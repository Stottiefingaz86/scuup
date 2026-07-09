import { NextResponse, type NextRequest } from "next/server";
import { upsertAnalysis } from "@/lib/project-db";
import type { JourneyAnalysis } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const brandId = typeof body.brandId === "string" ? body.brandId : "";
    const analysis = body.analysis as JourneyAnalysis | undefined;
    if (!brandId || !analysis?.area) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    await upsertAnalysis(brandId, analysis);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to save analysis";
    console.error("[projects] save analysis failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
