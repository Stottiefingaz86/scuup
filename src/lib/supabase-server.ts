import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Server-only Supabase client using the secret key — bypasses RLS.
 * All PlayerScope tables have RLS enabled with no policies, so this is
 * the only way in; the browser never talks to Supabase directly. */
let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured — set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local (dashboard > Settings > API keys > secret key)."
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
