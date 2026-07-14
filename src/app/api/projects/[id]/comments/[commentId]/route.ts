import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { deleteComment, getComment } from "@/lib/collab-db";
import { ownsProject } from "@/lib/project-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Authors can delete their own comments; the report admin can delete any. */
export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/comments/[commentId]">
) {
  try {
    const user = await requireUser();
    const { id, commentId } = await ctx.params;
    const comment = await getComment(commentId);
    if (!comment) {
      return NextResponse.json({ error: "comment not found" }, { status: 404 });
    }
    const isAuthor = comment.userId === user.id;
    if (!isAuthor && !(await ownsProject(id, user.id))) {
      return NextResponse.json({ error: "not allowed" }, { status: 403 });
    }
    await deleteComment(commentId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to delete comment";
    console.error("[comments] delete failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
