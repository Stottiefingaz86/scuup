import { NextResponse, type NextRequest } from "next/server";
import { MARKET_PROXY_COUNTRY } from "@/lib/constants";
import { getSignupJob, startSignup } from "@/lib/signup-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/brands/[id]/signup">
) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const url = typeof body.url === "string" ? body.url : "";
    const market = typeof body.market === "string" ? body.market : "";
    const brandName = typeof body.brandName === "string" ? body.brandName : "";
    const ownBrand = body.ownBrand === true;
    if (!/^https?:\/\//.test(url)) {
      return NextResponse.json({ error: "valid url required" }, { status: 400 });
    }
    const { liveViewUrl } = await startSignup(id, url, {
      market,
      brandName,
      ownBrand,
      requestedProxyCountry: MARKET_PROXY_COUNTRY[market] ?? null,
    });
    return NextResponse.json({ liveViewUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : "signup failed to start";
    console.error("[signup] start failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/brands/[id]/signup">
) {
  const { id } = await ctx.params;
  const job = getSignupJob(id);
  if (!job) return NextResponse.json({ status: "none" });
  return NextResponse.json({
    status: job.status,
    liveViewUrl: job.liveViewUrl,
    steps: job.steps,
    error: job.error,
  });
}
