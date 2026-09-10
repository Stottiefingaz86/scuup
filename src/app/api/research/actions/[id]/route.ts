import { NextResponse, type NextRequest } from "next/server";
import {
  cancelResearchAction,
  getResearchAction,
  patchResearchAction,
  removeResearchAction,
} from "@/lib/research/action-store";
import { cancelPaymentWait } from "@/lib/research/teardown-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Close a request the client already knows the outcome of — e.g. the
 * report's own run saw the deposit confirmation email while the request
 * still says "Confirming…" because the resumed job had a new id.
 */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/research/actions/[id]">,
) {
  const { id } = await ctx.params;
  const action = getResearchAction(id);
  if (!action) {
    return NextResponse.json({ error: "action not found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    status?: string;
    confirmedVia?: string;
    emailSubject?: string;
  };
  if (body.status !== "confirmed") {
    return NextResponse.json({ error: "unsupported patch" }, { status: 400 });
  }
  const via =
    body.confirmedVia === "email" || body.confirmedVia === "site"
      ? body.confirmedVia
      : "manual";
  const updated = patchResearchAction(id, {
    status: "confirmed",
    confirmedAt: action.confirmedAt ?? new Date().toISOString(),
    confirmedVia: action.confirmedVia ?? via,
    emailSubject:
      action.emailSubject ?? body.emailSubject?.slice(0, 200) ?? null,
  });
  return NextResponse.json({ ok: true, action: updated });
}

/** Dismiss a pending request (for deposits this also stops the paused
 * agent), or remove a finished one from the list for good. */
export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<"/api/research/actions/[id]">,
) {
  const { id } = await ctx.params;
  const action = getResearchAction(id);
  if (!action) {
    return NextResponse.json({ error: "action not found" }, { status: 404 });
  }
  const reason =
    request.nextUrl.searchParams.get("reason")?.slice(0, 120) || "Dismissed";

  const wasPending = action.status === "pending";
  if (!wasPending) {
    removeResearchAction(id);
    return NextResponse.json({ ok: true, action: null, removed: true });
  }
  const updated = cancelResearchAction(id, reason);
  let stoppedJob = false;
  if (wasPending && action.kind === "manual_deposit") {
    stoppedJob = cancelPaymentWait(
      action.jobId,
      `Deposit request dismissed — ${reason}`,
    );
  }

  return NextResponse.json({ ok: true, action: updated, stoppedJob });
}
