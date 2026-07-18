import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import {
  AuthError,
  EmailNotVerifiedError,
  isAdminUser,
  planFor,
  requireUser,
} from "@/lib/auth-server";
import { requireEmailVerified } from "@/lib/email-verification";
import { analyzeJourney } from "@/lib/analyst";
import { auditUrlForMarket } from "@/lib/brand-markets";
import { createContext } from "@/lib/browserbase";
import { MARKET_PROXY_COUNTRY } from "@/lib/constants";
import { journeyAllowedOnPlan } from "@/lib/plan";
import { enforceRunLimit, RunLimitError } from "@/lib/run-limits";
import {
  getBrandContextId,
  getCredentialsForLogin,
  markLoggedIn,
  saveBrandContext,
  seedTestPersona,
} from "@/lib/credentials-db";
import { brandProjectArchived, upsertAnalysis } from "@/lib/project-db";
import { personaVariables } from "@/lib/test-persona";
import type { DeviceMode, JourneyAnalysis } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Soft-stop budget is ANALYZE_BUDGET_MS (default 185s for Hobby 300s).
// After upgrading Vercel, set maxDuration to 800 and ANALYZE_BUDGET_MS=520000.
export const maxDuration = 800;

export async function POST(request: NextRequest) {
  let userId = "";
  let isAdmin = false;
  try {
    const user = await requireUser();
    await requireEmailVerified(user);
    userId = user.id;
    isAdmin = isAdminUser(user);
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
  let device: DeviceMode = "both";
  let chainLoginJourneys: string[] = [];
  try {
    const body = await request.json();
    url = typeof body.url === "string" ? body.url : "";
    if (typeof body.journey === "string") journey = body.journey;
    if (typeof body.brandId === "string") brandId = body.brandId;
    if (typeof body.market === "string") market = body.market;
    if (typeof body.brandName === "string") brandName = body.brandName;
    if (typeof body.ownBrand === "boolean") ownBrand = body.ownBrand;
    if (body.device === "desktop" || body.device === "mobile") {
      device = body.device;
    }
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

  if (brandId && (await brandProjectArchived(brandId).catch(() => false))) {
    return NextResponse.json(
      { error: "This report is archived. Reactivate it to run updates." },
      { status: 409 }
    );
  }

  const plan = await planFor(userId);
  if (!journeyAllowedOnPlan(plan, journey)) {
    return NextResponse.json(
      {
        error:
          "That journey is a Pro feature. Free audits cover first impression, casino, bingo and sports.",
        code: "limit_reached",
      },
      { status: 402 }
    );
  }

  try {
    await enforceRunLimit(userId, "analyze", plan, isAdmin);
  } catch (e) {
    if (e instanceof RunLimitError) {
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
    throw e;
  }

  // A saved browser context means the agent starts logged in. Optional:
  // public runs work without Supabase configured.
  let contextId: string | null = null;
  if (brandId) {
    contextId = await getBrandContextId(brandId).catch(() => null);
  }

  // Login credentials are only required for deposit / withdraw / account.
  // Public journeys (casino, bingo, sports, …) walk logged out so a failed
  // signup never blocks the lobby audit.
  let signupVars: Record<string, string> | null = null;
  let loginVars: Record<string, string> | null = null;
  let accountExists = false;
  if (brandId) {
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
        const vars = personaVariables(creds.persona, creds.password);
        loginVars = vars;
        if (journey === "signup") signupVars = vars;
      }
      accountExists = creds.loggedInAt != null;
      if (journey === "signup" && !contextId) {
        contextId = await createContext();
        await saveBrandContext(brandId, contextId);
      }
    } catch (e) {
      // Credentials are best-effort — public runs still work logged out.
      console.error(
        `[analyze] credential setup failed for ${brandId}:`,
        e instanceof Error ? e.message : e
      );
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
      accountExists,
      device,
    });
    const { chainedAnalyses, ...analysis } = result;
    // Re-runs may be guardrailed against the previous run — return what
    // was actually published so the client never shows a different number.
    let published: JourneyAnalysis = analysis;
    let publishedChained: JourneyAnalysis[] | undefined = chainedAnalyses;
    if (brandId) {
      published = await upsertAnalysis(brandId, analysis);
      publishedChained = [];
      for (const chained of chainedAnalyses ?? []) {
        publishedChained.push(await upsertAnalysis(brandId, chained));
      }
    }
    if (brandId && (analysis.authenticated || analysis.loggedIn)) {
      await markLoggedIn(brandId).catch(() => {});
    }
    return NextResponse.json({
      ...published,
      chainedAnalyses: publishedChained,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "analysis failed";
    console.error(`[analyze] ${journey} @ ${url} failed:`, message);
    Sentry.captureException(e, {
      tags: { route: "analyze", journey },
      extra: { url, brandId, userId },
    });
    // Last resort: the report must never show "nothing" for this area.
    // Persist a blocked row carrying the error so the journeys page shows
    // what happened and offers a retry. (upsertAnalysis keeps a previous
    // good result instead when this is a re-run.)
    if (brandId) {
      const fallback: JourneyAnalysis = {
        area: journey,
        analysedAt: new Date().toISOString(),
        score: 0,
        blocked: true,
        blockReason: `The run failed before it could finish (${message}). Retry the run, or take control to walk this area yourself.`,
        summary: "",
        heuristics: [],
        observations: [],
        features: [],
        screenshots: [],
        finalUrl: url,
      };
      const published = await upsertAnalysis(brandId, fallback).catch(
        () => null
      );
      if (published) return NextResponse.json(published);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
