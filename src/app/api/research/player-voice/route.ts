import { NextResponse, type NextRequest } from "next/server";
import {
  buildPlayerVoice,
  PLAYER_VOICE_WINDOW_MONTHS,
} from "@/lib/research/player-voice";
import { scrapeTrustpilot } from "@/lib/voc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Up to 15 Trustpilot pages behind Cloudflare, then one LLM synthesis.
export const maxDuration = 300;

/**
 * Voice of Player: read a brand's Trustpilot reviews from the last six
 * months and synthesise what players complain about, ask for and get stuck
 * on, cross-checked against the research journey the agent ran.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const brandUrl = typeof body.brandUrl === "string" ? body.brandUrl : "";
    const brandName =
      typeof body.brandName === "string" ? body.brandName : "Brand";
    const journeyContext =
      typeof body.journeyContext === "string"
        ? body.journeyContext.slice(0, 6000)
        : "";
    if (!brandUrl) {
      return NextResponse.json({ error: "brandUrl required" }, { status: 400 });
    }

    const scrape = await scrapeTrustpilot(brandUrl, {
      sinceMonths: PLAYER_VOICE_WINDOW_MONTHS,
      maxPages: 15,
    });
    const playerVoice = await buildPlayerVoice(
      brandName,
      scrape,
      journeyContext,
    );
    return NextResponse.json({ playerVoice });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Voice of Player analysis failed";
    console.error("[research/player-voice] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
