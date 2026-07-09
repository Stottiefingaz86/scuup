import { NextResponse, type NextRequest } from "next/server";
import { buildActionPlan } from "@/lib/action-plan";
import { requireUser } from "@/lib/auth-server";
import { listProjects, saveActionPlan } from "@/lib/project-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Synthesise (or re-synthesise) the prioritised action plan from every
 * successful analysis in the project, and persist it. */
export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/action-plan">
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = (await listProjects(user.id)).find((p) => p.id === id);
    if (!project) {
      return NextResponse.json({ error: "project not found" }, { status: 404 });
    }
    const plan = await buildActionPlan(project);
    await saveActionPlan(id, plan);
    return NextResponse.json({ plan });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "failed to build action plan";
    console.error("[action-plan] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
