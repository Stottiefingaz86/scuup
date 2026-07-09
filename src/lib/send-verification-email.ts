/** Sends a magic link via Supabase Auth — proves inbox ownership for analysis. */
export async function supabaseBrowserSendVerification(
  email: string,
  origin: string
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) {
    throw new Error("Auth is not configured.");
  }

  const redirectTo = `${origin}/auth/callback?verified=1`;

  const res = await fetch(`${url}/auth/v1/otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      email,
      create_user: false,
      options: { email_redirect_to: redirectTo },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `verification email failed (${res.status})`);
  }
}

/** Fire-and-forget after signup — best effort, never blocks dashboard access. */
export async function sendVerificationAfterSignup(
  email: string,
  origin: string
): Promise<void> {
  try {
    await supabaseBrowserSendVerification(email, origin);
  } catch (e) {
    console.warn("[signup] verification email failed:", e);
  }
}
