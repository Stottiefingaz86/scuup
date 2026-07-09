import { NextResponse, type NextRequest } from "next/server";
import { finishCapture } from "@/lib/capture-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** End a capture session and score every journey the user visited. */
export async function POST(request: NextRequest) {
  let sessionId = "";
  try {
    const body = await request.json();
    sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  try {
    const { analyses } = await finishCapture(sessionId);
    return NextResponse.json({ analyses });
  } catch (e) {
    const message = e instanceof Error ? e.message : "finish failed";
    console.error(`[capture] finish ${sessionId} failed:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
