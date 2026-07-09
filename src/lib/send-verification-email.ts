import { authCallbackUrl, authEmailOrigin } from "./app-url";
import { supabase } from "./supabase-server";

/** Sends a confirmation link via Supabase Auth — proves inbox ownership for
 * analysis. The email template links to /auth/confirm (token_hash flow), so
 * emailRedirectTo is only a fallback for default templates. */
export async function sendVerificationEmail(email: string): Promise<void> {
  const redirectTo = authCallbackUrl(authEmailOrigin());
  const { error } = await supabase().auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo,
    },
  });
  if (error) throw error;
}
