import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { appHomePathForUser } from "@/lib/app-home";
import { appOriginFromRequest } from "@/lib/app-url";
import { markEmailVerified } from "@/lib/email-verification";

/** Completes email-confirmation / OAuth / verification flows. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const authError = url.searchParams.get("error");
  if (authError) {
    const desc =
      url.searchParams.get("error_description") ??
      url.searchParams.get("error_code") ??
      authError;
    const login = new URL("/login", appOriginFromRequest(request));
    login.searchParams.set("error", desc);
    return NextResponse.redirect(login);
  }

  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const markVerified = url.searchParams.get("verified") === "1";

  if (code) {
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
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (!error && data.user && markVerified) {
      await markEmailVerified(data.user.id);
    }
    if (!error) {
      const next =
        nextParam ??
        (data.user ? await appHomePathForUser(data.user.id) : "/dashboard");
      const dest = new URL(next, appOriginFromRequest(request));
      if (markVerified) dest.searchParams.set("verified", "1");
      return NextResponse.redirect(dest);
    }
  }
  return NextResponse.redirect(new URL("/login", appOriginFromRequest(request)));
}
