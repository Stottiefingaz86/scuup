import { NextResponse, type NextRequest } from "next/server";
import { rejectIfNewReportsLocked } from "@/lib/prod-locks";
import { startResearchTeardown } from "@/lib/research/teardown-runtime";
import type { ResearchDevice, ResearchPersona } from "@/lib/research/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * Queue signup+verify for multiple brands. Returns job ids — client polls each.
 * Runs are started in parallel (Browserbase may rate-limit; client can retry).
 */
export async function POST(request: NextRequest) {
  const locked = rejectIfNewReportsLocked();
  if (locked) return locked;
  try {
    const body = await request.json();
    const projectId =
      typeof body.projectId === "string" ? body.projectId : "";
    const market = typeof body.market === "string" ? body.market : "United Kingdom";
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
        throughStage: "verification",
      });
      started.push({ brandId, brandName, jobId, runId, liveViewUrl });
    }

    return NextResponse.json({ started });
  } catch (e) {
    const message = e instanceof Error ? e.message : "batch signup failed";
    console.error("[research/batch-signup]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
