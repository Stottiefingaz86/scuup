import { NextResponse, type NextRequest } from "next/server";
import { seedTestPersona } from "@/lib/credentials-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Save default test email, password (from env), and market persona. */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/brands/[id]/credentials/seed">
) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const market = typeof body.market === "string" ? body.market : "Global / Crypto";
    const brandName = typeof body.brandName === "string" ? body.brandName : "Brand";
    const ownBrand = body.ownBrand === true;
    await seedTestPersona(id, { market, brandName, ownBrand });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "seed failed";
    console.error("[credentials] seed failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
