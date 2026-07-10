import { NextResponse, type NextRequest } from "next/server";
import {
  AuthError,
  EmailNotVerifiedError,
  planFor,
  requireUser,
} from "@/lib/auth-server";
import { requireEmailVerified } from "@/lib/email-verification";
import { analyzeJourney } from "@/lib/analyst";
import { MARKET_PROXY_COUNTRY } from "@/lib/constants";
import { journeyAllowedOnPlan } from "@/lib/plan";
import { getBrandContextId } from "@/lib/credentials-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let userId = "";
  try {
    const user = await requireUser();
    await requireEmailVerified(user);
    userId = user.id;
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    if (e instanceof EmailNotVerifiedError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: 403 }
      );
    }
    throw e;
  }

  let url = "";
  let journey = "landing";
  let brandId = "";
  let market = "";
  try {
    const body = await request.json();
    url = typeof body.url === "string" ? body.url : "";
    if (typeof body.journey === "string") journey = body.journey;
    if (typeof body.brandId === "string") brandId = body.brandId;
    if (typeof body.market === "string") market = body.market;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "valid url required" }, { status: 400 });
  }

  const plan = await planFor(userId);
  if (!journeyAllowedOnPlan(plan, journey)) {
    return NextResponse.json(
      {
        error:
          "That journey is a Pro feature. Free audits cover first impression, casino and sports.",
        code: "limit_reached",
      },
      { status: 402 }
    );
  }

  // A saved browser context means the agent starts logged in. Optional:
  // public runs work without Supabase configured.
  let contextId: string | null = null;
  if (brandId) {
    contextId = await getBrandContextId(brandId).catch(() => null);
  }

  // The project's market decides where the browser appears from, so
  // geo-gated offers and payment methods match what a local player sees.
  const proxyCountry = MARKET_PROXY_COUNTRY[market] ?? null;

  try {
    const analysis = await analyzeJourney(url, journey, contextId, proxyCountry);
    return NextResponse.json(analysis);
  } catch (e) {
    const message = e instanceof Error ? e.message : "analysis failed";
    console.error(`[analyze] ${journey} @ ${url} failed:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
