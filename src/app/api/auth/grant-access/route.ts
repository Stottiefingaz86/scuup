import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) {
    throw new Error("auth not configured");
  }
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { anon, admin: supabase() };
}

async function findUserIdByEmail(
  admin: ReturnType<typeof supabase>,
  email: string
): Promise<string | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 200) break;
    page += 1;
    if (page > 10) break;
  }
  return null;
}

/** Enables password sign-in right after signup when Supabase requires email
 * confirmation. Leaves ps_profiles.email_verified_at null until they verify. */
export async function POST(request: NextRequest) {
  let email = "";
  let password = "";
  let userId: string | undefined;
  try {
    const body = await request.json();
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    password = typeof body.password === "string" ? body.password : "";
    userId = typeof body.userId === "string" ? body.userId : undefined;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  let anon;
  let admin;
  try {
    ({ anon, admin } = authClients());
  } catch {
    return NextResponse.json({ error: "auth not configured" }, { status: 500 });
  }

  const { error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (!signInError) {
    await anon.auth.signOut();
    return NextResponse.json({ ok: true, alreadySignedIn: true });
  }

  const wrongPassword =
    signInError.message.toLowerCase().includes("invalid login") ||
    signInError.message.toLowerCase().includes("invalid credentials");
  if (wrongPassword) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  let resolvedUserId = userId;
  if (!resolvedUserId) {
    try {
      resolvedUserId = (await findUserIdByEmail(admin, email)) ?? undefined;
    } catch (e) {
      console.error("[grant-access] listUsers failed:", e);
      return NextResponse.json({ error: "could not find account" }, { status: 500 });
    }
  }

  if (!resolvedUserId) {
    return NextResponse.json(
      { error: "Account not found yet — wait a moment and try logging in." },
      { status: 404 }
    );
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(resolvedUserId, {
    email_confirm: true,
  });
  if (updateError) {
    console.error("[grant-access] updateUser failed:", updateError);
    return NextResponse.json({ error: "could not enable login" }, { status: 500 });
  }

  await admin
    .from("ps_profiles")
    .update({ email_verified_at: null })
    .eq("user_id", resolvedUserId);

  const { error: retryError } = await anon.auth.signInWithPassword({ email, password });
  if (retryError) {
    console.error("[grant-access] retry sign-in failed:", retryError);
    return NextResponse.json({ error: retryError.message }, { status: 500 });
  }
  await anon.auth.signOut();

  return NextResponse.json({ ok: true });
}
