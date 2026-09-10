import { NextResponse, type NextRequest } from "next/server";
import {
  getResearchTeardownJob,
  pauseResearchJob,
} from "@/lib/research/teardown-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stop a long deposit watch (bank transfers can take a day). The agent
 * finishes its current check, snapshots, closes the browser and parks the
 * parks the job as "paused" — resume later, or Run again from Journeys.
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
  return NextResponse.json({
    ok,
    status: job.status,
    reason: ok
      ? null
      : `Job is ${job.status} — already finished`,
  });
}
