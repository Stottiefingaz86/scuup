import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { markEmailVerified } from "@/lib/email-verification";

/** Completes email-confirmation / OAuth / verification flows. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
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
      const dest = new URL(next, url.origin);
      if (markVerified) dest.searchParams.set("verified", "1");
      return NextResponse.redirect(dest);
    }
  }
  return NextResponse.redirect(new URL("/login", url.origin));
}
