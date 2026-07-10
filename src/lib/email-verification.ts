import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase-server";

/** True when the user has clicked their verification link. */
export async function isEmailVerified(userId: string): Promise<boolean> {
  const { data } = await supabase()
    .from("ps_profiles")
    .select("email_verified_at")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data?.email_verified_at);
}

export async function markEmailVerified(userId: string): Promise<void> {
  // Upsert, not update: if the signup trigger hasn't created the profile
  // row yet, an update would silently no-op and the user would stay stuck
  // in the "confirm your email" loop forever.
  await supabase()
    .from("ps_profiles")
    .upsert(
      { user_id: userId, email_verified_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
}

/** Supabase auth confirmed_at is set when we grant login after signup — we
 * track analysis access separately on ps_profiles.email_verified_at. */
export async function requireEmailVerified(user: User): Promise<void> {
  if (await isEmailVerified(user.id)) return;
  throw new EmailNotVerifiedError();
}

export class EmailNotVerifiedError extends Error {
  code = "email_not_verified" as const;
  constructor() {
    super("Confirm your email before running analysis.");
    this.name = "EmailNotVerifiedError";
  }
}
