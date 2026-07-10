import { NextResponse, type NextRequest } from "next/server";
import { startCapture } from "@/lib/capture-runtime";
import { createContext } from "@/lib/browserbase";
import { MARKET_PROXY_COUNTRY } from "@/lib/constants";
import { getBrandContextId, saveBrandContext } from "@/lib/credentials-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let url = "";
  let brandId = "";
  let market = "";
  let viewport: { width: number; height: number } | undefined;
  try {
    const body = await request.json();
    url = typeof body.url === "string" ? body.url : "";
    if (typeof body.brandId === "string") brandId = body.brandId;
    if (typeof body.market === "string") market = body.market;
    if (
      typeof body.width === "number" &&
      typeof body.height === "number" &&
      body.width > 0 &&
      body.height > 0
    ) {
      viewport = { width: body.width, height: body.height };
    }
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "valid url required" }, { status: 400 });
  }

  // Attach the brand's persistent context so logins performed in this live
  // session survive for future agent runs. Optional — capture still works
  // without Supabase configured.
  let contextId: string | undefined;
  if (brandId) {
    try {
      contextId = (await getBrandContextId(brandId)) ?? undefined;
      if (!contextId) {
        contextId = await createContext();
        await saveBrandContext(brandId, contextId);
      }
    } catch {
      contextId = undefined;
    }
  }

  try {
    const { sessionId, liveViewUrl } = await startCapture(
      url,
      viewport,
      contextId,
      MARKET_PROXY_COUNTRY[market] ?? null
    );
    return NextResponse.json({ sessionId, liveViewUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "capture failed" },
      { status: 500 }
    );
  }
}
