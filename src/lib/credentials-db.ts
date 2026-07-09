import { decryptSecret, encryptSecret } from "./crypto";
import { supabase } from "./supabase-server";

/** What the client is allowed to see — never the secrets themselves. */
export interface CredentialStatus {
  brandId: string;
  email: string | null;
  username: string | null;
  hasPassword: boolean;
  notes: string | null;
  hasContext: boolean;
  loggedInAt: string | null;
}

/** Decrypted credentials for server-side agent use only. */
export interface BrandCredentials {
  email: string | null;
  username: string | null;
  password: string | null;
  contextId: string | null;
}

interface Row {
  brand_id: string;
  email: string | null;
  username: string | null;
  password_enc: string | null;
  notes: string | null;
  browserbase_context_id: string | null;
  logged_in_at: string | null;
}

export async function getCredentialStatus(
  brandId: string
): Promise<CredentialStatus> {
  const { data, error } = await supabase()
    .from("ps_brand_credentials")
    .select("*")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as Row | null;
  return {
    brandId,
    email: row?.email ?? null,
    username: row?.username ?? null,
    hasPassword: Boolean(row?.password_enc),
    notes: row?.notes ?? null,
    hasContext: Boolean(row?.browserbase_context_id),
    loggedInAt: row?.logged_in_at ?? null,
  };
}

export async function listCredentialStatuses(
  brandIds: string[]
): Promise<CredentialStatus[]> {
  if (brandIds.length === 0) return [];
  const { data, error } = await supabase()
    .from("ps_brand_credentials")
    .select("*")
    .in("brand_id", brandIds);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  return brandIds.map((brandId) => {
    const row = rows.find((r) => r.brand_id === brandId) ?? null;
    return {
      brandId,
      email: row?.email ?? null,
      username: row?.username ?? null,
      hasPassword: Boolean(row?.password_enc),
      notes: row?.notes ?? null,
      hasContext: Boolean(row?.browserbase_context_id),
      loggedInAt: row?.logged_in_at ?? null,
    };
  });
}

export async function saveCredentials(
  brandId: string,
  input: {
    email?: string | null;
    username?: string | null;
    password?: string | null; // undefined = keep existing
    notes?: string | null;
  }
): Promise<void> {
  const patch: Record<string, unknown> = {
    brand_id: brandId,
    updated_at: new Date().toISOString(),
  };
  if (input.email !== undefined) patch.email = input.email;
  if (input.username !== undefined) patch.username = input.username;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.password !== undefined) {
    patch.password_enc = input.password ? encryptSecret(input.password) : null;
  }
  const { error } = await supabase()
    .from("ps_brand_credentials")
    .upsert(patch, { onConflict: "brand_id" });
  if (error) throw new Error(error.message);
}

/** Server-side only: full credentials for the login agent. */
export async function getCredentialsForLogin(
  brandId: string
): Promise<BrandCredentials> {
  const { data, error } = await supabase()
    .from("ps_brand_credentials")
    .select("*")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as Row | null;
  return {
    email: row?.email ?? null,
    username: row?.username ?? null,
    password: row?.password_enc ? decryptSecret(row.password_enc) : null,
    contextId: row?.browserbase_context_id ?? null,
  };
}

export async function saveBrandContext(
  brandId: string,
  contextId: string
): Promise<void> {
  const { error } = await supabase()
    .from("ps_brand_credentials")
    .upsert(
      {
        brand_id: brandId,
        browserbase_context_id: contextId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "brand_id" }
    );
  if (error) throw new Error(error.message);
}

export async function markLoggedIn(brandId: string): Promise<void> {
  const { error } = await supabase()
    .from("ps_brand_credentials")
    .update({ logged_in_at: new Date().toISOString() })
    .eq("brand_id", brandId);
  if (error) throw new Error(error.message);
}

/** The brand's persistent browser context id, or null. */
export async function getBrandContextId(
  brandId: string
): Promise<string | null> {
  const { data, error } = await supabase()
    .from("ps_brand_credentials")
    .select("browserbase_context_id")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.browserbase_context_id as string | null) ?? null;
}
