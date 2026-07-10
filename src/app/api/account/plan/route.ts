import { NextResponse } from "next/server";
import { AuthError, planFor, requireUser } from "@/lib/auth-server";
import { countProjects } from "@/lib/project-db";
import { PLAN_PROJECT_LIMIT } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const [plan, projectCount] = await Promise.all([
      planFor(user.id),
      countProjects(user.id),
    ]);
    return NextResponse.json({
      plan,
      projectCount,
      projectLimit:
        PLAN_PROJECT_LIMIT[plan] === Number.POSITIVE_INFINITY
          ? null
          : PLAN_PROJECT_LIMIT[plan],
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
