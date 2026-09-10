import { NextResponse, type NextRequest } from "next/server";
import { startResearchTeardown } from "@/lib/research/teardown-runtime";
import type { ResearchDevice, ResearchPersona } from "@/lib/research/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/** Start deposit walks for multiple brands. Each pauses at awaiting_payment. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectId =
      typeof body.projectId === "string" ? body.projectId : "";
    const market =
      typeof body.market === "string" ? body.market : "United Kingdom";
    const device: ResearchDevice =
      body.device === "mobile" ? "mobile" : "desktop";
    const persona =
      body.persona && typeof body.persona === "object"
        ? (body.persona as ResearchPersona)
        : null;
    const brands = Array.isArray(body.brands) ? body.brands : [];

    if (!projectId || brands.length === 0) {
      return NextResponse.json(
        { error: "projectId and brands[] required" },
        { status: 400 }
      );
    }

    const started: {
      brandId: string;
      brandName: string;
      jobId: string;
      runId: string;
      liveViewUrl: string | null;
    }[] = [];

    for (const b of brands) {
      const brandId = typeof b.brandId === "string" ? b.brandId : "";
      const brandName = typeof b.brandName === "string" ? b.brandName : "Brand";
      const brandUrl = typeof b.brandUrl === "string" ? b.brandUrl : "";
      const runId =
        typeof b.runId === "string" ? b.runId : crypto.randomUUID();
      if (!brandId || !/^https?:\/\//.test(brandUrl)) continue;

      const { jobId, liveViewUrl } = await startResearchTeardown({
        runId,
        projectId,
        brandId,
        brandName,
        brandUrl,
        market,
        device,
        kind: "new_player_first_bet",
        persona,
        throughStage: "first_bet",
      });
      started.push({ brandId, brandName, jobId, runId, liveViewUrl });

      // Stagger Browserbase session creates.
      await new Promise((r) => setTimeout(r, 4000));
    }

    return NextResponse.json({ started });
  } catch (e) {
    const message = e instanceof Error ? e.message : "batch deposit failed";
    console.error("[research/batch-deposit]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
