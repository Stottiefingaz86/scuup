import { NextResponse, type NextRequest } from "next/server";
import {
  getResearchTeardownJob,
  startResearchTeardown,
} from "@/lib/research/teardown-runtime";
import { loadTeardownJob } from "@/lib/research/teardown-job-store";
import { loadResearchWorkspace } from "@/lib/research/workspace-server";
import type { ResearchDevice, ResearchPersona } from "@/lib/research/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const brandUrl = typeof body.brandUrl === "string" ? body.brandUrl : "";
    const brandName =
      typeof body.brandName === "string" ? body.brandName : "Brand";
    const market =
      typeof body.market === "string" ? body.market : "United Kingdom";
    const runId =
      typeof body.runId === "string" ? body.runId : crypto.randomUUID();
    const device: ResearchDevice =
      body.device === "mobile" ? "mobile" : "desktop";
    const kind =
      body.kind === "returning_player_login"
        ? "returning_player_login"
        : "new_player_first_bet";
    const throughStageRaw = body.throughStage;
    const throughStage =
      throughStageRaw === "registration"
        ? "registration"
        : throughStageRaw === "deposit"
          ? "deposit"
          : throughStageRaw === "deposit_confirmed"
            ? "deposit_confirmed"
            : throughStageRaw === "first_bet"
              ? "first_bet"
              : "verification";
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const brandId = typeof body.brandId === "string" ? body.brandId : "";
    const persona =
      body.persona && typeof body.persona === "object"
        ? (body.persona as ResearchPersona)
        : null;
    const accountEmail =
      typeof body.accountEmail === "string" ? body.accountEmail : null;
    const accountPassword =
      typeof body.accountPassword === "string" ? body.accountPassword : null;
    let accountPhone =
      typeof body.accountPhone === "string" ? body.accountPhone : null;
    let accountUsername =
      typeof body.accountUsername === "string" ? body.accountUsername : null;
    let accountNumber =
      typeof body.accountNumber === "string" ? body.accountNumber : null;
    if (
      (!accountPhone?.trim() || !accountUsername?.trim() || !accountNumber?.trim()) &&
      projectId &&
      brandId
    ) {
      try {
        const projects = await loadResearchWorkspace();
        const brand = projects
          .find((p) => p.id === projectId)
          ?.brands.find((b) => b.id === brandId);
        accountPhone = accountPhone?.trim() || brand?.accountPhone?.trim() || null;
        accountUsername =
          accountUsername?.trim() || brand?.accountUsername?.trim() || null;
        accountNumber =
          accountNumber?.trim() || brand?.accountNumber?.trim() || null;
      } catch {
        /* workspace miss — keep body values */
      }
    }
    const startAt =
      body.startAt === "deposit"
        ? "deposit"
        : body.startAt === "deposit_confirmation"
          ? "deposit_confirmation"
          : body.startAt === "play"
            ? "play"
            : body.startAt === "features"
              ? "features"
              : "registration";
    const resumeWatch =
      startAt === "deposit_confirmation" &&
      body.resumeWatch &&
      typeof body.resumeWatch.paidAt === "string"
        ? {
            depositAddress:
              typeof body.resumeWatch.depositAddress === "string"
                ? (body.resumeWatch.depositAddress as string)
                : null,
            paidAt: body.resumeWatch.paidAt as string,
          }
        : null;
    if (startAt === "deposit_confirmation" && !resumeWatch) {
      return NextResponse.json(
        { error: "resumeWatch { paidAt } required" },
        { status: 400 },
      );
    }
    const forceAhead =
      startAt === "deposit_confirmation" && body.forceAhead === true;
    const replayPlay = startAt === "play" && body.replayPlay === true;
    const seedStages = Array.isArray(body.seedStages) ? body.seedStages : null;
    // Feature scan without an account is allowed — it walks public
    // casino / rewards logged out (Rainbet-style verify walls).
    const seedDepositWatch = Array.isArray(body.seedDepositWatch)
      ? body.seedDepositWatch
      : null;

    if (!/^https?:\/\//.test(brandUrl)) {
      return NextResponse.json(
        { error: "valid brandUrl required" },
        { status: 400 },
      );
    }
    if (
      (throughStage === "deposit" ||
        throughStage === "deposit_confirmed" ||
        throughStage === "first_bet") &&
      (!projectId || !brandId)
    ) {
      return NextResponse.json(
        { error: "projectId and brandId required for deposit runs" },
        { status: 400 },
      );
    }

    const { jobId, liveViewUrl, signupEmail, signupPassword, signupUsername } =
      await startResearchTeardown({
        runId,
        projectId,
        brandId,
        brandName,
        brandUrl,
        market,
        device,
        kind,
        persona,
        throughStage,
        startAt,
        resumeWatch,
        forceAhead,
        replayPlay,
        seedStages,
        seedDepositWatch,
        accountEmail,
        accountPassword,
        accountPhone,
        accountUsername,
        accountNumber,
      });

    return NextResponse.json({
      jobId,
      liveViewUrl,
      runId,
      signupEmail,
      signupPassword,
      signupUsername: signupUsername ?? null,
      accountPasswordUsed: Boolean(accountPassword?.trim()),
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "research teardown failed to start";
    console.error("[research/teardown] start failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }
  const job =
    getResearchTeardownJob(jobId) ?? (await loadTeardownJob(jobId));
  if (!job) return NextResponse.json({ status: "none" });
  return NextResponse.json({
    status: job.status,
    liveViewUrl: job.liveViewUrl,
    steps: job.steps,
    stages: job.stages,
    metrics: job.metrics,
    error: job.error,
    authenticated: job.authenticated,
    depositConfirmed: job.depositConfirmed,
    firstBetPlaced: job.firstBetPlaced,
    topFriction: job.topFriction,
    actionId: job.actionId,
    sessionOpen: job.sessionOpen,
    runId: job.runId,
    brandId: job.brandId,
    signupEmail: job.signupEmail,
    signupPassword: job.signupPassword,
    signupUsername: job.signupUsername,
    emails: job.emails,
    postDeposit: job.postDeposit,
    postSignup: job.postSignup,
    depositWatch: job.depositWatch,
    depositAddress: job.depositAddress ?? null,
    paidAt: job.paidAt ?? null,
    depositSkipped: job.depositSkipped ?? false,
    lobby: job.lobby ?? null,
    features: job.features ?? null,
  });
}
