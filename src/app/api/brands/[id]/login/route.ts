import { NextResponse, type NextRequest } from "next/server";
import { MARKET_PROXY_COUNTRY } from "@/lib/constants";
import { getLoginJob, startLogin } from "@/lib/login-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/** Kick off an agent login for a brand using its stored credentials. */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/brands/[id]/login">
) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const url = typeof body.url === "string" ? body.url : "";
    const market = typeof body.market === "string" ? body.market : "";
    if (!/^https?:\/\//.test(url)) {
      return NextResponse.json({ error: "valid url required" }, { status: 400 });
    }
    const { liveViewUrl } = await startLogin(
      id,
      url,
      MARKET_PROXY_COUNTRY[market] ?? null
    );
    return NextResponse.json({ liveViewUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : "login failed to start";
    console.error("[login] start failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Poll the login job state. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/brands/[id]/login">
) {
  const { id } = await ctx.params;
  const job = getLoginJob(id);
  if (!job) return NextResponse.json({ status: "none" });
  return NextResponse.json({
    status: job.status,
    liveViewUrl: job.liveViewUrl,
    steps: job.steps,
    error: job.error,
  });
}
