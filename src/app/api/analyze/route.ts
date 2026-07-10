import { NextResponse, type NextRequest } from "next/server";
import {
  AuthError,
  EmailNotVerifiedError,
  planFor,
  requireUser,
} from "@/lib/auth-server";
import { requireEmailVerified } from "@/lib/email-verification";
import { analyzeJourney } from "@/lib/analyst";
import { auditUrlForMarket } from "@/lib/brand-markets";
import { createContext } from "@/lib/browserbase";
import { journeyRequiresLogin, MARKET_PROXY_COUNTRY } from "@/lib/constants";
import { journeyAllowedOnPlan } from "@/lib/plan";
import {
  getBrandContextId,
  getCredentialsForLogin,
  markLoggedIn,
  saveBrandContext,
  seedTestPersona,
} from "@/lib/credentials-db";
import { personaVariables } from "@/lib/test-persona";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Hobby-plan ceiling. Signup and each gated journey run as separate
// requests — the persisted browser context (plus credential re-login)
// carries the session between them, so no single run needs longer.
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
  let brandName = "";
  let ownBrand = false;
  let chainLoginJourneys: string[] = [];
  try {
    const body = await request.json();
    url = typeof body.url === "string" ? body.url : "";
    if (typeof body.journey === "string") journey = body.journey;
    if (typeof body.brandId === "string") brandId = body.brandId;
    if (typeof body.market === "string") market = body.market;
    if (typeof body.brandName === "string") brandName = body.brandName;
    if (typeof body.ownBrand === "boolean") ownBrand = body.ownBrand;
    if (Array.isArray(body.chainLoginJourneys)) {
      chainLoginJourneys = body.chainLoginJourneys.filter(
        (j: unknown): j is string => typeof j === "string"
      );
    }
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

  // Signup runs register a real test account: seed the persona (test email,
  // random identity, env password) if missing, and pin the run to a
  // persistent browser context so the created session unlocks the gated
  // journeys that follow.
  let signupVars: Record<string, string> | null = null;
  if (journey === "signup" && brandId) {
    try {
      let creds = await getCredentialsForLogin(brandId);
      if (!creds.persona || !creds.password) {
        await seedTestPersona(brandId, {
          market,
          brandName: brandName || new URL(url).hostname,
          ownBrand,
        });
        creds = await getCredentialsForLogin(brandId);
      }
      if (creds.persona && creds.password) {
        signupVars = personaVariables(creds.persona, creds.password);
      }
      if (!contextId) {
        contextId = await createContext();
        await saveBrandContext(brandId, contextId);
      }
    } catch (e) {
      // Registration is best-effort — without a persona the run still
      // scores the opened form like before.
      console.error(
        `[analyze] signup persona setup failed for ${brandId}:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  // Login-gated journeys carry the saved test credentials so the agent can
  // restore an expired session by logging in itself before giving up.
  let loginVars: Record<string, string> | null = null;
  if (journeyRequiresLogin(journey) && brandId) {
    try {
      const creds = await getCredentialsForLogin(brandId);
      if (creds.persona && creds.password) {
        loginVars = personaVariables(creds.persona, creds.password);
      }
    } catch {
      // Without credentials the run still works while the context is live.
    }
  }

  // The project's market decides where the browser appears from, so
  // geo-gated offers and payment methods match what a local player sees.
  const proxyCountry = MARKET_PROXY_COUNTRY[market] ?? null;

  // Some brands serve a market from a locally licensed domain (stake.mx
  // for Mexico) — visiting the main site from that market's IP just shows
  // a restricted-region wall.
  url = auditUrlForMarket(url, market);

  try {
    const result = await analyzeJourney(url, journey, contextId, proxyCountry, {
      signupVars: journey === "signup" ? signupVars : null,
      chainLoginJourneys:
        journey === "signup" ? chainLoginJourneys : undefined,
      loginVars,
    });
    const { chainedAnalyses, ...analysis } = result;
    if (journey === "signup" && brandId && analysis.authenticated) {
      await markLoggedIn(brandId).catch(() => {});
    }
    return NextResponse.json({ ...analysis, chainedAnalyses });
  } catch (e) {
    const message = e instanceof Error ? e.message : "analysis failed";
    console.error(`[analyze] ${journey} @ ${url} failed:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
