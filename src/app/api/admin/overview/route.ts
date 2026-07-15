import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { AuthError, isAdminUser, requireUser } from "@/lib/auth-server";
import { adminListUsers, adminStats } from "@/lib/admin-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything mission control needs in one call: stats + users. */
export async function GET() {
  try {
    const user = await requireUser();
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "admins only" }, { status: 403 });
    }
    const [stats, users] = await Promise.all([adminStats(), adminListUsers()]);
    return NextResponse.json({ stats, users });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error("[admin/overview] failed:", e);
    Sentry.captureException(e, { tags: { route: "admin-overview" } });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
