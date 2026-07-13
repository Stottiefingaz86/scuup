import { NextResponse, type NextRequest } from "next/server";
import {
  AuthError,
  isAdminUser,
  PLAN_ACTIVE_PROJECT_LIMIT,
  PLAN_COMPETITOR_LIMIT,
  PLAN_PROJECT_LIMIT,
  planFor,
  requireUser,
} from "@/lib/auth-server";
import { journeyAllowedOnPlan } from "@/lib/plan";
import {
  activeProject,
  archiveAllActiveProjects,
  countActiveProjects,
  countProjects,
  insertProject,
  listProjects,
} from "@/lib/project-db";
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
    const replaceActive = body.replaceActive === true;
    if (!project?.id || !project.name || !Array.isArray(project.brands)) {
      return NextResponse.json({ error: "invalid project" }, { status: 400 });
    }

    const admin = isAdminUser(user);

    if (replaceActive) {
      await archiveAllActiveProjects(user.id);
    }

    const [plan, count, activeCount, active] = await Promise.all([
      planFor(user.id),
      countProjects(user.id),
      countActiveProjects(user.id),
      admin ? Promise.resolve(null) : activeProject(user.id),
    ]);
    if (count >= PLAN_PROJECT_LIMIT[plan]) {
      return NextResponse.json(
        {
          error:
            plan === "free"
              ? "Free accounts include one report with no updates. Upgrade to run competitive audits."
              : "You've reached the report limit on your plan. Archive a report or upgrade.",
          code: "limit_reached",
        },
        { status: 402 }
      );
    }
    if (!admin && activeCount >= PLAN_ACTIVE_PROJECT_LIMIT[plan]) {
      const activeLimit = PLAN_ACTIVE_PROJECT_LIMIT[plan];
      return NextResponse.json(
        {
          error:
            activeLimit === 1
              ? `"${active?.name ?? "Your report"}" is still active. Archive it to start a new one — your plan includes one live report.`
              : `You have ${activeCount} active reports (limit ${activeLimit}). Archive one to start another.`,
          code: "active_report_exists",
          activeProjectId: active?.id ?? null,
        },
        { status: 409 }
      );
    }

    const competitorCount = project.brands.filter(
      (b) => b.role === "competitor"
    ).length;
    if (competitorCount > PLAN_COMPETITOR_LIMIT[plan]) {
      return NextResponse.json(
        {
          error:
            plan === "free"
              ? "Free reports score your brand only. Upgrade to Pro to add up to 4 competitors."
              : "Each report supports up to 4 competitors.",
          code: "limit_reached",
        },
        { status: 402 }
      );
    }
    const blockedJourney = (project.journeys ?? []).find(
      (j) => !journeyAllowedOnPlan(plan, j)
    );
    if (blockedJourney) {
      return NextResponse.json(
        {
          error:
            "That journey is a Pro feature. Free audits cover first impression, casino and sports.",
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
