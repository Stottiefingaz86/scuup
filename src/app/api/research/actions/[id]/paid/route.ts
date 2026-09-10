import { NextResponse, type NextRequest } from "next/server";
import {
  getResearchAction,
  patchResearchAction,
} from "@/lib/research/action-store";
import {
  getResearchTeardownJob,
  signalPaymentSent,
  type PaymentSignal,
} from "@/lib/research/teardown-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** You sent the crypto — resume the agent to watch for confirmation. */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/research/actions/[id]/paid">,
) {
  const { id } = await ctx.params;
  const action = getResearchAction(id);
  if (!action) {
    return NextResponse.json({ error: "action not found" }, { status: 404 });
  }
  if (action.kind !== "manual_deposit") {
    return NextResponse.json(
      { error: "not a deposit action" },
      { status: 400 },
    );
  }

  // mode "skip": test run — walk the post-payment flow without sending funds.
  const body = await request.json().catch(() => ({}));
  const mode: PaymentSignal = body?.mode === "skip" ? "skip" : "paid";

  if (mode === "paid") {
    patchResearchAction(id, {
      status: "payment_sent",
      paymentSentAt: new Date().toISOString(),
    });
  }

  const resumed = signalPaymentSent(action.jobId, mode);
  const job = getResearchTeardownJob(action.jobId);

  return NextResponse.json({
    ok: true,
    resumed,
    jobStatus: job?.status ?? "none",
  });
}
