import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth-server";
import {
  activeProject,
  ownsProject,
  setProjectArchived,
} from "@/lib/project-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Archive (pause) or reactivate a report. Only one report may be
 * active per account, so reactivating requires every other report to
 * already be archived. */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/archive">
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    if (!(await ownsProject(id, user.id))) {
      return NextResponse.json({ error: "not your project" }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const archived = body.archived !== false;

    if (!archived) {
      const active = await activeProject(user.id);
      if (active && active.id !== id) {
        return NextResponse.json(
          {
            error: `"${active.name}" is already active. Archive it first — plans currently include one active report.`,
            code: "active_report_exists",
            activeProjectId: active.id,
          },
          { status: 409 }
        );
      }
    }

    await setProjectArchived(id, archived);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to update project";
    console.error("[projects] archive failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
