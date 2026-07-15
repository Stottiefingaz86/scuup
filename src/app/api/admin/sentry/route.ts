import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { AuthError, isAdminUser, requireUser } from "@/lib/auth-server";
import { fetchSentryReport } from "@/lib/sentry-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "admins only" }, { status: 403 });
    }
    if (!process.env.SENTRY_AUTH_TOKEN?.trim()) {
      return NextResponse.json({ report: { configured: false } });
    }
    return NextResponse.json({ report: await fetchSentryReport() });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error("[admin/sentry] failed:", e);
    Sentry.captureException(e, { tags: { route: "admin-sentry" } });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
