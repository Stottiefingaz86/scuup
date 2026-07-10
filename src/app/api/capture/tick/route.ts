import { NextResponse, type NextRequest } from "next/server";
import { captureTick } from "@/lib/capture-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One observation pass over a live capture session. The popup client polls
 * this every few seconds, sending back the state it accumulated (balances,
 * last URL) — the server holds nothing between calls, so any serverless
 * instance can serve any tick.
 */
export async function POST(request: NextRequest) {
  let sessionId = "";
  let balances: string[] = [];
  let lastUrl = "";
  let wantShot = false;
  try {
    const body = await request.json();
    sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    if (Array.isArray(body.balances)) {
      balances = body.balances.filter((b: unknown) => typeof b === "string");
    }
    if (typeof body.lastUrl === "string") lastUrl = body.lastUrl;
    wantShot = body.wantShot === true;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  try {
    const result = await captureTick(sessionId, balances, lastUrl, wantShot);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "tick failed";
    // A released / timed-out session is expected at the end of a capture —
    // tell the client to stop polling rather than surfacing an error.
    const gone = /is (COMPLETED|STOPPED|ERROR)|not found|404/i.test(message);
    return NextResponse.json({ error: message }, { status: gone ? 410 : 500 });
  }
}
