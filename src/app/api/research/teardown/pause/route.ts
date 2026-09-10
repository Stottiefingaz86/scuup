import { NextResponse, type NextRequest } from "next/server";
import { releaseAllRunningSessions } from "@/lib/browserbase";
import {
  getResearchTeardownJob,
  pauseResearchJob,
} from "@/lib/research/teardown-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stop now. Releases the Browserbase session immediately — do not wait
 * for the current step (SMS / inbox / login) or billing keeps running.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }
  const job = getResearchTeardownJob(jobId);
  if (!job)
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  const ok = pauseResearchJob(jobId);
  const released = await releaseAllRunningSessions().catch(() => 0);
  return NextResponse.json({
    ok: ok || released > 0,
    status: job.status,
    released,
    reason: ok || released > 0 ? null : `Job is ${job.status} — already finished`,
  });
}
