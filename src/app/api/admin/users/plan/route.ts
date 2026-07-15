import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { AuthError, isAdminUser, requireUser } from "@/lib/auth-server";
import { adminSetPlan } from "@/lib/admin-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manually set a user's plan (early customers, comps, support fixes). */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "admins only" }, { status: 403 });
    }
    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId : "";
    const plan = body.plan;
    if (!userId || !["free", "pro", "pro_plus"].includes(plan)) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    await adminSetPlan(userId, plan);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error("[admin/users/plan] failed:", e);
    Sentry.captureException(e, { tags: { route: "admin-plan" } });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
