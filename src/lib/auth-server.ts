import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase-server";

export { EmailNotVerifiedError, isEmailVerified, markEmailVerified, requireEmailVerified } from "./email-verification";

/** The signed-in user for the current request (API route / server
 * component), read from the Supabase auth cookies. Null when logged out. */
export async function currentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Route handlers can't always write cookies; the proxy refreshes
        // sessions, so silently skipping writes here is safe.
        setAll: (all) => {
          try {
            all.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
  const { data } = await client.auth.getUser();
  return data.user ?? null;
}

/** Like currentUser but throws a typed error for API routes to map to 401. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new AuthError();
  return user;
}

export class AuthError extends Error {
  constructor() {
    super("You need to log in to do this.");
    this.name = "AuthError";
  }
}

export type Plan = "free" | "pro";

/** The user's plan; profiles are auto-created by a DB trigger on signup. */
export async function planFor(userId: string): Promise<Plan> {
  const { data } = await supabase()
    .from("ps_profiles")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.plan === "pro" ? "pro" : "free";
}

/** How many reports a plan may create. */
export const PLAN_PROJECT_LIMIT: Record<Plan, number> = {
  free: 1,
  pro: Number.POSITIVE_INFINITY,
};
