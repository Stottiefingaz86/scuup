import { NextResponse } from "next/server";
import { AuthError, isAdminUser, requireUser } from "@/lib/auth-server";
import { POSTHOG_KEY, SENTRY_DSN } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only: keys for the Systems panel copy buttons. Values never render
 * in the page; the client fetches them on demand after the admin gate. */
export async function GET() {
  try {
    const user = await requireUser();
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "admins only" }, { status: 403 });
    }

    const env = (name: string) => process.env[name]?.trim() || null;

    const credentials: Record<string, { label: string; value: string }[]> = {
      stripe: [
        env("STRIPE_SECRET_KEY")
          ? { label: "Secret key", value: env("STRIPE_SECRET_KEY")! }
          : null,
        env("STRIPE_WEBHOOK_SECRET")
          ? { label: "Webhook secret", value: env("STRIPE_WEBHOOK_SECRET")! }
          : null,
      ].filter((c): c is { label: string; value: string } => c !== null),
      posthog: [
        { label: "Project key", value: POSTHOG_KEY },
        { label: "Project ID", value: "224760" },
      ],
      sentry: [{ label: "DSN", value: SENTRY_DSN }],
      supabase: [
        env("SUPABASE_URL")
          ? { label: "URL", value: env("SUPABASE_URL")! }
          : null,
        env("SUPABASE_SECRET_KEY")
          ? { label: "Secret key", value: env("SUPABASE_SECRET_KEY")! }
          : null,
      ].filter((c): c is { label: string; value: string } => c !== null),
      browserbase: [
        env("BROWSERBASE_API_KEY")
          ? { label: "API key", value: env("BROWSERBASE_API_KEY")! }
          : null,
        env("BROWSERBASE_PROJECT_ID")
          ? { label: "Project ID", value: env("BROWSERBASE_PROJECT_ID")! }
          : null,
      ].filter((c): c is { label: string; value: string } => c !== null),
      openai: [
        env("OPENAI_API_KEY")
          ? { label: "API key", value: env("OPENAI_API_KEY")! }
          : null,
      ].filter((c): c is { label: string; value: string } => c !== null),
      resend: [
        env("RESEND_API_KEY")
          ? { label: "API key", value: env("RESEND_API_KEY")! }
          : null,
      ].filter((c): c is { label: string; value: string } => c !== null),
    };

    return NextResponse.json({ credentials });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
