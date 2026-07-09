import { NextResponse, type NextRequest } from "next/server";
import {
  AuthError,
  PLAN_PROJECT_LIMIT,
  planFor,
  requireUser,
} from "@/lib/auth-server";
import { countProjects, insertProject, listProjects } from "@/lib/project-db";
import type { Project } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(e: unknown, fallback: string) {
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
  const message = e instanceof Error ? e.message : fallback;
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    const user = await requireUser();
    const projects = await listProjects(user.id);
    return NextResponse.json({ projects });
  } catch (e) {
    console.error("[projects] list failed:", e);
    return errorResponse(e, "failed to load projects");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const project = body.project as Project | undefined;
    if (!project?.id || !project.name || !Array.isArray(project.brands)) {
      return NextResponse.json({ error: "invalid project" }, { status: 400 });
    }

    const [plan, count] = await Promise.all([
      planFor(user.id),
      countProjects(user.id),
    ]);
    if (count >= PLAN_PROJECT_LIMIT[plan]) {
      return NextResponse.json(
        {
          error:
            "Free accounts include one report. Upgrade to create more audits.",
          code: "limit_reached",
        },
        { status: 402 }
      );
    }

    await insertProject(project, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[projects] create failed:", e);
    return errorResponse(e, "failed to save project");
  }
}
