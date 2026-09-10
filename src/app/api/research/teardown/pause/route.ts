import { NextResponse, type NextRequest } from "next/server";
import { releaseAllRunningSessions } from "@/lib/browserbase";
import {
  forceStopAllResearchJobs,
  pauseResearchJob,
} from "@/lib/research/teardown-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Force stop. Marks the job paused and kicks Browserbase release without
 * waiting — awaiting session teardown is what left Stop spinning.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  if (jobId) pauseResearchJob(jobId);
  const stopped = forceStopAllResearchJobs();
  // Must finish the Browserbase REQUEST_RELEASE before we return — a
  // fire-and-forget is dropped when the serverless isolate freezes.
  await Promise.race([
    releaseAllRunningSessions().catch(() => 0),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  return NextResponse.json({
    ok: true,
    stopped,
    status: "paused",
  });
}
