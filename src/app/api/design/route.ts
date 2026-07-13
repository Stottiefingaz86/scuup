import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { buildDesignReview, extractDesignSignals } from "@/lib/design-review";
import { listProjects, upsertDesign } from "@/lib/project-db";

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
    const project = (await listProjects(user.id)).find(
      (p) => p.id === projectId
    );
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

    const signals = await extractDesignSignals(brand.url, project.market);
    const design = await buildDesignReview(project, brand, signals);
    await upsertDesign(brandId, design);
    return NextResponse.json({ design });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Design review failed";
    console.error("[design] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
