import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { deleteProject, ownsProject } from "@/lib/project-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/projects/[id]">
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    if (!(await ownsProject(id, user.id))) {
      return NextResponse.json({ error: "not your project" }, { status: 403 });
    }
    await deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to delete project";
    console.error("[projects] delete failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
