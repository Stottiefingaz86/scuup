import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireUser } from "@/lib/auth-server";
import {
  addComment,
  canAccessProject,
  displayNameFromMeta,
  listComments,
} from "@/lib/collab-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(e: unknown, fallback: string) {
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
  const message = e instanceof Error ? e.message : fallback;
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/comments">
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    if (!(await canAccessProject(id, user))) {
      return NextResponse.json({ error: "not your report" }, { status: 403 });
    }
    return NextResponse.json({ comments: await listComments(id) });
  } catch (e) {
    console.error("[comments] list failed:", e);
    return errorResponse(e, "failed to load comments");
  }
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/comments">
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    if (!(await canAccessProject(id, user))) {
      return NextResponse.json({ error: "not your report" }, { status: 403 });
    }
    const payload = await request.json();
    const sectionId = String(payload.sectionId ?? "").trim();
    const body = String(payload.body ?? "").trim();
    if (!sectionId || !body) {
      return NextResponse.json({ error: "empty comment" }, { status: 400 });
    }
    if (body.length > 2000) {
      return NextResponse.json({ error: "comment too long" }, { status: 400 });
    }
    const comment = await addComment(
      id,
      sectionId,
      { id: user.id, name: displayNameFromMeta(user) },
      body
    );
    return NextResponse.json({ comment });
  } catch (e) {
    console.error("[comments] create failed:", e);
    return errorResponse(e, "failed to post comment");
  }
}
