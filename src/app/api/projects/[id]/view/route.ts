import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth-server";
import {
  canAccessProject,
  displayNameFromMeta,
  recordView,
} from "@/lib/collab-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read receipt — called when someone opens the report. */
export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/view">
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    if (!(await canAccessProject(id, user.id))) {
      return NextResponse.json({ error: "not your report" }, { status: 403 });
    }
    await recordView(id, {
      id: user.id,
      name: displayNameFromMeta(user),
      email: user.email ?? "",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to record view";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
