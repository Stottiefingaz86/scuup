import { NextResponse, type NextRequest } from "next/server";
import { extractFeaturesFromShots } from "@/lib/analyst";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const journey = typeof body.journey === "string" ? body.journey : "landing";
    const screenshots = Array.isArray(body.screenshots)
      ? body.screenshots.filter((s: unknown) => typeof s === "string")
      : [];
    if (screenshots.length === 0) {
      return NextResponse.json(
        { error: "screenshots required" },
        { status: 400 }
      );
    }
    const features = await extractFeaturesFromShots(journey, screenshots);
    return NextResponse.json({ features });
  } catch (e) {
    const message = e instanceof Error ? e.message : "feature extract failed";
    console.error("[features/extract]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
