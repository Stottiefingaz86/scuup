import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { isAdminUser, planFor, requireUser } from "@/lib/auth-server";
import { buildDesignReview, extractDesignSignals } from "@/lib/design-review";
import { getProjectById, listProjects, upsertDesign } from "@/lib/project-db";
import { enforceRunLimit, RunLimitError } from "@/lib/run-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Live page render + DOM measurement (~30-60s) + vision LLM review.
export const maxDuration = 300;

/** Read the brand's live rendered code, measure design/accessibility
 * signals, and build the designer's review against journey screenshots. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const brandId = typeof body.brandId === "string" ? body.brandId : "";
    if (!projectId || !brandId) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    let project = (await listProjects(user.id)).find(
      (p) => p.id === projectId
    );
    // Admins may run analyses on any report (support access).
    if (!project && isAdminUser(user)) {
      project = (await getProjectById(projectId)) ?? undefined;
    }
    const brand = project?.brands.find((b) => b.id === brandId);
    if (!project || !brand) {
      return NextResponse.json({ error: "not your project" }, { status: 403 });
    }
    if (project.status === "archived") {
      return NextResponse.json(
        { error: "This report is archived — reactivate it to run updates." },
        { status: 409 }
      );
    }

    await enforceRunLimit(
      user.id,
      "design",
      await planFor(user.id),
      isAdminUser(user)
    );

    const signals = await extractDesignSignals(brand.url, project.market);
    const design = await buildDesignReview(project, brand, signals);
    await upsertDesign(brandId, design);
    return NextResponse.json({ design });
  } catch (e) {
    if (e instanceof RunLimitError) {
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
    const message = e instanceof Error ? e.message : "Design review failed";
    console.error("[design] failed:", message);
    Sentry.captureException(e, { tags: { route: "design" } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
