import { NextResponse, type NextRequest } from "next/server";
import {
  getResearchAction,
  patchResearchAction,
} from "@/lib/research/action-store";
import {
  getResearchTeardownJob,
  signalSmsCode,
} from "@/lib/research/teardown-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** You received the SMS — paste the code so the paused agent can continue. */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/research/actions/[id]/sms">
) {
  const { id } = await ctx.params;
  const action = getResearchAction(id);
  if (!action) {
    return NextResponse.json({ error: "action not found" }, { status: 404 });
  }
  if (action.kind !== "sms_assist") {
    return NextResponse.json({ error: "not an SMS assist action" }, { status: 400 });
  }

  let body: { code?: string } = {};
  try {
    body = (await request.json()) as { code?: string };
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }
  const code = String(body.code ?? "").replace(/\s+/g, "").trim();
  if (!code || code.length < 4) {
    return NextResponse.json(
      { error: "Paste the SMS code (at least 4 characters)" },
      { status: 400 }
    );
  }

  patchResearchAction(id, {
    status: "code_submitted",
    smsCode: code,
  });

  const resumed = signalSmsCode(action.jobId, code);
  const job = getResearchTeardownJob(action.jobId);

  return NextResponse.json({
    ok: true,
    resumed,
    jobStatus: job?.status ?? "none",
  });
}
