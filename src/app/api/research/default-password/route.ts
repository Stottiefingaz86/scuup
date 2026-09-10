import { NextResponse } from "next/server";
import { defaultTestPassword } from "@/lib/test-persona";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The shared test-account password (TEST_ACCOUNT_PASSWORD). Every brand the
 * agent registered without a persona password used this one, so the account
 * cards can show it for manual login on runs that predate per-brand saving.
 */
export async function GET() {
  try {
    return NextResponse.json({ password: defaultTestPassword() });
  } catch {
    return NextResponse.json({ password: null });
  }
}
