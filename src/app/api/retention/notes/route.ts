import { NextResponse, type NextRequest } from "next/server";
import { extractRetentionNotesFromShots } from "@/lib/analyst";
import type { RetentionContext } from "@/lib/retention-scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const retention =
      body.retention && typeof body.retention === "object"
        ? (body.retention as Record<string, number | null>)
        : null;
    const screenshots = Array.isArray(body.screenshots)
      ? body.screenshots.filter((s: unknown) => typeof s === "string")
      : [];
    const ctx: RetentionContext = {
      loggedIn: body.loggedIn === true,
      fromSession: body.fromSession === true,
    };
    if (!retention || screenshots.length === 0) {
      return NextResponse.json(
        { error: "retention and screenshots required" },
        { status: 400 }
      );
    }
    const retentionNotes = await extractRetentionNotesFromShots(
      retention,
      ctx,
      screenshots
    );
    return NextResponse.json({ retentionNotes });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "retention notes extract failed";
    console.error("[retention/notes]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
