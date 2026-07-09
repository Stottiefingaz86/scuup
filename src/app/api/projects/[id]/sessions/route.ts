import { NextResponse, type NextRequest } from "next/server";
import { insertSession } from "@/lib/project-db";
import type { CaptureRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/sessions">
) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const record = body.record as CaptureRecord | undefined;
    if (!record?.id || !record.brandId) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    await insertSession(id, record);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to save session";
    console.error("[projects] save session failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
