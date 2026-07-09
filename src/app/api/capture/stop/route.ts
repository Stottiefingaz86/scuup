import { NextResponse, type NextRequest } from "next/server";
import { stopCapture } from "@/lib/capture-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let id = "";
  try {
    const body = await request.json();
    id = typeof body.sessionId === "string" ? body.sessionId : "";
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  await stopCapture(id);
  return NextResponse.json({ ok: true });
}
