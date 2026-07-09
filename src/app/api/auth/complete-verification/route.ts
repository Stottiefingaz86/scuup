import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth-server";
import { markEmailVerified } from "@/lib/email-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Marks inbox verified after implicit-flow (#access_token) session is established. */
export async function POST() {
  try {
    const user = await requireUser();
    await markEmailVerified(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
