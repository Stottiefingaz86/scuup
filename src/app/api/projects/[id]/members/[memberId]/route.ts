import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { inviteTokenFor, removeMember } from "@/lib/collab-db";
import { ownsProject } from "@/lib/project-db";
import { appOriginFromRequest } from "@/lib/app-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Re-fetch the invite link for a pending member (owner only). */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/members/[memberId]">
) {
  try {
    const user = await requireUser();
    const { id, memberId } = await ctx.params;
    if (!(await ownsProject(id, user.id))) {
      return NextResponse.json({ error: "not your report" }, { status: 403 });
    }
    const token = await inviteTokenFor(id, memberId);
    if (!token) {
      return NextResponse.json({ error: "invite not found" }, { status: 404 });
    }
    return NextResponse.json({
      inviteUrl: `${appOriginFromRequest(request)}/invite/${token}`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to load invite";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/members/[memberId]">
) {
  try {
    const user = await requireUser();
    const { id, memberId } = await ctx.params;
    if (!(await ownsProject(id, user.id))) {
      return NextResponse.json(
        { error: "Only the report admin can remove people." },
        { status: 403 }
      );
    }
    await removeMember(id, memberId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to remove member";
    console.error("[members] remove failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
