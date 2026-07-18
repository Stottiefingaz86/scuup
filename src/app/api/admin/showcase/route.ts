import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { AuthError, isAdminUser, requireUser } from "@/lib/auth-server";
import {
  listAdminShowcase,
  setShowcaseHomepage,
} from "@/lib/showcase-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await requireUser();
  if (!isAdminUser(user)) {
    const err = new Error("admins only");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return user;
}

/** All scored brands for the landing showcase, including hidden ones. */
export async function GET() {
  try {
    await requireAdmin();
    const entries = await listAdminShowcase();
    return NextResponse.json({ entries });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    if (e instanceof Error && (e as Error & { status?: number }).status === 403) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error("[admin/showcase] list failed:", e);
    Sentry.captureException(e, { tags: { route: "admin-showcase" } });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

/** Toggle whether a brand+market appears on the public homepage carousel. */
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const brandSlug =
      typeof body.brandSlug === "string" ? body.brandSlug.trim() : "";
    const market = typeof body.market === "string" ? body.market.trim() : "";
    const homepage = body.homepage;
    if (!brandSlug || !market || typeof homepage !== "boolean") {
      return NextResponse.json(
        { error: "brandSlug, market and homepage (boolean) required" },
        { status: 400 }
      );
    }
    await setShowcaseHomepage(brandSlug, market, homepage);
    return NextResponse.json({ ok: true, brandSlug, market, homepage });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    if (e instanceof Error && (e as Error & { status?: number }).status === 403) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error("[admin/showcase] toggle failed:", e);
    Sentry.captureException(e, { tags: { route: "admin-showcase" } });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
