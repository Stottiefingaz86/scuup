import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireUser } from "@/lib/auth-server";
import { markEmailVerified } from "@/lib/email-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verifies the emailed 6-digit code — no link clicking, no redirects, the
 * user stays exactly where they were. */
export async function POST(request: NextRequest) {
  let code = "";
  try {
    const body = await request.json();
    code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!/^\d{4,10}$/.test(code)) {
    return NextResponse.json(
      { error: "Enter the code from the email." },
      { status: 400 }
    );
  }

  try {
    const user = await requireUser();
    if (!user.email) {
      return NextResponse.json({ error: "no email on account" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (all) =>
            all.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            ),
        },
      }
    );

    const { data, error } = await client.auth.verifyOtp({
      email: user.email,
      token: code,
      type: "email",
    });
    if (error || !data.user) {
      return NextResponse.json(
        {
          error:
            "That code didn't match — check the latest email or resend a fresh one.",
        },
        { status: 400 }
      );
    }

    await markEmailVerified(data.user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "verification failed";
    console.error("[verify-code]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
