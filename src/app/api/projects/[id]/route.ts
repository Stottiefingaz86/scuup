import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { canAccessProject } from "@/lib/collab-db";
import { deleteProject, getProjectById, ownsProject } from "@/lib/project-db";
import { sanitizeProject } from "@/lib/prose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One report by id, for owners, invited viewers, and admins. Lets
 * mission control open any user's report without it being in the
 * admin's own project list. */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/projects/[id]">
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    if (!(await canAccessProject(id, user))) {
      return NextResponse.json({ error: "not your project" }, { status: 403 });
    }
    const project = await getProjectById(id);
    if (!project) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ project: sanitizeProject(project) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to load project";
    console.error("[projects] get failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
