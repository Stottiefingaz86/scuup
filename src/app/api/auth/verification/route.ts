import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireUser } from "@/lib/auth-server";
import { isEmailVerified } from "@/lib/email-verification";
import { supabaseBrowserSendVerification } from "@/lib/send-verification-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const verified = await isEmailVerified(user.id);
    return NextResponse.json({
      email: user.email,
      emailVerified: verified,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (await isEmailVerified(user.id)) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }
    const origin = new URL(request.url).origin;
    const email = user.email;
    if (!email) {
      return NextResponse.json({ error: "no email on account" }, { status: 400 });
    }
    await supabaseBrowserSendVerification(email, origin);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "failed to send email";
    console.error("[send-verification]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
