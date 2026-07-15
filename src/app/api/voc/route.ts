import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { isAdminUser, planFor, requireUser } from "@/lib/auth-server";
import { listProjects, upsertVoc } from "@/lib/project-db";
import { enforceRunLimit, RunLimitError } from "@/lib/run-limits";
import { buildVocAnalysis, scrapeTrustpilot } from "@/lib/voc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Scrape (~30-60s incl. Cloudflare clearance) + LLM analysis.
export const maxDuration = 300;

/** Scrape a brand's Trustpilot reviews and build its voice-of-customer
 * analysis, cross-checked against the audit. */
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

    await enforceRunLimit(
      user.id,
      "voc",
      await planFor(user.id),
      isAdminUser(user)
    );

    const scrape = await scrapeTrustpilot(brand.url);
    const voc = await buildVocAnalysis(project, brand, scrape);
    await upsertVoc(brandId, voc);
    return NextResponse.json({ voc });
  } catch (e) {
    if (e instanceof RunLimitError) {
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
    const message = e instanceof Error ? e.message : "VoC analysis failed";
    console.error("[voc] failed:", message);
    Sentry.captureException(e, { tags: { route: "voc" } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
