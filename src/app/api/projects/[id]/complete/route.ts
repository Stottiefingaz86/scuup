import { NextResponse, type NextRequest } from "next/server";
import { setProjectComplete } from "@/lib/project-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/complete">
) {
  try {
    const { id } = await ctx.params;
    await setProjectComplete(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to update project";
    console.error("[projects] complete failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
