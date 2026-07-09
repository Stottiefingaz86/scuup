import { NextResponse, type NextRequest } from "next/server";
import { getCredentialStatus, saveCredentials } from "@/lib/credentials-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Status only — secrets never leave the server. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/brands/[id]/credentials">
) {
  try {
    const { id } = await ctx.params;
    const status = await getCredentialStatus(id);
    return NextResponse.json(status);
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to load credentials";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/brands/[id]/credentials">
) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    await saveCredentials(id, {
      email: typeof body.email === "string" ? body.email : undefined,
      username: typeof body.username === "string" ? body.username : undefined,
      // Empty string clears the password; undefined keeps the stored one.
      password:
        body.password === undefined ? undefined : String(body.password ?? ""),
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });
    const status = await getCredentialStatus(id);
    return NextResponse.json(status);
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to save credentials";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
