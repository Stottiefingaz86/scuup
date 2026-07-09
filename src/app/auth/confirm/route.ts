import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { appHomePathForUser } from "@/lib/app-home";
import { appOriginFromRequest } from "@/lib/app-url";
import { markEmailVerified } from "@/lib/email-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Confirmation-link landing: verifies the token server-side (standard
 * Supabase SSR flow), sets session cookies, marks the inbox verified, and
 * drops the user in the app. Email templates point here via token_hash. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = appOriginFromRequest(request);
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "email") as EmailOtpType;
  const nextParam = url.searchParams.get("next");

  if (!tokenHash) {
    return NextResponse.redirect(new URL("/login", origin));
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
    type,
    token_hash: tokenHash,
  });

  if (error || !data.user) {
    const login = new URL("/login", origin);
    login.searchParams.set(
      "error",
      "That confirmation link is invalid or has expired — log in and we'll send you a fresh one."
    );
    return NextResponse.redirect(login);
  }

  await markEmailVerified(data.user.id);

  const next = nextParam ?? (await appHomePathForUser(data.user.id));
  const dest = new URL(next, origin);
  dest.searchParams.set("verified", "1");
  return NextResponse.redirect(dest);
}
