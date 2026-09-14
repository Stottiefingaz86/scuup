"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_TEST_EMAIL } from "@/lib/constants";
import {
  isProductionDeployPublic,
  NEW_REPORTS_LOCKED_MESSAGE,
} from "@/lib/prod-locks";
import {
  brandHasCompletedSignup,
  brandHasTestAccount,
  createDraftRun,
  applyFairDepositClocks,
  getResearchProject,
  markBrandAccountReady,
  markInboxSwept,
  emailsForDisplay,
  mergeResearchEmails,
  pruneProjectEmails,
  patchResearchRun,
  resetAllBrandsFresh,
  resetBrandFresh,
  saveBrandAccountEmail,
  saveBrandAccountPassword,
  saveBrandAccountUsername,
  resolveBrandAccountUsername,
  saveBrandPlayerVoice,
  saveResearchPersona,
  syncBrandAccountsFromEmails,
  resolveBrandAccountPassword,
  useResearchProject,
} from "@/lib/research/store";
import {
  FEATURE_BENCHMARK_ROWS,
  JOURNEY_LABELS,
} from "@/lib/research/journeys";
import { ResearchJourneyTimeline } from "@/components/research-journey-timeline";
import { ResearchBrandRoster } from "@/components/research-brand-roster";
import { ResearchEmailThumb } from "@/components/research-email-card";
import { ResearchEmailTimeline } from "@/components/research-email-timeline";
import { StageEvidenceGallery } from "@/components/research-stage-evidence";
import {
  PostDepositCard,
  PostDepositComparison,
} from "@/components/research-post-deposit";
import { PostSignupCard } from "@/components/research-post-signup";
import {
  emptyPostSignup,
  knownSignupLanding,
} from "@/lib/research/post-signup";
import { WalkInsightsCard } from "@/components/research-walk-insights";
import {
  EvidenceThumbs,
  stageFrames,
} from "@/components/research-evidence-thumbs";
import {
  journeyContextForBrand,
  PlayerVoiceTab,
} from "@/components/research-player-voice";
import { reconcilePostDeposit } from "@/lib/research/post-deposit";
import {
  ENGAGEMENT_ROWS,
  engagementCell,
  featureBenchmarkCell,
  featureBenchmarkEvidence,
  latestRunForBrand,
} from "@/lib/research/feature-benchmark";
import {
  FrameThumb,
  JourneyFrameViewer,
} from "@/components/research-frame-viewer";
import { ResearchReportView } from "@/components/research-report";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Eye,
  EyeOff,
  FileText,
  Mail,
  MessageSquareQuote,
  Route,
  Scale,
  Search,
} from "lucide-react";
import {
  dedupeWatchEmails,
  formatEmailReceivedAt,
  isDepositConfirmEmail,
  pickWelcomeEmail,
} from "@/lib/research/email-format";
import { cn } from "@/lib/utils";
import {
  buildJourneyComparison,
  isSkippedStage,
  recoverRegistrationMetrics,
  teardownForBrand,
} from "@/lib/research/teardown-summary";
import { competitorGapInsights } from "@/lib/research/strategy";
import {
  defaultResearchPersona,
  randomCanadianAddress,
  randomUsAddress,
} from "@/lib/research/persona-address";
import { resolveResearchSignupEmail } from "@/lib/research/signup-email";
import { brandHost, brandNameSlug } from "@/lib/research/email-brand";
import type {
  AcquisitionSource,
  JourneyKind,
  JourneyRun,
  JourneyStageResult,
  ResearchPersona,
  ResearchProject,
} from "@/lib/research/types";

/** Only apply agent stages when they contain real progress — never wipe a
 * stored run with empty draft stages (happens when job status is "none"
 * after a server restart). */
function stagesWithProgress(
  stages: JourneyStageResult[] | null | undefined,
): JourneyStageResult[] | undefined {
  if (!Array.isArray(stages) || stages.length === 0) return undefined;
  const progressed = stages.some(
    (s) =>
      Boolean(s.startedAt) ||
      Boolean(s.endedAt) ||
      (Boolean(s.evidence) && s.evidence !== "Skipped") ||
      (s.screenshotUrls?.length ?? 0) > 0 ||
      (s.steps != null && s.steps > 0) ||
      (s.timeSec != null && s.timeSec > 0),
  );
  return progressed ? stages : undefined;
}

/**
 * What a resumed deposit watch needs. Older runs only have the address in the
 * deposit stage evidence, so fall back to parsing it from there.
 */
function resumeInfoForRun(
  run: JourneyRun | null,
): { depositAddress: string | null; paidAt: string } | null {
  if (!run) return null;
  const dep = run.stages.find((s) => s.stageId === "deposit");
  const conf = run.stages.find((s) => s.stageId === "deposit_confirmation");
  // Only a run that reached the deposit can pick the watch back up.
  if (!dep?.startedAt && !conf?.startedAt && !run.depositAddress) return null;
  const fromEvidence = dep?.evidence?.match(
    /\b(bc1[ac-hj-np-z02-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/,
  )?.[1];
  const depositAddress = run.depositAddress ?? fromEvidence ?? null;
  const paidAt =
    run.paidAt ??
    conf?.startedAt ??
    dep?.endedAt ??
    run.dateTested ??
    new Date().toISOString();
  return { depositAddress, paidAt };
}

function applyTeardownPoll(
  projectId: string,
  runId: string,
  data: {
    status?: string;
    stages?: JourneyStageResult[];
    metrics?: JourneyRun["metrics"];
    topFriction?: JourneyRun["topFriction"];
    steps?: string[];
    error?: string | null;
    authenticated?: boolean;
    brandId?: string;
    runId?: string;
    postDeposit?: JourneyRun["postDeposit"];
    postSignup?: JourneyRun["postSignup"];
    depositWatch?: JourneyRun["depositWatch"];
    depositAddress?: string | null;
    paidAt?: string | null;
    depositSkipped?: boolean;
    lobby?: JourneyRun["lobby"];
    features?: JourneyRun["features"];
  },
  brandId?: string,
) {
  // Always write to the job's runId when present — don't drop updates because
  // React still holds a stale runBrandId from a previous brand.
  const targetRunId = data.runId || runId;
  const project = getResearchProject(projectId);
  if (!project) return;
  const target =
    project.runs.find((r) => r.id === targetRunId) ??
    project.runs.find(
      (r) =>
        (r.status === "running" || r.status === "paused") &&
        r.brandId === (data.brandId || brandId),
    );
  if (!target) return;

  // Brand mismatch: still apply to the job's run, never silently no-op.
  const stages = stagesWithProgress(data.stages);
  const patch: Partial<JourneyRun> = {};
  const fairConf = target.clockFair
    ? target.stages.find((s) => s.stageId === "deposit_confirmation")
    : null;
  if (stages) {
    const merged = stages.map((s) => {
      const prev = target.stages.find((p) => p.stageId === s.stageId);
      if (!prev) return s;
      const shots = [
        ...new Set([
          ...(prev.screenshotUrls ?? []),
          ...(s.screenshotUrls ?? []),
        ]),
      ];
      const keepStored =
        (prev.screenshotUrls?.length ?? 0) > (s.screenshotUrls?.length ?? 0) &&
        [
          "first_touch",
          "landing",
          "registration",
          "deposit",
          "deposit_confirmation",
        ].includes(s.stageId);
      const homepageIn =
        s.stageId === "landing" &&
        /homepage loaded/i.test(s.evidence ?? "") &&
        (s.screenshotUrls?.length ?? 0) > 0;
      const landingJunk =
        s.stageId === "landing" &&
        /opened for deposit login|can.?t be reached|err_tunnel/i.test(
          prev.evidence ?? "",
        );
      if (homepageIn) {
        return {
          ...s,
          screenshotUrls: (s.screenshotUrls ?? []).filter(
            (u) => !/mtwzaxkx-o4olp/.test(u),
          ),
        };
      }
      if (keepStored && !landingJunk) {
        return { ...prev, screenshotUrls: shots };
      }
      return { ...s, screenshotUrls: shots };
    });
    patch.stages = fairConf
      ? merged.map((s) =>
          s.stageId === "deposit_confirmation" ? { ...fairConf, screenshotUrls: [
            ...new Set([
              ...(fairConf.screenshotUrls ?? []),
              ...(s.screenshotUrls ?? []),
            ]),
          ] } : s,
        )
      : merged;
  }
  if (data.metrics && (data.metrics.totalTimeSec != null || stages)) {
    if (target.clockFair && fairConf) {
      const incoming = (data.stages ?? []).find(
        (s) => s.stageId === "deposit_confirmation",
      );
      const extra = Math.max(
        0,
        (incoming?.timeSec ?? 0) - (fairConf.timeSec ?? 0),
      );
      const extraWait = Math.max(
        0,
        (incoming?.waitSec ?? 0) - (fairConf.waitSec ?? 0),
      );
      patch.metrics = {
        ...data.metrics,
        totalTimeSec:
          data.metrics.totalTimeSec != null
            ? Math.max(0, data.metrics.totalTimeSec - extra)
            : target.metrics.totalTimeSec,
        totalWaitSec:
          data.metrics.totalWaitSec != null
            ? Math.max(0, data.metrics.totalWaitSec - extraWait)
            : target.metrics.totalWaitSec,
        depositToFirstBetSec:
          target.metrics.depositToFirstBetSec ??
          data.metrics.depositToFirstBetSec,
      };
    } else {
      patch.metrics = data.metrics;
    }
  }
  if (Array.isArray(data.topFriction) && data.topFriction.length) {
    patch.topFriction = data.topFriction;
  }
  if (Array.isArray(data.steps)) patch.trail = data.steps;
  if (data.postDeposit) {
    patch.postDeposit =
      target.clockFair && target.postDeposit?.balanceAlert.seen
        ? target.postDeposit
        : reconcilePostDeposit(data.postDeposit);
  }
  if (data.postSignup) patch.postSignup = data.postSignup;
  if (Array.isArray(data.depositWatch) && data.depositWatch.length) {
    patch.depositWatch = data.depositWatch;
  }
  if (data.depositAddress) patch.depositAddress = data.depositAddress;
  if (data.paidAt) patch.paidAt = data.paidAt;
  if (data.depositSkipped) patch.depositSkipped = true;
  if (data.lobby) patch.lobby = data.lobby;
  if (data.features) patch.features = data.features;
  if (data.status === "success") patch.status = "complete";
  else if (data.status === "failed") patch.status = "failed";
  else if (data.status === "paused") patch.status = "paused";
  else if (
    data.status === "awaiting_payment" ||
    data.status === "confirming_payment" ||
    data.status === "awaiting_sms"
  ) {
    patch.status = "running";
  } else if (data.status && data.status !== "none") {
    patch.status = "running";
  }
  if (data.error) patch.error = data.error;
  // Force stop wins — a late poll must not flip the run back to live.
  if (
    target.status === "paused" &&
    /force stopped/i.test(target.error ?? "") &&
    patch.status === "running"
  ) {
    delete patch.status;
  }
  if (Object.keys(patch).length > 0) {
    patchResearchRun(projectId, target.id, patch);
  }

  const readyBrand = data.brandId || brandId;
  if (readyBrand && data.authenticated === true) {
    markBrandAccountReady(projectId, readyBrand, true);
  }
}

/** Persist signup credentials and build the password sent to the teardown API. */
function lockBrandCredentials(
  project: Parameters<typeof resolveBrandAccountPassword>[0],
  brandId: string,
): string {
  const pw = resolveBrandAccountPassword(project, brandId);
  if (pw) saveBrandAccountPassword(project.id, brandId, pw);
  return pw;
}

/** Stages the report lets you skip when they're never going to finish. */
const SKIPPABLE_STAGES = ["deposit", "deposit_confirmation"];

type ThroughStage =
  "verification" | "deposit" | "deposit_confirmed" | "first_bet";

function formatSec(n: number | null | undefined) {
  if (n == null) return "—";
  if (n < 60) return `${n}s`;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}m ${s}s`;
}

const INBOX_SWEEP_MS = 24 * 60 * 60 * 1000;

function inboxDueForDailySweep(project: ResearchProject): boolean {
  const last = project.lastInboxSweepAt
    ? Date.parse(project.lastInboxSweepAt)
    : 0;
  return !last || Date.now() - last >= INBOX_SWEEP_MS;
}

/** Welcome → day 14 CRM window, scoped to this project's +aliases and senders. */
function researchInboxListUrl(
  project: ResearchProject,
  toAddress: string,
  hoursOverride?: number,
): string {
  const days = project.emailWatchDays || 14;
  const elapsedH = Math.ceil(
    (Date.now() - Date.parse(project.createdAt)) / 3_600_000,
  );
  const last = project.lastInboxSweepAt
    ? Date.parse(project.lastInboxSweepAt)
    : 0;
  const sinceLastH = last
    ? Math.ceil((Date.now() - last) / 3_600_000)
    : 36;
  const hours =
    hoursOverride ??
    Math.min(16 * 24, Math.max(1, days * 24, elapsedH || 1, sinceLastH));
  const aliases = project.brands
    .map((b) => b.accountEmail?.trim())
    .filter((a): a is string => Boolean(a))
    .join(",");
  const from = [
    ...new Set(
      project.brands.flatMap((b) => {
        const host = brandHost(b.url);
        if (!host) return [];
        return [host, `email.${host}`, `mail.${host}`];
      }),
    ),
  ].join(",");
  const slugs = project.brands
    .map((b) => brandNameSlug(b.name))
    .filter((s) => s.length >= 3)
    .join(",");
  const qs = new URLSearchParams({
    list: "1",
    to: toAddress,
    hours: String(hours),
  });
  if (aliases) qs.set("aliases", aliases);
  if (from) qs.set("from", from);
  if (slugs) qs.set("slugs", slugs);
  return `/api/research/inbox?${qs.toString()}`;
}

export default function ResearchProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-6 py-16 text-sm text-[var(--rs-muted)]">
          Loading project…
        </div>
      }
    >
      <ResearchProjectPageInner />
    </Suspense>
  );
}

function ResearchProjectPageInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const project = useResearchProject(params.id);
  const tabFromUrl = searchParams.get("tab");
  const [tab, setTab] = useState<
    | "persona"
    | "journeys"
    | "benchmark"
    | "voice"
    | "email"
    | "report"
  >(
    tabFromUrl === "persona" ||
      tabFromUrl === "journeys" ||
      tabFromUrl === "benchmark" ||
      tabFromUrl === "voice" ||
      tabFromUrl === "email" ||
      tabFromUrl === "report"
      ? tabFromUrl
      : "journeys",
  );
  const [kind, setKind] = useState<JourneyKind>("new_player_first_bet");
  const [brandId, setBrandId] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [pausing, setPausing] = useState(false);
  const [skippingStage, setSkippingStage] = useState<string | null>(null);
  const [pendingSkip, setPendingSkip] = useState(false);
  /** Brand the live job/trail belongs to (don't show BetOnline trail on Rainbet). */
  const [runBrandId, setRunBrandId] = useState<string | null>(null);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [trail, setTrail] = useState<string[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  /** A brand failed mid-batch — we stop here instead of rolling on to the
   * next competitor, so the failure gets looked at before more money/time. */
  const [batchHalt, setBatchHalt] = useState<{
    brandId: string;
    brandName: string;
    error: string;
    skipped: string[];
  } | null>(null);
  const [depositBatchRunning, setDepositBatchRunning] = useState(false);
  const [featureScanProgress, setFeatureScanProgress] = useState<string | null>(
    null,
  );
  const [voiceProgress, setVoiceProgress] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [depositBatchProgress, setDepositBatchProgress] = useState<
    string | null
  >(null);
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (
      t === "persona" ||
      t === "journeys" ||
      t === "benchmark" ||
      t === "voice" ||
      t === "email" ||
      t === "report"
    ) {
      setTab(t);
    } else {
      setTab("journeys");
    }
  }, [searchParams]);

  function selectTab(
    id:
      | "persona"
      | "journeys"
      | "benchmark"
      | "voice"
      | "email"
      | "report",
  ) {
    setTab(id);
    const url =
      id === "journeys"
        ? `/research/projects/${params.id}`
        : `/research/projects/${params.id}?tab=${id}`;
    router.replace(url, { scroll: false });
  }

  const activeBrandId = brandId || project?.brands[0]?.id || "";
  const runs = useMemo(
    () =>
      project?.runs.filter(
        (r) => r.brandId === activeBrandId && r.kind === kind,
      ) ?? [],
    [project, activeBrandId, kind],
  );
  const latestRun =
    [...runs].reverse().find((r) => !r.archived) ??
    [...runs].reverse().find((r) => r.status === "complete") ??
    runs[runs.length - 1] ??
    null;

  useEffect(() => {
    if (!project) return;
    applyFairDepositClocks(project.id);
  }, [project?.id]);

  // Skip requested while the agent was live: it has now paused and closed the
  // browser, so resume past the stage.
  const anyAgentBusy =
    running ||
    batchRunning ||
    depositBatchRunning ||
    featureScanProgress != null;
  useEffect(() => {
    if (!pendingSkip || anyAgentBusy) return;
    if (latestRun?.status !== "paused") return;
    setPendingSkip(false);
    void startTeardownRun("first_bet", {
      resume: true,
      ...(resumeInfoForRun(latestRun)
        ? { forceAhead: true }
        : { skipToPlay: true }),
    }).finally(() => setSkippingStage(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSkip, anyAgentBusy, latestRun?.status]);

  // Re-attach to the live agent job after refresh / brand switch so the report stays in sync.
  useEffect(() => {
    if (!project) return;
    if (stopRequestedRef.current) return;
    const runningForBrand = [...project.runs]
      .reverse()
      .find(
        (r) =>
          r.status === "running" && r.agentJobId && r.brandId === activeBrandId,
      );
    const anyRunning = [...project.runs]
      .reverse()
      .find((r) => r.status === "running" && r.agentJobId);
    const runningRun = runningForBrand ?? (!jobId ? anyRunning : null);
    if (!runningRun?.agentJobId) {
      // A run stuck on "running" with no agent job to re-attach to (old tab,
      // server restart before the job id was saved). Park it so the report
      // offers Resume / Continue instead of looking live forever.
      if (!running && !batchRunning && !depositBatchRunning) {
        const stale = project.runs.find(
          (r) =>
            r.status === "running" &&
            !r.agentJobId &&
            r.brandId === activeBrandId,
        );
        if (stale) {
          patchResearchRun(project.id, stale.id, {
            status: resumeInfoForRun(stale) ? "paused" : "failed",
            error: resumeInfoForRun(stale)
              ? undefined
              : "Agent session was lost before the deposit address was captured.",
          });
        }
      }
      return;
    }
    if (jobId !== runningRun.agentJobId) {
      setJobId(runningRun.agentJobId);
    }
    setRunBrandId(runningRun.brandId);
    setRunning(true);
    if (Array.isArray(runningRun.trail) && runningRun.trail.length) {
      setTrail(runningRun.trail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, activeBrandId, project?.runs]);

  // Drop foreign / pre-project inbox noise (shared Gmail has older brand mail).
  useEffect(() => {
    if (!project) return;
    pruneProjectEmails(project.id);
  }, [project?.id]);

  // Persist ready flag when inbox already proves signup (e.g. BetOnline emails).
  useEffect(() => {
    if (!project) return;
    syncBrandAccountsFromEmails(project.id);
  }, [project]);

  // Once a day: open IMAP, pick up new mail, log out. No interval — a
  // stuck list was starving the teardown start.
  useEffect(() => {
    if (!project) return;
    if (batchRunning || depositBatchRunning || running) return;
    if (!inboxDueForDailySweep(project)) return;
    const email = project.persona?.email || DEFAULT_TEST_EMAIL;
    const last = project.lastInboxSweepAt
      ? Date.parse(project.lastInboxSweepAt)
      : 0;
    const hours = last
      ? Math.min(16 * 24, Math.max(24, Math.ceil((Date.now() - last) / 3_600_000)))
      : 36;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(researchInboxListUrl(project, email, hours), {
          signal: AbortSignal.timeout(50_000),
        });
        const data = await res.json();
        if (cancelled || !data.configured) return;
        const items = (data.messages ??
          []) as import("@/lib/research/types").EmailWatchItem[];
        if (items.length) {
          mergeResearchEmails(project.id, items);
          syncBrandAccountsFromEmails(project.id);
        }
        markInboxSwept(project.id);
      } catch {
        /* retry on the next page load */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    project?.id,
    project?.lastInboxSweepAt,
    batchRunning,
    depositBatchRunning,
    running,
  ]);

  useEffect(() => {
    if (!jobId || !project) return;
    let cancelled = false;
    let inFlight = false;
    let goneMisses = 0;
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await fetch(
          `/api/research/teardown?jobId=${encodeURIComponent(jobId)}`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "none") {
          goneMisses += 1;
          if (goneMisses < JOB_GONE_POLLS) return;
          const run = project.runs.find((r) => r.agentJobId === jobId);
          if (run && run.status === "running") {
            const canResume = Boolean(resumeInfoForRun(run));
            patchResearchRun(project.id, run.id, {
              status: canResume ? "paused" : "failed",
              error: canResume
                ? undefined
                : "The remote browser session disappeared. Start this brand again.",
            });
          }
          setRunning(false);
          setJobId(null);
          setJobStatus(null);
          return;
        }
        goneMisses = 0;
        if (Array.isArray(data.steps) && data.steps.length) {
          setTrail(data.steps);
        }
        setLiveViewUrl(data.liveViewUrl ?? null);
        // Keep brand tab + trail aligned with the live job (fixes stale "Opening…").
        if (typeof data.brandId === "string" && data.brandId) {
          setRunBrandId(data.brandId);
          setBrandId((prev) => prev || data.brandId);
        }
        if (typeof data.signupEmail === "string" && data.signupEmail) {
          const bid = data.brandId || runBrandId;
          if (bid) saveBrandAccountEmail(project.id, bid, data.signupEmail);
        }
        if (typeof data.signupPassword === "string" && data.signupPassword) {
          const bid = data.brandId || runBrandId;
          if (bid)
            saveBrandAccountPassword(project.id, bid, data.signupPassword);
        }
        if (typeof data.signupUsername === "string" && data.signupUsername) {
          const bid = data.brandId || runBrandId;
          if (bid)
            saveBrandAccountUsername(project.id, bid, data.signupUsername);
        }
        if (Array.isArray(data.emails) && data.emails.length) {
          mergeResearchEmails(project.id, data.emails);
          const bid = data.brandId || runBrandId;
          if (bid) {
            const fromMail = resolveBrandAccountUsername(project, bid);
            if (fromMail) saveBrandAccountUsername(project.id, bid, fromMail);
          }
        }
        if (data.runId) {
          applyTeardownPoll(
            project.id,
            data.runId,
            data,
            data.brandId || runBrandId || undefined,
          );
        }
        setJobStatus(typeof data.status === "string" ? data.status : null);
        if (
          data.status === "awaiting_payment" ||
          data.status === "confirming_payment"
        ) {
          setRunError(null);
        } else if (data.status === "paused") {
          setRunning(false);
          setJobId(null);
          setRunError(null);
        } else if (data.status === "success" || data.status === "failed") {
          setRunning(false);
          setJobId(null);
          if (data.error) setRunError(data.error);
        }
      } catch (e) {
        if (!cancelled) {
          setRunError(e instanceof Error ? e.message : "poll failed");
        }
      } finally {
        inFlight = false;
      }
    };
    void tick();
    const id = window.setInterval(tick, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, project?.id]);

  // Poll running runs that have an agent job (e.g. after batch deposit + manual pay).
  // Stable key so this effect doesn't restart (and re-fetch) on every poll patch.
  const backgroundJobKey = project
    ? project.runs
        .filter(
          (r) =>
            r.status === "running" && r.agentJobId && r.agentJobId !== jobId,
        )
        .map((r) => `${r.id}|${r.agentJobId}|${r.brandId}`)
        .join("\n")
    : "";
  useEffect(() => {
    if (!project || !backgroundJobKey) return;
    const running = backgroundJobKey.split("\n").map((k) => {
      const [id, agentJobId, brandId] = k.split("|");
      return { id: id!, agentJobId: agentJobId!, brandId: brandId! };
    });
    const projectId = project.id;

    let cancelled = false;
    let inFlight = false;
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      for (const run of running) {
        if (cancelled) break;
        try {
          const res = await fetch(
            `/api/research/teardown?jobId=${encodeURIComponent(run.agentJobId)}`,
            { cache: "no-store" },
          );
          const data = await res.json();
          if (cancelled || data.status === "none") continue;
          if (typeof data.signupEmail === "string" && data.signupEmail) {
            saveBrandAccountEmail(projectId, run.brandId, data.signupEmail);
          }
          if (typeof data.signupPassword === "string" && data.signupPassword) {
            saveBrandAccountPassword(
              projectId,
              run.brandId,
              data.signupPassword,
            );
          }
          if (Array.isArray(data.emails) && data.emails.length) {
            mergeResearchEmails(projectId, data.emails);
          }
          applyTeardownPoll(projectId, run.id, data, run.brandId);
        } catch {
          // ignore poll errors
        }
      }
      inFlight = false;
    };
    void tick();
    const id = window.setInterval(tick, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundJobKey, project?.id]);

  async function runSignupVerify() {
    if (isProductionDeployPublic()) {
      setRunError(NEW_REPORTS_LOCKED_MESSAGE);
      return;
    }
    if (!project || !activeBrandId) return;
    const brand = project.brands.find((b) => b.id === activeBrandId);
    if (!brand) return;
    setRunError(null);
    setTrail(["Creating remote browser…"]);
    setRunning(true);

    let run = latestRun;
    if (!run || run.status === "complete" || run.status === "failed") {
      const created = createDraftRun(project.id, activeBrandId, kind);
      if (!created) {
        setRunning(false);
        setRunError("Could not create run");
        return;
      }
      run = created;
    }
    patchResearchRun(project.id, run.id, { status: "running" });

    try {
      const res = await fetch("/api/research/teardown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: run.id,
          projectId: project.id,
          brandId: brand.id,
          brandUrl: brand.url,
          brandName: brand.name,
          market: project.market,
          device: project.device,
          kind,
          persona: project.persona,
          throughStage: "verification",
          accountEmail: brand.accountEmail ?? null,
          accountPassword: lockBrandCredentials(project, brand.id) || null,
          accountPhone: brand.accountPhone ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed to start");
      if (typeof data.signupEmail === "string" && data.signupEmail) {
        saveBrandAccountEmail(project.id, brand.id, data.signupEmail);
      }
      if (typeof data.signupPassword === "string" && data.signupPassword) {
        saveBrandAccountPassword(project.id, brand.id, data.signupPassword);
      }
      setRunBrandId(brand.id);
      setJobId(data.jobId);
      setLiveViewUrl(data.liveViewUrl ?? null);
    } catch (e) {
      setRunning(false);
      setRunError(e instanceof Error ? e.message : "failed to start");
      patchResearchRun(project.id, run.id, {
        status: "failed",
        error: e instanceof Error ? e.message : "failed",
      });
    }
  }

  /**
   * Skip a stage that is never going to finish (funds not landing). Live
   * agent: pause first, then resume past it once the browser has closed.
   * Paused / stalled run: resume past it straight away.
   */
  async function skipStage(stageId: string) {
    if (!SKIPPABLE_STAGES.includes(stageId) || !latestRun) return;
    if (
      !confirm(
        "Skip this stage? The agent moves on to casino discovery, game launch and first bet without waiting for the deposit. Nothing after this point is scored (test).",
      )
    ) {
      return;
    }
    setSkippingStage(stageId);
    if (jobId && jobStatus === "confirming_payment") {
      setPendingSkip(true);
      await pauseAgent();
      return;
    }
    if (jobId && jobStatus === "awaiting_payment" && latestRun.agentJobId) {
      // Tell the waiting deposit job to walk on without funds (same as
      // Notifications → Skip for test).
      try {
        const actionId =
          (
            await (
              await fetch(
                `/api/research/teardown?jobId=${encodeURIComponent(jobId)}`,
                { cache: "no-store" },
              )
            ).json()
          ).actionId ?? null;
        if (typeof actionId === "string" && actionId) {
          await fetch(`/api/research/actions/${actionId}/paid`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "skip" }),
          });
          setSkippingStage(null);
          return;
        }
      } catch {
        /* fall through to pause + skip path */
      }
    }
    // Paused / stalled run: log back in and carry on with a $0 balance. If we
    // know the address and are mid-watch, also record the post-payment screen.
    const midWatch =
      stageId === "deposit_confirmation" &&
      Boolean(resumeInfoForRun(latestRun));
    await startTeardownRun("first_bet", {
      resume: true,
      ...(midWatch ? { forceAhead: true } : { skipToPlay: true }),
    });
    setSkippingStage(null);
  }

  async function pauseAgent() {
    stopRequestedRef.current = true;
    setPausing(true);
    setRunning(false);
    setBatchRunning(false);
    setDepositBatchRunning(false);
    setFeatureScanProgress(null);
    setBatchProgress("Force stopped");
    setDepositBatchProgress(null);
    if (project) {
      for (const r of project.runs) {
        if (r.status === "running" && r.agentJobId) {
          patchResearchRun(project.id, r.id, {
            status: "paused",
            error: "Force stopped",
          });
        }
      }
    }
    const id = jobId;
    setJobId(null);
    setJobStatus("paused");
    setLiveViewUrl(null);
    try {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 4000);
      await fetch("/api/research/teardown/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: id, force: true }),
        signal: ctrl.signal,
      }).catch(() => {});
      window.clearTimeout(timer);
    } finally {
      setPausing(false);
    }
  }

  async function startBrandResearch() {
    if (isProductionDeployPublic()) {
      setRunError(NEW_REPORTS_LOCKED_MESSAGE);
      return;
    }
    if (!project || !activeBrandId) return;
    const brand = project.brands.find((b) => b.id === activeBrandId);
    if (!brand) return;
    const accountEmail = resolveResearchSignupEmail({
      brandName: brand.name,
      brandAccountEmail: brand.accountEmail,
      personaEmail: project.persona?.email,
      fresh: !brandHasTestAccount(project, brand.id),
    });
    saveBrandAccountEmail(project.id, brand.id, accountEmail);
    lockBrandCredentials(project, brand.id);
    setRunBrandId(brand.id);
    await startTeardownRun("first_bet");
  }

  /** Deposit already credited — stop the watch and play on this balance. */
  async function continueAfterFunds() {
    const brandId =
      runBrandId ||
      activeBrandId ||
      project?.brands.find((b) => b.role === "own_brand")?.id ||
      project?.brands[0]?.id;
    if (!project || !brandId) {
      setRunError("No brand to continue.");
      return;
    }
    setPausing(false);
    setRunError(null);
    setTrail(["Funds are in — starting casino and first bet…"]);
    setRunning(true);
    setBrandId(brandId);
    setRunBrandId(brandId);
    const hungJob = jobId;
    if (hungJob) {
      setJobId(null);
      setJobStatus(null);
      void fetch("/api/research/teardown/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: hungJob, force: true }),
      }).catch(() => {});
    }
    stopRequestedRef.current = false;
    const brandName =
      project.brands.find((b) => b.id === brandId)?.name ?? "";
    await startTeardownRun("first_bet", {
      brandId,
      redoPlay: true,
      fundsLanded: true,
      landedShotUrl: /betonline/i.test(brandName)
        ? "/research-evidence/betonline-deposit-success.jpg"
        : undefined,
    });
  }

  /** Stop the live agent (if any), wipe this brand's run, and restart registration. */
  async function runAgainBrand() {
    if (isProductionDeployPublic()) {
      setRunError(NEW_REPORTS_LOCKED_MESSAGE);
      return;
    }
    const brandId = runBrandId || activeBrandId;
    if (!project || !brandId) return;
    const brand = project.brands.find((b) => b.id === brandId);
    if (
      !confirm(
        `Wipe${brand ? ` ${brand.name}` : ""}'s run and restart registration from scratch? A new +alias email is minted.`,
      )
    ) {
      return;
    }
    if (jobId) {
      await pauseAgent();
      await new Promise((r) => setTimeout(r, 1500));
    }
    stopRequestedRef.current = false;
    setRunning(false);
    setJobId(null);
    setJobStatus(null);
    setLiveViewUrl(null);
    setTrail([]);
    setRunError(null);
    setBrandId(brandId);
    setRunBrandId(brandId);
    // Clear runs / emails / accountReady so we never skip to deposit on a
    // half-finished Cloudflare signup.
    resetBrandFresh(project.id, brandId);
    lockBrandCredentials(getResearchProject(project.id) ?? project, brandId);
    await startTeardownRun("first_bet", { brandId });
  }

  async function startTeardownRun(
    throughStage: ThroughStage,
    opts?: {
      resume?: boolean;
      /** Pick a paused deposit watch back up (same run). */
      resumeWatch?: boolean;
      /** Test: don't wait for funds — record the "I've paid" screen and move on. */
      forceAhead?: boolean;
      /** Test: skip the deposit altogether and play on a $0 balance. */
      skipToPlay?: boolean;
      /** Funded account: redo casino discovery → game launch → first bet. */
      redoPlay?: boolean;
      /** Money already credited — skip the watch and play on this balance. */
      fundsLanded?: boolean;
      landedShotUrl?: string;
      /** Override which brand to run (setState may not have flushed yet). */
      brandId?: string;
    },
  ) {
    if (!project) return;
    stopRequestedRef.current = false;
    const targetBrandId = opts?.brandId || activeBrandId;
    if (!targetBrandId) return;
    const liveProject = getResearchProject(project.id) ?? project;
    const brand = liveProject.brands.find((b) => b.id === targetBrandId);
    if (!brand) return;
    setRunError(null);
    setTrail(["Creating remote browser…"]);
    setRunning(true);
    setRunBrandId(brand.id);
    setBrandId(brand.id);

    const resumeExisting =
      opts?.resume === true || brandHasTestAccount(liveProject, brand.id);
    if (resumeExisting) {
      markBrandAccountReady(liveProject.id, brand.id, true);
    }
    let run =
      liveProject.runs
        .filter((r) => r.brandId === brand.id && r.kind === kind && !r.archived)
        .at(-1) ?? null;
    // A paused deposit watch resumes in place — same run, same stages.
    const reusable =
      run != null &&
      (run.status === "paused" ||
        run.status === "running" ||
        run.status === "failed");
    const resumeWatch =
      (opts?.resumeWatch === true || opts?.forceAhead === true) && reusable
        ? resumeInfoForRun(run)
        : null;
    const skipToPlay = opts?.skipToPlay === true && reusable && run != null;
    const fundsLanded = opts?.fundsLanded === true;
    if (
      !run ||
      (run.status === "complete" && !fundsLanded && opts?.redoPlay !== true) ||
      ((run.status === "paused" || run.status === "failed") &&
        !resumeWatch &&
        !skipToPlay &&
        !fundsLanded &&
        opts?.redoPlay !== true)
    ) {
      const created = createDraftRun(liveProject.id, brand.id, kind);
      if (!created) {
        setRunning(false);
        setRunError("Could not create run");
        return;
      }
      run = created;
    }
    const redoPlay = opts?.redoPlay === true || fundsLanded;
    // Redo play: clear the three play stages locally too so the cards go
    // back to "Capturing…" instead of showing the old frames.
    const seedStages = redoPlay
      ? run.stages.map((st) => {
          if (fundsLanded && st.stageId === "deposit_confirmation") {
            const shot = opts.landedShotUrl;
            const brandName =
              liveProject.brands.find((b) => b.id === brand.id)?.name ?? "";
            const ownShots = (st.screenshotUrls ?? []).filter(
              (u) => u && !u.includes("betonline-deposit-success"),
            );
            return {
              ...st,
              startedAt: st.startedAt ?? new Date().toISOString(),
              endedAt: st.endedAt ?? new Date().toISOString(),
              timeSec: 0,
              waitSec: 0,
              friction: undefined,
              frictionType: null,
              severity: null,
              evidence: /betonline/i.test(brandName)
                ? "On-site: Your deposit was successful · $11.61 USD · Start playing. Chain wait is not scored. Play clock resets at casino discovery."
                : /betus/i.test(brandName)
                  ? "Phone confirmed the deposit. Site balance did not update until a manual refresh. No email, no toast, no alert. Chain wait is not scored. Play clock resets at casino discovery."
                  : "Deposit confirmed. Chain wait is not scored. Play clock resets at casino discovery.",
              screenshotUrls: shot
                ? [shot, ...ownShots.filter((u) => u !== shot)]
                : ownShots,
            };
          }
          if (
            st.stageId === "casino_discovery" ||
            st.stageId === "game_launch" ||
            st.stageId === "first_bet" ||
            st.stageId === "days_1_14"
          ) {
            return {
              ...st,
              steps: null,
              timeSec: null,
              waitSec: null,
              severity: null,
              friction: undefined,
              userImpact: undefined,
              frictionType: null,
              evidence: undefined,
              screenshotUrls: [],
              startedAt: null,
              endedAt: null,
            };
          }
          return st;
        })
      : run.stages;
    patchResearchRun(project.id, run.id, {
      status: "running",
      ...(redoPlay ? { stages: seedStages, lobby: null } : {}),
      ...(fundsLanded ? { clockFair: true } : {}),
    });

    try {
      const startAt =
        fundsLanded || skipToPlay || redoPlay
          ? "play"
          : resumeWatch
            ? "deposit_confirmation"
            : resumeExisting
              ? "deposit"
              : "registration";
      const accountEmail = resolveResearchSignupEmail({
        brandName: brand.name,
        brandAccountEmail: brand.accountEmail,
        personaEmail: project.persona?.email,
        fresh: startAt === "registration",
      });
      if (accountEmail && accountEmail !== brand.accountEmail) {
        saveBrandAccountEmail(project.id, brand.id, accountEmail);
      }
      const res = await fetch("/api/research/teardown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: run.id,
          projectId: project.id,
          brandId: brand.id,
          brandUrl: brand.url,
          brandName: brand.name,
          market: project.market,
          device: project.device,
          kind,
          persona: project.persona,
          throughStage,
          startAt,
          resumeWatch,
          forceAhead: resumeWatch ? opts?.forceAhead === true : false,
          replayPlay: redoPlay,
          seedStages:
            resumeWatch || skipToPlay || redoPlay || resumeExisting
              ? seedStages
              : null,
          seedDepositWatch:
            resumeWatch || skipToPlay || redoPlay
              ? (run.depositWatch ?? [])
              : null,
          accountEmail,
          accountPassword: lockBrandCredentials(project, brand.id) || null,
          accountPhone: brand.accountPhone ?? null,
          accountUsername: brand.accountUsername ?? null,
          accountNumber: brand.accountNumber ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed to start");
      if (typeof data.signupEmail === "string" && data.signupEmail) {
        saveBrandAccountEmail(project.id, brand.id, data.signupEmail);
      }
      if (typeof data.signupPassword === "string" && data.signupPassword) {
        saveBrandAccountPassword(project.id, brand.id, data.signupPassword);
      }
      setRunBrandId(brand.id);
      setJobId(data.jobId);
      setLiveViewUrl(data.liveViewUrl ?? null);
      patchResearchRun(project.id, run.id, { agentJobId: data.jobId });
    } catch (e) {
      setRunning(false);
      setRunError(e instanceof Error ? e.message : "failed to start");
      patchResearchRun(project.id, run.id, {
        status: "failed",
        error: e instanceof Error ? e.message : "failed",
      });
    }
  }

  /**
   * Post-journey feature inventory for every brand we hold an account for.
   * Sequential (one browser at a time); attaches the scan to the brand's
   * latest run so the Feature benchmark fills in.
   */
  /**
   * Voice of Player: read each brand's last-6-months Trustpilot reviews and
   * store the synthesis on the brand. One brand at a time (each scrape is a
   * Browserbase session behind Cloudflare); a failure on one brand is shown
   * and the loop moves on.
   */
  async function readPlayerVoiceForBrand(brand: {
    id: string;
    name: string;
    url: string;
  }) {
    if (!project) throw new Error("No project");
    if (isProductionDeployPublic()) {
      throw new Error(NEW_REPORTS_LOCKED_MESSAGE);
    }
    const res = await fetch("/api/research/player-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandUrl: brand.url,
        brandName: brand.name,
        journeyContext: journeyContextForBrand(project.runs, brand.id),
      }),
    });
    const data = (await res.json()) as {
      playerVoice?: import("@/lib/research/types").PlayerVoice;
      error?: string;
    };
    if (!res.ok || !data.playerVoice) {
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    const evidenceCount = [
      ...data.playerVoice.complaints,
      ...data.playerVoice.asks,
      ...data.playerVoice.stuck,
      ...data.playerVoice.praise,
    ].reduce((n, t) => n + (t.evidence?.length ?? 0), 0);
    console.info(
      `[voice] ${brand.name}: ${data.playerVoice.sampled} scraped, ${evidenceCount} evidence reviews on themes`,
    );
    saveBrandPlayerVoice(project.id, brand.id, data.playerVoice);
  }

  async function readPlayerVoiceAllBrands() {
    if (!project) return;
    setVoiceError(null);
    const failures: string[] = [];
    for (const [i, b] of project.brands.entries()) {
      setVoiceProgress(
        `${b.name} (${i + 1}/${project.brands.length}) · reading Trustpilot…`,
      );
      try {
        await readPlayerVoiceForBrand(b);
      } catch (e) {
        failures.push(
          `${b.name}: ${e instanceof Error ? e.message : "failed"}`,
        );
      }
    }
    setVoiceProgress(null);
    if (failures.length) setVoiceError(failures.join(" · "));
  }

  async function scanBrandFeatures(
    brandId: string,
    opts?: { loggedOut?: boolean; progressPrefix?: string },
  ) {
    if (isProductionDeployPublic()) {
      setRunError(NEW_REPORTS_LOCKED_MESSAGE);
      return;
    }
    if (!project) return;
    const live = getResearchProject(project.id) ?? project;
    const brand = live.brands.find((b) => b.id === brandId);
    if (!brand) return;
    const run =
      latestRunForBrand(live.runs, brand.id) ??
      createDraftRun(live.id, brand.id, "new_player_first_bet");
    if (!run) return;
    const loggedOut =
      opts?.loggedOut === true || !brandHasTestAccount(live, brand.id);
    setRunBrandId(brand.id);
    setRunError(null);
    setTrail([]);
    setFeatureScanProgress(
      `${opts?.progressPrefix ?? ""}${brand.name} — ${
        loggedOut ? "logged out scan…" : "logging in…"
      }`,
    );
    const res = await fetch("/api/research/teardown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: run.id,
        projectId: live.id,
        brandId: brand.id,
        brandUrl: brand.url,
        brandName: brand.name,
        market: live.market,
        device: live.device,
        kind: "new_player_first_bet",
        persona: live.persona,
        throughStage: "first_bet",
        startAt: "features",
        seedStages: run.stages,
        accountEmail: loggedOut ? null : brand.accountEmail ?? null,
        accountPassword: loggedOut
          ? null
          : lockBrandCredentials(live, brand.id) || null,
        accountPhone: loggedOut ? null : brand.accountPhone ?? null,
        accountUsername: loggedOut ? null : brand.accountUsername ?? null,
        accountNumber: loggedOut ? null : brand.accountNumber ?? null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "failed to start");
    const scanJobId = data.jobId as string;
    setJobId(scanJobId);
    if (data.liveViewUrl) setLiveViewUrl(data.liveViewUrl);
    patchResearchRun(live.id, run.id, { agentJobId: scanJobId });
    const deadline = Date.now() + 10 * 60_000;
    let goneMisses = 0;
    for (;;) {
      if (stopRequestedRef.current) break;
      await new Promise((r) => setTimeout(r, 3000));
      const poll = await fetch(
        `/api/research/teardown?jobId=${encodeURIComponent(scanJobId)}`,
        { cache: "no-store" },
      );
      const status = await poll.json();
      if (status.status === "none") {
        goneMisses += 1;
        if (goneMisses >= JOB_GONE_POLLS) {
          throw new Error(
            "Lost contact with this brand's browser. Retry the scan.",
          );
        }
        continue;
      }
      goneMisses = 0;
      if (status.liveViewUrl) setLiveViewUrl(status.liveViewUrl);
      if (Array.isArray(status.steps)) {
        setTrail(status.steps);
        const last = String(status.steps[status.steps.length - 1] ?? "");
        setFeatureScanProgress(
          `${opts?.progressPrefix ?? ""}${brand.name} — ${last.slice(0, 90) || "scanning…"}`,
        );
      }
      applyTeardownPoll(live.id, run.id, status, brand.id);
      if (status.features) {
        patchResearchRun(live.id, run.id, { features: status.features });
      }
      if (status.status === "success") return;
      if (status.status === "failed") {
        throw new Error(status.error ?? "scan failed");
      }
      if (Date.now() >= deadline) throw new Error("Feature scan timed out");
    }
  }

  async function scanActiveBrandLoggedOut() {
    if (!project || !activeBrandId) return;
    stopRequestedRef.current = false;
    try {
      await scanBrandFeatures(activeBrandId, { loggedOut: true });
    } catch (e) {
      setRunError(
        e instanceof Error ? e.message : "Logged-out scan failed",
      );
    } finally {
      setFeatureScanProgress(null);
    }
  }

  async function depositAllBrands() {
    if (isProductionDeployPublic()) {
      setRunError(NEW_REPORTS_LOCKED_MESSAGE);
      return;
    }
    if (!project) return;
    const ready = project.brands.filter((b) =>
      brandHasTestAccount(project, b.id),
    );
    if (ready.length === 0) {
      setRunError(
        "No brands with a verified account yet. Sign up comps first; for BetOnline (account already exists) open that brand and use Login → deposit.",
      );
      return;
    }
    setDepositBatchRunning(true);
    setDepositBatchProgress(null);
    setRunError(null);
    stopRequestedRef.current = false;
    let queued = 0;

    for (let i = 0; i < ready.length; i++) {
      if (stopRequestedRef.current) break;
      const brand = ready[i]!;
      setDepositBatchProgress(
        `${i + 1}/${ready.length}: ${brand.name} — opening cashier…`,
      );
      const run = createDraftRun(project.id, brand.id, "new_player_first_bet");
      if (!run) continue;
      patchResearchRun(project.id, run.id, { status: "running" });

      try {
        const res = await fetch("/api/research/teardown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId: run.id,
            projectId: project.id,
            brandId: brand.id,
            brandUrl: brand.url,
            brandName: brand.name,
            market: project.market,
            device: project.device,
            kind: "new_player_first_bet",
            persona: project.persona,
            throughStage: "first_bet",
            startAt: "deposit",
            accountEmail: brand.accountEmail ?? null,
            accountPassword: lockBrandCredentials(project, brand.id) || null,
            accountPhone: brand.accountPhone ?? null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "failed");
        if (typeof data.signupEmail === "string" && data.signupEmail) {
          saveBrandAccountEmail(project.id, brand.id, data.signupEmail);
        }
        if (typeof data.signupPassword === "string" && data.signupPassword) {
          saveBrandAccountPassword(project.id, brand.id, data.signupPassword);
        }
        const jobId = data.jobId as string;
        patchResearchRun(project.id, run.id, { agentJobId: jobId });

        const deadline = Date.now() + 15 * 60_000;
        let goneMisses = 0;
        for (;;) {
          if (stopRequestedRef.current) break;
          await new Promise((r) => setTimeout(r, 3000));
          const poll = await fetch(
            `/api/research/teardown?jobId=${encodeURIComponent(jobId)}`,
          );
          const status = await poll.json();
          if (typeof status.signupEmail === "string" && status.signupEmail) {
            saveBrandAccountEmail(project.id, brand.id, status.signupEmail);
          }
          if (Array.isArray(status.emails) && status.emails.length) {
            mergeResearchEmails(project.id, status.emails);
          }
          if (status.status === "none") {
            goneMisses += 1;
            if (goneMisses >= JOB_GONE_POLLS) {
              throw new Error(
                "Lost contact with this brand's browser. Re-run deposit for this brand.",
              );
            }
            continue;
          }
          goneMisses = 0;
          applyTeardownPoll(project.id, run.id, status, brand.id);
          if (status.status === "awaiting_payment") {
            queued += 1;
            break;
          }
          if (status.status === "success") {
            break;
          }
          if (status.status === "failed") {
            break;
          }
          if (Date.now() >= deadline) {
            patchResearchRun(project.id, run.id, {
              error: "Timed out before deposit address was captured",
            });
            break;
          }
        }
      } catch (e) {
        patchResearchRun(project.id, run.id, {
          status: "failed",
          error: e instanceof Error ? e.message : "failed",
        });
      }

      if (i < ready.length - 1) {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    setDepositBatchRunning(false);
    setDepositBatchProgress(
      queued > 0
        ? `${queued} deposit address${queued === 1 ? "" : "es"} in Notifications — pay each separately`
        : "Done — check Notifications for any addresses",
    );
  }

  async function signUpAllBrands(opts?: { skipBrandIds?: string[] }) {
    if (isProductionDeployPublic()) {
      setRunError(NEW_REPORTS_LOCKED_MESSAGE);
      return;
    }
    const live = project ? getResearchProject(project.id) : null;
    if (!live) return;
    const skipBrandIds = opts?.skipBrandIds ?? [];
    selectTab("journeys");
    setBatchHalt(null);
    stopRequestedRef.current = false;
    setBatchRunning(true);
    const alreadyReady = live.brands.filter((b) =>
      brandHasTestAccount(live, b.id),
    ).length;
    setBatchProgress(
      alreadyReady > 0
        ? `Signing up remaining brands (skipping ${alreadyReady} with accounts)…`
        : "Starting first-impression → signup…",
    );
    setRunError(null);
    // Don't mix leftover deposit-batch messages into the signup trail.
    setDepositBatchProgress(null);
    setTrail([]);
    setLiveViewUrl(null);
    const brands = live.brands;
    const failures: string[] = [];
    let halted = false;

    for (let i = 0; i < brands.length && !halted; i++) {
      if (stopRequestedRef.current) {
        halted = true;
        break;
      }
      const brand = brands[i]!;
      const latest = getResearchProject(live.id) ?? live;
      if (skipBrandIds.includes(brand.id)) {
        setBatchProgress(
          `${i + 1}/${brands.length}: ${brand.name} — skipped by you`,
        );
        continue;
      }
      if (brandHasTestAccount(latest, brand.id)) {
        setBatchProgress(
          `${i + 1}/${brands.length}: ${brand.name} — already has account, skip signup`,
        );
        continue;
      }
      const freshBrand = latest.brands.find((b) => b.id === brand.id) ?? brand;
      const accountEmail = resolveResearchSignupEmail({
        brandName: freshBrand.name,
        brandAccountEmail: freshBrand.accountEmail,
        personaEmail: latest.persona?.email,
        fresh: true,
      });
      saveBrandAccountEmail(latest.id, freshBrand.id, accountEmail);
      lockBrandCredentials(latest, freshBrand.id);
      setRunBrandId(freshBrand.id);
      setTrail(["Creating remote browser…"]);
      setBatchProgress(
        `${i + 1}/${brands.length}: ${brand.name} — full journey (landing → first bet)…`,
      );
      const run = createDraftRun(
        live.id,
        freshBrand.id,
        "new_player_first_bet",
      );
      if (!run) continue;
      patchResearchRun(live.id, run.id, { status: "running" });
      try {
        const res = await fetch("/api/research/teardown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId: run.id,
            projectId: live.id,
            brandId: freshBrand.id,
            brandUrl: freshBrand.url,
            brandName: freshBrand.name,
            market: live.market,
            device: live.device,
            kind: "new_player_first_bet",
            persona: live.persona,
            // Finish landing → signup → deposit → first play on THIS brand
            // before starting the next competitor.
            throughStage: "first_bet",
            accountEmail,
            accountPassword:
              resolveBrandAccountPassword(latest, freshBrand.id) || null,
            accountPhone: freshBrand.accountPhone ?? null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "failed to start teardown");
        if (typeof data.signupEmail === "string" && data.signupEmail) {
          saveBrandAccountEmail(live.id, freshBrand.id, data.signupEmail);
        }
        if (typeof data.signupPassword === "string" && data.signupPassword) {
          saveBrandAccountPassword(live.id, freshBrand.id, data.signupPassword);
        }
        const jobId = data.jobId as string;
        patchResearchRun(live.id, run.id, { agentJobId: jobId });
        setJobId(jobId);
        setRunning(true);
        if (data.liveViewUrl) setLiveViewUrl(data.liveViewUrl);

        let goneMisses = 0;
        for (;;) {
          if (stopRequestedRef.current) {
            halted = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 2500));
          const poll = await fetch(
            `/api/research/teardown?jobId=${encodeURIComponent(jobId)}`,
          );
          const status = await poll.json();
          if (status.liveViewUrl) setLiveViewUrl(status.liveViewUrl);
          if (Array.isArray(status.steps)) {
            setTrail(status.steps);
            const last = status.steps[status.steps.length - 1];
            setBatchProgress(
              `${i + 1}/${brands.length}: ${brand.name} — ${last ?? "running…"}`,
            );
          }
          if (typeof status.signupEmail === "string" && status.signupEmail) {
            saveBrandAccountEmail(live.id, freshBrand.id, status.signupEmail);
          }
          if (Array.isArray(status.emails) && status.emails.length) {
            mergeResearchEmails(live.id, status.emails);
          }
          if (status.status === "none") {
            goneMisses += 1;
            if (goneMisses >= JOB_GONE_POLLS) {
              throw new Error(
                "Lost contact with this brand's browser. Retry it, or skip and continue the batch.",
              );
            }
            continue;
          }
          goneMisses = 0;
          applyTeardownPoll(live.id, run.id, status, freshBrand.id);
          if (
            status.status === "awaiting_payment" ||
            status.status === "confirming_payment"
          ) {
            setBatchProgress(
              `${i + 1}/${brands.length}: ${brand.name} — waiting for deposit (Notifications)`,
            );
            continue;
          }
          if (status.status === "awaiting_sms") {
            setBatchProgress(
              `${i + 1}/${brands.length}: ${brand.name} — waiting for SMS code (Notifications)`,
            );
            continue;
          }
          if (status.status === "success") {
            setBatchProgress(
              `${i + 1}/${brands.length}: ${brand.name} — journey complete`,
            );
            break;
          }
          if (status.status === "failed") {
            const err = status.error || "journey failed";
            failures.push(`${brand.name}: ${err}`);
            applyTeardownPoll(live.id, run.id, status, freshBrand.id);
            setBatchProgress(
              `${i + 1}/${brands.length}: ${brand.name} — failed`,
            );
            // Stop the batch here — don't roll on to the next competitor
            // while this one is broken. User decides: retry or skip.
            halted = true;
            setBatchHalt({
              brandId: freshBrand.id,
              brandName: brand.name,
              error: err,
              skipped: skipBrandIds,
            });
            setBrandId(freshBrand.id);
            break;
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "failed";
        failures.push(`${brand.name}: ${msg}`);
        setRunError(msg);
        setBatchProgress(`${i + 1}/${brands.length}: ${brand.name} — ${msg}`);
        patchResearchRun(live.id, run.id, {
          status: "failed",
          error: msg,
        });
        halted = true;
        setBatchHalt({
          brandId: freshBrand.id,
          brandName: brand.name,
          error: msg,
          skipped: skipBrandIds,
        });
        setBrandId(freshBrand.id);
      }
    }

    setBatchRunning(false);
    setRunning(false);
    if (halted) {
      setBatchProgress(
        `Stopped — ${failures[failures.length - 1] ?? "a brand failed"}`,
      );
    } else if (failures.length) {
      setRunError(failures.join(" · "));
      setBatchProgress(
        `Done with ${failures.length} failure${failures.length === 1 ? "" : "s"}`,
      );
    } else {
      setBatchProgress("All brand journeys finished (landing → first bet)");
    }
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-sm text-[var(--rs-muted)]">
        Project not found.{" "}
        <Link href="/research/projects" className="text-[var(--rs-accent)]">
          Back to projects
        </Link>
      </div>
    );
  }

  const own = project.brands.find((b) => b.role === "own_brand");

  const runLive = project.runs.some((r) => r.status === "running");
  const agentBusy =
    batchRunning ||
    depositBatchRunning ||
    running ||
    featureScanProgress != null;
  const showLiveBar =
    agentBusy ||
    runLive ||
    jobStatus === "running" ||
    jobStatus === "confirming_payment" ||
    jobStatus === "awaiting_payment";
  const agentBrandName =
    project.brands.find((b) => b.id === runBrandId)?.name ?? null;
  const agentStep =
    trail[trail.length - 1] ??
    batchProgress ??
    depositBatchProgress ??
    featureScanProgress ??
    (agentBusy ? "Starting…" : null);

  async function startFreshCapture() {
    if (isProductionDeployPublic()) {
      setRunError(NEW_REPORTS_LOCKED_MESSAGE);
      return;
    }
    if (!project) return;
    if (
      !confirm(
        "Wipe all brand reports, mint new +alias emails, and sign up every brand from scratch?",
      )
    ) {
      return;
    }
    resetAllBrandsFresh(project.id);
    setRunError(null);
    setTrail([]);
    setLiveViewUrl(null);
    setJobId(null);
    setRunBrandId(null);
    setDepositBatchProgress(null);
    selectTab("journeys");
    const first = project.brands[0];
    if (first) setBrandId(first.id);
    await signUpAllBrands();
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-start gap-4">
        {own ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={
              own.favicon ||
              `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
                own.url,
              )}&sz=128`
            }
            alt=""
            className="size-14 shrink-0 rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] object-contain p-1.5"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--rs-muted)]">
            <Link
              href="/research/projects"
              className="hover:text-[var(--rs-fg)]"
            >
              Projects
            </Link>
            {" / "}
            {project.name}
          </p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">
            {own?.name ?? project.name}
          </h1>
          <p className="mt-1 text-sm text-[var(--rs-muted)]">
            {project.device} teardown
          </p>
        </div>
      </div>

      {showLiveBar ? (
        <div className="rs-live-bar sticky top-2 z-20 flex flex-col gap-2 rounded-xl border bg-[var(--rs-card)] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-[var(--rs-accent)]">
                <span className="rs-live-dot" aria-hidden />
                Agent running
              </p>
              <p className="mt-0.5 truncate text-sm font-medium text-[var(--rs-fg)]">
                {agentBrandName ? (
                  <>
                    <span className="text-[var(--rs-accent)]">
                      {agentBrandName}
                    </span>
                    {" · "}
                  </>
                ) : null}
                {agentStep ?? "Starting…"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {runBrandId ? (
                <button
                  type="button"
                  onClick={() => {
                    setBrandId(runBrandId);
                    selectTab("journeys");
                  }}
                  className="cursor-pointer rounded-lg border border-[var(--rs-border)] px-3 py-1.5 text-xs text-[var(--rs-fg)]"
                >
                  Open brand
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void pauseAgent()}
                title="Force stop now and release the remote browser so it stops billing."
                className="cursor-pointer rounded-lg border border-red-500/50 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/10"
              >
                {pausing ? "Stopping…" : "Force stop"}
              </button>
              {jobId &&
              (jobStatus === "confirming_payment" ||
                /deposit success|funds landed|balance \d/i.test(
                  agentStep ?? "",
                )) ? (
                <button
                  type="button"
                  onClick={() => void continueAfterFunds()}
                  title="Money is already in. Continue to casino and first bet — do not pay again."
                  className="cursor-pointer rounded-lg bg-[var(--rs-accent)] px-3 py-1.5 text-xs font-medium text-[var(--rs-bg)]"
                >
                  Funds landed — continue
                </button>
              ) : null}
              {jobId &&
              (jobStatus === "confirming_payment" ||
                jobStatus === "awaiting_payment" ||
                /deposit/i.test(agentStep ?? "")) ? (
                <button
                  type="button"
                  disabled={skippingStage != null}
                  onClick={() =>
                    void skipStage(
                      jobStatus === "awaiting_payment"
                        ? "deposit"
                        : "deposit_confirmation",
                    )
                  }
                  title="Skip deposit and continue with a $0 balance (test)."
                  className="cursor-pointer rounded-lg border border-[var(--rs-border)] px-3 py-1.5 text-xs text-[var(--rs-fg)] hover:bg-[var(--rs-bg)] disabled:opacity-50"
                >
                  {skippingStage ? "Skipping…" : "Skip"}
                </button>
              ) : null}
              {jobId || runBrandId ? (
                <button
                  type="button"
                  disabled={pausing}
                  onClick={() => void runAgainBrand()}
                  title="Stop this run and start the full research flow again for this brand."
                  className="cursor-pointer rounded-lg border border-[var(--rs-border)] px-3 py-1.5 text-xs text-[var(--rs-fg)] hover:bg-[var(--rs-bg)] disabled:opacity-50"
                >
                  Run again
                </button>
              ) : null}
              {liveViewUrl ? (
                <a
                  href={liveViewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-[var(--rs-accent)] px-3 py-1.5 text-xs font-medium text-[var(--rs-bg)]"
                >
                  Watch live
                </a>
              ) : null}
            </div>
          </div>
          <span className="rs-live-line" aria-hidden />
        </div>
      ) : null}

      <nav className="-mb-px flex gap-1 border-b border-[var(--rs-border)]">
        {(
          [
            ["journeys", "Journeys", Route],
            ["benchmark", "Benchmark", Scale],
            ["voice", "Voice of Player", MessageSquareQuote],
            ["email", "Email Freq", Mail],
            ["report", "Report", FileText],
          ] as const
        ).map(([id, label, Icon]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              className={cn(
                "relative -mb-px inline-flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors",
                active
                  ? "border-[var(--rs-accent)] font-medium text-[var(--rs-fg)]"
                  : "border-transparent text-[var(--rs-muted)] hover:text-[var(--rs-fg)]",
              )}
            >
              <Icon className="size-3.5 opacity-70" strokeWidth={1.75} />
              {label}
            </button>
          );
        })}
      </nav>

      {tab === "persona" ? (
        <PersonaForm
          project={project}
          initial={project.persona}
          market={project.market}
          onSave={(persona) => {
            saveResearchPersona(project.id, persona);
          }}
          onMarkReady={(id, ready) => {
            markBrandAccountReady(project.id, id, ready);
            if (ready) lockBrandCredentials(project, id);
          }}
          onResetBrand={(id) => {
            if (
              !confirm(
                "New email for this brand, clear its runs/emails, and mark not registered?",
              )
            ) {
              return;
            }
            resetBrandFresh(project.id, id);
          }}
          onResetAll={() => {
            if (
              !confirm(
                "Reset ALL brands: new emails, wipe runs and emails. Continue?",
              )
            ) {
              return;
            }
            resetAllBrandsFresh(project.id);
            setRunError(null);
            setBatchProgress(
              "All brands reset — start a brand from Journeys",
            );
          }}
        />
      ) : null}

      {tab === "journeys" ? (
        <section className="flex flex-col gap-6">
          <ResearchBrandRoster
            project={project}
            activeBrandId={activeBrandId}
            onSelect={setBrandId}
          />

          {batchHalt && !agentBusy ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  Batch paused at {batchHalt.brandName}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--rs-muted)]">
                  {batchHalt.error} This is the agent session, not a finding
                  about the site.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className="cursor-pointer rounded-lg bg-[var(--rs-accent)] px-3.5 py-2 text-sm font-medium text-[var(--rs-bg)]"
                  onClick={() =>
                    void signUpAllBrands({ skipBrandIds: batchHalt.skipped })
                  }
                >
                  Retry {batchHalt.brandName}
                </button>
                <button
                  type="button"
                  className="cursor-pointer rounded-lg border border-[var(--rs-border)] px-3.5 py-2 text-sm text-[var(--rs-fg)]"
                  onClick={() =>
                    void signUpAllBrands({
                      skipBrandIds: [...batchHalt.skipped, batchHalt.brandId],
                    })
                  }
                >
                  Skip &amp; continue
                </button>
                <button
                  type="button"
                  className="cursor-pointer rounded-lg px-3 py-2 text-sm text-[var(--rs-muted)] hover:text-[var(--rs-fg)]"
                  onClick={() => {
                    setBatchHalt(null);
                    setBatchProgress(null);
                    setRunError(null);
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : runError && (!runBrandId || runBrandId === activeBrandId) ? (
            <p className="text-sm text-red-400">{runError}</p>
          ) : null}

          {latestRun ? (
            <JourneyFrameViewer stages={latestRun.stages}>
              <div className="rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] p-4">
                <h3 className="mb-3 text-sm font-medium">Journey path</h3>
                <ResearchJourneyTimeline
                  stages={latestRun.stages}
                  emailCount={
                    project.emails.filter((e) => e.brandId === activeBrandId)
                      .length
                  }
                  skippableStageIds={SKIPPABLE_STAGES}
                  skippingStageId={skippingStage}
                  onSkipStage={(stageId) => void skipStage(stageId)}
                />
              </div>

              <StageEvidenceGallery
                stages={latestRun.stages}
                acquisitionSource={latestRun.acquisitionSource}
                emails={project.emails
                  .filter((e) => e.brandId === activeBrandId)
                  .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))}
                watchingInbox={agentBusy && runBrandId === activeBrandId}
              />

              {(latestRun.status === "paused" ||
                latestRun.status === "failed" ||
                (latestRun.status === "running" && !agentBusy)) &&
              !agentBusy &&
              !brandHasTestAccount(project, activeBrandId) ? (
                <div className="rs-card flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--rs-muted)]">
                      Registration incomplete
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--rs-fg)]">
                      Signup did not finish. Scan casino, features and rewards
                      logged out — or wipe and try registration again.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={agentBusy}
                      onClick={() => void scanActiveBrandLoggedOut()}
                      className="cursor-pointer rounded-lg bg-[var(--rs-accent)] px-3 py-1.5 text-xs font-medium text-[var(--rs-bg)] disabled:opacity-50"
                    >
                      Scan logged out
                    </button>
                    <button
                      type="button"
                      onClick={() => void runAgainBrand()}
                      className="cursor-pointer rounded-lg border border-[var(--rs-border)] px-3 py-1.5 text-xs font-medium text-[var(--rs-fg)]"
                    >
                      Rerun registration
                    </button>
                  </div>
                </div>
              ) : null}

              {latestRun &&
              !latestRun.stages.some(
                (s) => s.stageId === "first_bet" && s.endedAt,
              ) &&
              latestRun.stages.some(
                (s) => s.stageId === "deposit" && s.endedAt,
              ) &&
              (jobStatus === "confirming_payment" ||
                latestRun.status === "running" ||
                latestRun.status === "paused" ||
                latestRun.status === "failed") ? (
                <div className="rs-card flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                      Deposit already in
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--rs-fg)]">
                      {/betonline/i.test(
                        project.brands.find((b) => b.id === activeBrandId)
                          ?.name ?? "",
                      )
                        ? "Success screen was captured ($11.61 USD). Do not pay again — continue to casino and first bet on this balance."
                        : /betus/i.test(
                              project.brands.find((b) => b.id === activeBrandId)
                                ?.name ?? "",
                            )
                          ? "Deposit is in on your phone. The site stayed stale until refresh — no email or alert. Continue to casino and first bet. Do not pay again."
                          : "Funds are in. Do not pay again — continue to casino and first bet on this balance."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void continueAfterFunds()}
                    className="cursor-pointer rounded-lg bg-[var(--rs-accent)] px-3 py-1.5 text-xs font-medium text-[var(--rs-bg)]"
                  >
                    Funds landed — continue
                  </button>
                </div>
              ) : null}

              {(latestRun.status === "paused" ||
                (latestRun.status === "failed" &&
                  resumeInfoForRun(latestRun))) &&
              !agentBusy ? (
                <div className="rs-card flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-amber-300">
                      {latestRun.status === "failed"
                        ? "Run stopped"
                        : "Run paused"}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--rs-fg)]">
                      {resumeInfoForRun(latestRun)
                        ? "Browser closed while funds are in transit. Resume to keep watching balance, inbox and chain — or carry on with a $0 balance to test the rest of the flow."
                        : "Browser closed. Log back in and carry on with a $0 balance — lobby, game launch and the site's response to a wager are still recorded."}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {resumeInfoForRun(latestRun) ? (
                      <button
                        type="button"
                        onClick={() =>
                          void startTeardownRun("first_bet", {
                            resume: true,
                            resumeWatch: true,
                          })
                        }
                        className="cursor-pointer rounded-lg bg-[var(--rs-accent)] px-3 py-1.5 text-xs font-medium text-[var(--rs-bg)]"
                      >
                        Resume deposit watch
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          !confirm(
                            "Continue without the deposit? The agent logs in and carries on to casino discovery, game launch and a wager attempt on a $0 balance. Nothing after the deposit is scored (test).",
                          )
                        ) {
                          return;
                        }
                        void startTeardownRun("first_bet", {
                          resume: true,
                          ...(resumeInfoForRun(latestRun)
                            ? { forceAhead: true }
                            : { skipToPlay: true }),
                        });
                      }}
                      className="cursor-pointer rounded-lg border border-dashed border-amber-500/40 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/10"
                    >
                      Continue with $0 balance (test)
                    </button>
                  </div>
                </div>
              ) : null}

              {latestRun.postSignup ||
              knownSignupLanding(
                project.brands.find((b) => b.id === activeBrandId)?.name ?? "",
              ) ? (
                <PostSignupCard
                  obs={latestRun.postSignup ?? emptyPostSignup()}
                  brandName={
                    project.brands.find((b) => b.id === activeBrandId)?.name ??
                    "this brand"
                  }
                  welcomeEmailSubject={
                    pickWelcomeEmail(
                      project.emails,
                      activeBrandId,
                      latestRun.id,
                    )?.subject ?? null
                  }
                />
              ) : null}

              {latestRun.postDeposit ? (
                <PostDepositCard
                  obs={latestRun.postDeposit}
                  brandName={
                    project.brands.find((b) => b.id === activeBrandId)?.name ??
                    "this brand"
                  }
                />
              ) : null}

              {activeBrandId ? (
                <WalkInsightsCard project={project} brandId={activeBrandId} />
              ) : null}

              <MetricsScorecard metrics={latestRun.metrics} />

              <StageDetailTable stages={latestRun.stages} />

              <div className="rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)]">
                <div className="px-4 py-3">
                  <h3 className="text-sm font-medium">Top 3 friction points</h3>
                  <p className="mt-0.5 text-xs text-[var(--rs-muted)]">
                    Ranked from measured time + effort + wait + severity + stage
                    business weight — not visual polish alone.
                  </p>
                </div>
                {(latestRun.topFriction?.length ?? 0) > 0 ? (
                  <div className="overflow-x-auto border-t border-[var(--rs-border)]">
                    <table className="rs-table rs-fixed min-w-[960px]">
                      <colgroup>
                        <col style={{ width: 48 }} />
                        <col style={{ width: 220 }} />
                        <col />
                        <col style={{ width: 180 }} />
                        <col style={{ width: 220 }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="rs-num">#</th>
                          <th>Friction</th>
                          <th>Evidence</th>
                          <th>Impact</th>
                          <th>Why it matters</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestRun.topFriction.map((t) => (
                          <tr key={t.rank}>
                            <td className="rs-num font-medium">{t.rank}</td>
                            <td className="font-medium">{t.friction}</td>
                            <td className="rs-muted">
                              {cellText(t.evidence) ?? "—"}
                            </td>
                            <td className="rs-muted">
                              {cellText(t.impact) ?? "—"}
                            </td>
                            <td className="rs-muted">
                              {cellText(t.whyItMatters) ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="border-t border-[var(--rs-border)] px-4 py-3 text-xs text-[var(--rs-muted)]">
                    Runs after a completed journey — needs friction observations
                    from the agent.
                  </p>
                )}
              </div>
            </JourneyFrameViewer>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--rs-border)] px-6 py-12 text-center">
              <p className="text-sm text-[var(--rs-muted)]">
                No run yet for{" "}
                <span className="font-medium text-[var(--rs-fg)]">
                  {project.brands.find((b) => b.id === activeBrandId)?.name ??
                    "this brand"}
                </span>
                .
              </p>
              <p className="mt-1 text-xs text-[var(--rs-muted)]">
                Full flow: landing → signup → verify → deposit → first bet, with
                screenshots and inbox evidence.
              </p>
              <button
                type="button"
                disabled={agentBusy}
                onClick={() => void startBrandResearch()}
                className="mt-5 cursor-pointer rounded-lg bg-[var(--rs-accent)] px-4 py-2 text-sm font-medium text-[var(--rs-bg)] disabled:cursor-default disabled:opacity-50"
              >
                Start Research
              </button>
            </div>
          )}
        </section>
      ) : null}

      {tab === "benchmark" ? <BenchmarkTab project={project} /> : null}

      {tab === "voice" ? (
        <PlayerVoiceTab
          project={project}
          onRun={() => void readPlayerVoiceAllBrands()}
          onRefreshBrand={async (brandId) => {
            const b = project.brands.find((x) => x.id === brandId);
            if (!b) return;
            setVoiceError(null);
            setVoiceProgress(`${b.name} · reading Trustpilot…`);
            try {
              await readPlayerVoiceForBrand(b);
            } catch (e) {
              setVoiceError(
                `${b.name}: ${e instanceof Error ? e.message : "failed"}`,
              );
            } finally {
              setVoiceProgress(null);
            }
          }}
          progress={voiceProgress}
          error={voiceError}
        />
      ) : null}

      {tab === "email" ? (
        <EmailWatchPanel
          project={project}
          email={project.persona?.email || DEFAULT_TEST_EMAIL}
          days={project.emailWatchDays}
          onSelectBrand={setBrandId}
        />
      ) : null}

      {tab === "report" ? <ResearchReportView project={project} /> : null}
    </div>
  );
}

/** Prod polls often hit a different isolate than the runner. Wait out a
 * few empty reads before treating the job as gone. */
const JOB_GONE_POLLS = 8;

/** Stored text that should read as empty ("null", "none", "—"). */
function cellText(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return !t || /^(null|none|undefined|n\/a|—|-)$/i.test(t) ? null : t;
}

const SEVERITY_CHIP: Record<string, string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-300",
  high: "border-orange-400/40 bg-orange-400/10 text-orange-300",
  medium: "border-amber-300/40 bg-amber-300/10 text-amber-200",
  low: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
};

/**
 * Stage-by-stage breakdown, grouped into four column bands so it reads left
 * to right: what the stage is → how much effort → what went wrong → proof.
 * Open by default — it's the table reviewers work from.
 */
function StageDetailTable({ stages }: { stages: JourneyStageResult[] }) {
  const ran = stages.filter((s) => s.startedAt || s.endedAt);
  const notRun = stages.filter((s) => !s.startedAt && !s.endedAt);
  const rows = [...ran, ...notRun];
  return (
    <details
      open
      className="group rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)]"
    >
      <summary className="cursor-pointer list-none px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          <span>
            <span className="text-sm font-medium">Stage detail</span>
            <span className="ml-2 text-xs text-[var(--rs-muted)]">
              {ran.length}/{stages.length} stages reached
            </span>
          </span>
          <span className="text-xs text-[var(--rs-muted)] group-open:hidden">
            Show
          </span>
          <span className="hidden text-xs text-[var(--rs-muted)] group-open:inline">
            Hide
          </span>
        </span>
      </summary>
      <div className="overflow-x-auto border-t border-[var(--rs-border)]">
        <table className="rs-table rs-fixed min-w-[1240px]">
          {/* Fixed column plan so every row lines up regardless of copy length.
              Fixed widths sum to ~960px; the Issue column takes the rest (≥280). */}
          <colgroup>
            <col style={{ width: 150 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 60 }} />
            <col />
            <col style={{ width: 120 }} />
            <col style={{ width: 200 }} />
            <col style={{ width: 90 }} />
          </colgroup>
          <thead>
            <tr className="rs-band-row">
              <th colSpan={2}>Stage</th>
              <th className="rs-band" colSpan={4}>
                Effort
              </th>
              <th className="rs-band" colSpan={2}>
                Friction
              </th>
              <th className="rs-band" colSpan={2}>
                Proof
              </th>
            </tr>
            <tr>
              <th>Step</th>
              <th>Player goal → action</th>
              <th className="rs-band rs-num">Clicks</th>
              <th className="rs-num">Time</th>
              <th className="rs-num">Wait</th>
              <th className="rs-num">Fields</th>
              <th className="rs-band">Issue · impact</th>
              <th>Fix · severity</th>
              <th className="rs-band">Evidence</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const reached = Boolean(s.startedAt || s.endedAt);
              const measured = reached && !isSkippedStage(s);
              const recovered =
                s.stageId === "registration"
                  ? recoverRegistrationMetrics(s)
                  : null;
              const clicks = measured
                ? s.steps
                : recovered?.steps != null
                  ? recovered.steps
                  : null;
              const time = measured
                ? s.timeSec
                : recovered?.timeSec != null
                  ? recovered.timeSec
                  : null;
              const friction = cellText(s.friction);
              const impact = cellText(s.userImpact);
              const evidence = cellText(s.evidence);
              const type = cellText(s.frictionType);
              const sev = s.severity ?? null;
              const shots = [...new Set(s.screenshotUrls ?? [])];
              return (
                <tr key={s.stageId} className={cn(!reached && "rs-dim")}>
                  <td>
                    <span className="font-medium">{s.label}</span>
                    <span className="rs-sub">
                      {s.screen}
                      {!reached ? " · not reached" : ""}
                    </span>
                  </td>
                  <td>
                    <span>{s.userAction}</span>
                    <span className="rs-sub">{s.userGoal}</span>
                  </td>
                  <td className="rs-band rs-num">
                    {clicks != null ? clicks : "—"}
                  </td>
                  <td className="rs-num">
                    {time != null ? formatSec(time) : "—"}
                  </td>
                  <td
                    className={cn(
                      "rs-num",
                      measured && (s.waitSec ?? 0) >= 10 && "text-amber-300",
                    )}
                  >
                    {measured ? formatSec(s.waitSec) : "—"}
                  </td>
                  <td className="rs-num">
                    {s.fieldCount != null && s.fieldCount > 0
                      ? s.fieldCount
                      : "—"}
                  </td>
                  <td className="rs-band">
                    {friction ? (
                      <>
                        <span>{friction}</span>
                        {impact ? (
                          <span className="rs-sub">{impact}</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="rs-muted">
                        {reached ? "None observed" : "—"}
                      </span>
                    )}
                  </td>
                  <td>
                    {/* Chips sit on the text line (18px) so the row baseline holds. */}
                    <div className="flex h-[18px] flex-wrap items-center gap-1">
                      {type ? (
                        <span className="rounded-md border border-[var(--rs-border)] px-1.5 py-0.5 text-[10px] capitalize text-[var(--rs-muted)]">
                          {type.replace("_", " ")}
                        </span>
                      ) : null}
                      {sev ? (
                        <span
                          className={cn(
                            "rounded-md border px-1.5 py-0.5 text-[10px] capitalize",
                            SEVERITY_CHIP[sev] ?? "border-[var(--rs-border)]",
                          )}
                        >
                          {sev}
                        </span>
                      ) : null}
                      {!type && !sev ? (
                        <span className="text-xs text-[var(--rs-muted)]">
                          —
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="rs-band">
                    <span
                      className={cn(
                        "line-clamp-2 break-all",
                        evidence ? "" : "rs-muted",
                      )}
                      title={evidence ?? undefined}
                    >
                      {evidence ?? "—"}
                    </span>
                    {/* Frames under the caption — each opens the full screenshot. */}
                    {shots.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {shots.slice(0, 6).map((src, i) => (
                          <FrameThumb
                            key={src}
                            src={src}
                            alt={`${s.label} ${i + 1}`}
                            caption={`${s.label} · ${i + 1}/${shots.length}${evidence ? ` — ${evidence}` : ""}`}
                            className="h-8 w-8 border-[var(--rs-border)]"
                          />
                        ))}
                        {shots.length > 6 ? (
                          <span className="text-[10px] text-[var(--rs-muted)]">
                            +{shots.length - 6}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="rs-muted">{cellText(s.owner) ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function EmailWatchPanel({
  project,
  email,
  days,
  onSelectBrand,
}: {
  project: import("@/lib/research/types").ResearchProject;
  email: string;
  days: number;
  onSelectBrand: (brandId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const syncOnce = useRef(false);

  const brandName = (id: string) =>
    project.brands.find((b) => b.id === id)?.name ??
    (id === "unassigned" ? "Unassigned" : id);

  async function syncInbox() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(researchInboxListUrl(project, email), {
        signal: AbortSignal.timeout(95_000),
      });
      const data = await res.json();
      if (!data.configured) {
        setStatus("IMAP not configured");
        return;
      }
      if (!res.ok || data.error) {
        setStatus(
          typeof data.error === "string" ? data.error : "Inbox sync failed",
        );
        return;
      }
      const items = (data.messages ??
        []) as import("@/lib/research/types").EmailWatchItem[];
      mergeResearchEmails(project.id, items);
      syncBrandAccountsFromEmails(project.id);
      markInboxSwept(project.id);
      setFilter("all");
      const live = getResearchProject(project.id) ?? project;
      const shown = emailsForDisplay(live);
      const before = project.emails.length;
      const after = live.emails.length;
      const added = Math.max(0, after - before);
      setStatus(
        items.length === 0
          ? "Inbox had no mail for these brands in the window"
          : shown.length === 0
            ? `Pulled ${items.length} — none landed on the timeline`
            : `Pulled ${items.length} · ${shown.length} on the timeline${added ? ` (+${added})` : ""}`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "sync failed");
    } finally {
      setBusy(false);
    }
  }

  // CRM cadence is daily. Pull when this tab opens if the last sweep is
  // older than 15 minutes — overnight promos should not wait for the
  // project-wide daily sweep.
  useEffect(() => {
    if (syncOnce.current) return;
    if (project.emails.length === 0) return;
    const last = project.lastInboxSweepAt
      ? Date.parse(project.lastInboxSweepAt)
      : 0;
    if (last && Date.now() - last < 15 * 60 * 1000) return;
    syncOnce.current = true;
    void syncInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const unique = emailsForDisplay(project);
  const leftover = unique.filter(
    (e) => !project.brands.some((b) => b.id === e.brandId),
  );
  const emails = unique.filter((e) =>
    filter === "all"
      ? true
      : filter === "unassigned"
        ? leftover.some((x) => x.id === e.id)
        : e.brandId === filter,
  );

  const filterBrand = project.brands.find((b) => b.id === filter);
  const countFor = (brandId?: string) =>
    brandId
      ? unique.filter((e) => e.brandId === brandId).length
      : unique.length;

  return (
    <section className="flex flex-col gap-4 text-sm">
      <div>
        <h2 className="font-heading text-lg font-medium text-[var(--rs-fg)]">
          Email Freq
        </h2>
        <p className="mt-1 text-[var(--rs-muted)]">
          {days} days after signup — welcome, bonus, VIP cadence. Login alerts
          are dropped. Sync to pull now.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs ${
            filter === "all"
              ? "border-[var(--rs-accent)] bg-[var(--rs-accent)]/10 text-[var(--rs-fg)]"
              : "border-[var(--rs-border)] text-[var(--rs-muted)]"
          }`}
        >
          All ({countFor()})
        </button>
        {project.brands.map((b) => {
          const n = countFor(b.id);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setFilter(b.id);
                onSelectBrand(b.id);
              }}
              className={`shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs ${
                filter === b.id
                  ? "border-[var(--rs-accent)] bg-[var(--rs-accent)]/10 text-[var(--rs-fg)]"
                  : "border-[var(--rs-border)] text-[var(--rs-muted)]"
              }`}
            >
              {b.name} ({n})
            </button>
          );
        })}
        {leftover.length ? (
          <button
            type="button"
            onClick={() => setFilter("unassigned")}
            className={`shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs ${
              filter === "unassigned"
                ? "border-[var(--rs-accent)] bg-[var(--rs-accent)]/10 text-[var(--rs-fg)]"
                : "border-[var(--rs-border)] text-[var(--rs-muted)]"
            }`}
          >
            Unassigned ({leftover.length})
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void syncInbox()}
          className="cursor-pointer rounded-lg border border-[var(--rs-border)] px-3 py-2 text-sm text-[var(--rs-fg)] disabled:opacity-50"
        >
          {busy ? "Syncing…" : "Sync inbox"}
        </button>
        {status ? (
          <span className="text-xs text-[var(--rs-muted)]">{status}</span>
        ) : null}
      </div>

      {emails.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--rs-border)] p-8 text-center text-[var(--rs-muted)]">
          {filter === "all"
            ? "No emails yet — run a fresh capture."
            : `No emails for ${filter === "unassigned" ? "unassigned" : filterBrand?.name ?? "this brand"} yet.`}
        </div>
      ) : filter === "all" ? (
        <div className="flex flex-col gap-10">
          {project.brands.map((b) => {
            const mine = unique.filter((e) => e.brandId === b.id);
            if (!mine.length) return null;
            return (
              <div key={b.id} className="flex flex-col gap-3">
                <h3 className="font-heading text-base font-medium">
                  {b.name}
                  <span className="ml-2 text-xs font-normal tabular-nums text-[var(--rs-muted)]">
                    {mine.length}
                  </span>
                </h3>
                <ResearchEmailTimeline emails={mine} brandName={() => ""} />
              </div>
            );
          })}
          {leftover.length ? (
            <div className="flex flex-col gap-3">
              <h3 className="font-heading text-base font-medium">
                Unassigned
                <span className="ml-2 text-xs font-normal tabular-nums text-[var(--rs-muted)]">
                  {leftover.length}
                </span>
              </h3>
              <ResearchEmailTimeline emails={leftover} brandName={brandName} />
            </div>
          ) : null}
        </div>
      ) : (
        <ResearchEmailTimeline emails={emails} brandName={() => ""} />
      )}
    </section>
  );
}

/**
 * A benchmark cell: the value right-aligned, then a fixed-width evidence slot
 * so every number in a column lines up whether or not it has frames.
 */
function MetricCell({
  value,
  sub,
  frames,
  text,
}: {
  value: string;
  /** Small annotation under the value (e.g. which brand was best). */
  sub?: string;
  frames: import("@/components/research-evidence-thumbs").EvidenceFrame[];
  /** Text values truncate instead of wrapping. */
  text?: boolean;
}) {
  return (
    <span className="flex items-center justify-end gap-1.5">
      <span className="flex min-w-0 flex-col items-end">
        <span
          className={cn(
            "tabular-nums",
            text && "max-w-[160px] truncate",
            value === "—" && "text-[var(--rs-muted)]",
          )}
          title={text && value.length > 18 ? value : undefined}
        >
          {value}
        </span>
        {sub ? (
          <span className="text-[10px] leading-3 text-[var(--rs-muted)]">
            {sub}
          </span>
        ) : null}
      </span>
      <EvidenceThumbs frames={frames} />
    </span>
  );
}

const FEATURE_MATRIX_ROWS = [
  ...FEATURE_BENCHMARK_ROWS.map((row) => ({
    ...row,
    kind: "feature" as const,
  })),
  ...ENGAGEMENT_ROWS.map((row) => ({
    area: "Engagement",
    criteria: row.criteria,
    kind: "engagement" as const,
    re: row.re,
  })),
];

function featureAreaSpan(index: number): number {
  const row = FEATURE_MATRIX_ROWS[index];
  if (!row) return 0;
  if (index > 0 && FEATURE_MATRIX_ROWS[index - 1]?.area === row.area) return 0;
  let n = 1;
  while (FEATURE_MATRIX_ROWS[index + n]?.area === row.area) n++;
  return n;
}

/** Qualitative feature cell — wraps, never spills into the next brand. */
function FeatureCell({
  value,
  frames,
}: {
  value: string;
  frames: import("@/components/research-evidence-thumbs").EvidenceFrame[];
}) {
  const empty = value === "—";
  const split = /^(Yes|No)\s*[·—]\s*(.+)$/.exec(value);
  const main = split ? split[1]! : value;
  const note = split ? split[2]!.replace(/^["“]|["”]$/g, "") : null;
  return (
    <span className="flex items-start gap-2">
      <span
        className={cn("min-w-0 flex-1", empty && "rs-muted")}
        title={note && note.length > 40 ? note : undefined}
      >
        <span className="block">{main}</span>
        {note ? <span className="rs-sub line-clamp-2">{note}</span> : null}
      </span>
      {frames.length > 0 ? <EvidenceThumbs frames={frames} /> : null}
    </span>
  );
}

function BenchmarkTab({
  project,
}: {
  project: import("@/lib/research/types").ResearchProject;
}) {
  const own = project.brands.find((b) => b.role === "own_brand");
  // Each brand's stopwatch numbers, merged across its runs (signup in one,
  // deposit/play in a later resume) so a resumed run never blanks the table.
  const merged = new Map<string, ReturnType<typeof teardownForBrand>>();
  for (const b of project.brands) {
    merged.set(
      b.id,
      teardownForBrand(project.runs, b.id, {
        emails: project.emails,
        stored: project.teardowns.find((t) => t.brandId === b.id) ?? null,
      }),
    );
  }
  const teardownOf = (brandId: string | undefined) => {
    if (!brandId) return null;
    const m = merged.get(brandId);
    if (m) return m.teardown;
    return project.teardowns.find((t) => t.brandId === brandId) ?? null;
  };
  const sourcesOf = (brandId: string | undefined) =>
    (brandId && merged.get(brandId)?.sources) || null;
  const evidenceFor = (
    brandId: string | undefined,
    block: "registration" | "deposit" | "activation" | "total",
  ) => {
    const src = sourcesOf(brandId);
    if (!src) return [];
    switch (block) {
      case "registration":
        return stageFrames(src.registration?.stages, ["registration"]);
      case "deposit":
        return stageFrames(src.deposit?.stages, [
          "deposit",
          "deposit_confirmation",
        ]);
      case "activation":
        return stageFrames(src.activation?.stages, [
          "casino_discovery",
          "game_launch",
          "first_bet",
        ]);
      default:
        return [
          ...stageFrames(src.registration?.stages, ["registration"]),
          ...stageFrames(src.deposit?.stages, [
            "deposit",
            "deposit_confirmation",
          ]),
          ...stageFrames(src.activation?.stages, [
            "casino_discovery",
            "game_launch",
            "first_bet",
          ]),
        ];
    }
  };
  const blockForMetric = (
    metric: string,
  ): "registration" | "deposit" | "activation" | "total" =>
    /registration|field/i.test(metric)
      ? "registration"
      : /deposit → first bet|first bet/i.test(metric)
        ? "activation"
        : /deposit/i.test(metric)
          ? "deposit"
          : "total";
  const brandIdByName = new Map(project.brands.map((b) => [b.name, b.id]));

  const ownTeardown = teardownOf(own?.id);

  const competitorRows = project.brands
    .filter((b) => b.role === "competitor")
    .map((b) => {
      const td = teardownOf(b.id);
      return td ? { name: b.name, teardown: td } : null;
    })
    .filter(Boolean) as {
    name: string;
    teardown: import("@/lib/research/types").CompetitorTeardown;
  }[];

  const comparison = buildJourneyComparison(ownTeardown, competitorRows);
  const gaps = competitorGapInsights(
    own?.name ?? "Own brand",
    ownTeardown,
    competitorRows,
  );

  const format = (n: number | null, unit: "sec" | "count") => {
    if (n == null) return "—";
    return unit === "sec" ? formatSec(n) : String(n);
  };

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h2 className="font-heading text-lg font-medium">
          What they do better
        </h2>
        <p className="mt-1 text-sm text-[var(--rs-muted)]">
          Strategy gaps from the stopwatch — activation path and Time to stake
          (≤12 min OKR). Lower time and fewer actions win.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {gaps.map((g) => (
            <li
              key={g.title + g.body}
              className={cn(
                "rounded-xl border px-3.5 py-3",
                g.tone === "protect"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : g.tone === "gap"
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-[var(--rs-border)] bg-[var(--rs-card)]",
              )}
            >
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs font-medium text-[var(--rs-fg)]">
                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--rs-muted)]">
                  {g.tone === "protect"
                    ? "Protect"
                    : g.tone === "gap"
                      ? "Gap"
                      : "Next"}
                </span>
                {g.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--rs-muted)]">
                {g.body}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="font-heading text-lg font-medium">Journey comparison</h2>
        <p className="mt-1 text-sm text-[var(--rs-muted)]">
          Own brand vs best competitor — stopwatch teardown.
        </p>
        <div className="rs-table-wrap mt-4">
          <table className="rs-table rs-fixed rs-evidence min-w-[640px]">
            <colgroup>
              <col />
              <col style={{ width: 140 }} />
              <col style={{ width: 220 }} />
              <col style={{ width: 90 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Journey metric</th>
                <th className="rs-num">{own?.name ?? "Own brand"}</th>
                <th className="rs-num">Best competitor</th>
                <th className="rs-num">Gap</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.metric}>
                  <td>
                    <span className="font-medium">{row.metric}</span>
                    {row.okrHint ? (
                      <span className="rs-sub">{row.okrHint}</span>
                    ) : null}
                  </td>
                  <td className="rs-num">
                    <MetricCell
                      value={format(row.own, row.unit)}
                      frames={
                        row.own != null
                          ? evidenceFor(own?.id, blockForMetric(row.metric))
                          : []
                      }
                    />
                  </td>
                  <td className="rs-num">
                    <MetricCell
                      value={format(row.best, row.unit)}
                      sub={row.bestBrand ?? undefined}
                      frames={
                        row.best != null && row.bestBrand
                          ? evidenceFor(
                              brandIdByName.get(row.bestBrand),
                              blockForMetric(row.metric),
                            )
                          : []
                      }
                    />
                  </td>
                  <td className="rs-num">
                    {row.gapRatio != null ? (
                      <span className="inline-flex flex-col items-end gap-0.5">
                        <span
                          className={
                            row.gapRatio > 1.2
                              ? "text-red-400"
                              : row.gapRatio <= 1
                                ? "text-emerald-400"
                                : ""
                          }
                        >
                          {row.gapRatio}×
                        </span>
                        <span className="text-[10px] leading-3 text-[var(--rs-muted)]">
                          {row.gapRatio < 1
                            ? "you win"
                            : row.gapRatio > 1
                              ? "behind"
                              : "tied"}
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PostDepositComparison project={project} />

      <div>
        <h2 className="font-heading text-lg font-medium">
          Competitor teardown totals
        </h2>
        <div className="rs-table-wrap mt-4">
          <table className="rs-table rs-evidence min-w-[860px]">
            <thead>
              <tr className="rs-band-row">
                <th />
                <th className="rs-band" colSpan={3}>
                  Registration
                </th>
                <th className="rs-band" colSpan={2}>
                  Deposit
                </th>
                <th className="rs-band" colSpan={2}>
                  Deposit → first bet
                </th>
                <th className="rs-band" />
              </tr>
              <tr>
                <th>Brand</th>
                <th className="rs-band rs-num">Time</th>
                <th className="rs-num">Steps</th>
                <th className="rs-num">Fields</th>
                <th className="rs-band rs-num">Time</th>
                <th className="rs-num">Steps</th>
                <th className="rs-band rs-num">Time</th>
                <th className="rs-num">Clicks</th>
                <th className="rs-band rs-num">Total onboarding</th>
              </tr>
            </thead>
            <tbody>
              {project.brands.map((b) => {
                const td = teardownOf(b.id);
                const cell = (
                  value: string,
                  block: "registration" | "deposit" | "activation" | "total",
                ) => (
                  <MetricCell
                    value={value}
                    frames={value !== "—" ? evidenceFor(b.id, block) : []}
                  />
                );
                return (
                  <tr key={b.id} className={cn(!td && "rs-dim")}>
                    <td className="font-medium">
                      {b.name}
                      {b.role === "own_brand" ? (
                        <span className="ml-1 text-[10px] font-normal text-[var(--rs-muted)]">
                          you
                        </span>
                      ) : null}
                    </td>
                    <td className="rs-band rs-num">
                      {cell(
                        format(td?.registrationTimeSec ?? null, "sec"),
                        "registration",
                      )}
                    </td>
                    <td className="rs-num">
                      {cell(
                        td?.registrationSteps != null
                          ? String(td.registrationSteps)
                          : "—",
                        "registration",
                      )}
                    </td>
                    <td className="rs-num">
                      {cell(
                        td?.totalFields != null ? String(td.totalFields) : "—",
                        "registration",
                      )}
                    </td>
                    <td className="rs-band rs-num">
                      {cell(
                        format(td?.depositTimeSec ?? null, "sec"),
                        "deposit",
                      )}
                    </td>
                    <td className="rs-num">
                      {cell(
                        td?.depositSteps != null
                          ? String(td.depositSteps)
                          : "—",
                        "deposit",
                      )}
                    </td>
                    <td className="rs-band rs-num">
                      {cell(
                        format(td?.depositToFirstBetSec ?? null, "sec"),
                        "activation",
                      )}
                    </td>
                    <td className="rs-num">
                      {cell(
                        td?.depositToFirstBetClicks != null
                          ? String(td.depositToFirstBetClicks)
                          : "—",
                        "activation",
                      )}
                    </td>
                    <td className="rs-band rs-num font-medium">
                      {cell(
                        format(td?.totalOnboardingTimeSec ?? null, "sec"),
                        "total",
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg font-medium">
          Feature benchmark
        </h2>
        <p className="mt-1 text-sm text-[var(--rs-muted)]">
          Filled from the teardown and the post-journey feature scan (nav,
          rewards, casino lobby, sportsbook, account). A dash means not
          observed yet.
        </p>
        <div className="rs-table-wrap mt-4">
          <table
            className="rs-table rs-features"
            style={{
              minWidth: 300 + 196 * Math.max(project.brands.length, 1),
            }}
          >
            <colgroup>
              <col style={{ width: 108 }} />
              <col style={{ width: 192 }} />
              {project.brands.map((b) => (
                <col key={b.id} style={{ width: 196 }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th>Area</th>
                <th>Criteria</th>
                {project.brands.map((b) => {
                  const loggedOut = Boolean(
                    latestRunForBrand(project.runs, b.id)?.features?.loggedOut,
                  );
                  return (
                    <th key={b.id} className="rs-brand">
                      {b.name}
                      {loggedOut ? (
                        <span className="rs-sub">Logged out</span>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX_ROWS.map((row, i) => {
                const span = featureAreaSpan(i);
                return (
                  <tr
                    key={`${row.area}-${row.criteria}`}
                    className={span > 0 && i > 0 ? "rs-area-start" : undefined}
                  >
                    {span > 0 ? (
                      <td className="rs-area" rowSpan={span}>
                        {row.area}
                      </td>
                    ) : null}
                    <td>{row.criteria}</td>
                    {project.brands.map((b) => {
                      const run = latestRunForBrand(project.runs, b.id);
                      const value =
                        row.kind === "engagement"
                          ? engagementCell(run, row.re)
                          : featureBenchmarkCell(
                              row.area,
                              row.criteria,
                              teardownOf(b.id),
                              run,
                              b.name,
                            );
                      const frames =
                        value === "—" || value === "No"
                          ? []
                          : featureBenchmarkEvidence(
                              row.area,
                              sourcesOf(b.id),
                              run,
                              b.name,
                            );
                      return (
                        <td key={b.id} className="rs-feature">
                          <FeatureCell value={value} frames={frames} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function MetricsScorecard({
  metrics,
}: {
  metrics: import("@/lib/research/types").JourneyMetrics;
}) {
  const rows: [string, string][] = [
    ["Total journey time", formatSec(metrics.totalTimeSec)],
    ["Total user actions", metrics.totalActions?.toString() ?? "—"],
    ["Total screens", metrics.totalScreens?.toString() ?? "—"],
    ["Total form fields", metrics.totalFormFields?.toString() ?? "—"],
    ["Total wait time", formatSec(metrics.totalWaitSec)],
    ["Redirects / context switches", metrics.redirects?.toString() ?? "—"],
    ["Errors encountered", metrics.errors?.toString() ?? "—"],
    [
      "Time from deposit cleared → first bet",
      formatSec(metrics.depositToFirstBetSec),
    ],
    [
      "Clicks from deposit cleared → first bet",
      metrics.depositToFirstBetClicks?.toString() ?? "—",
    ],
  ];
  return (
    <div className="rs-table-wrap">
      <table className="rs-table rs-fixed">
        <colgroup>
          <col />
          <col style={{ width: 120 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Metric</th>
            <th className="rs-num">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="rs-muted">{k}</td>
              <td
                className={cn("rs-num", v === "—" ? "rs-muted" : "font-medium")}
              >
                {v}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PASSWORD_REVEAL_PIN = "1986";

/**
 * Password used at signup — revealed behind a 4-digit PIN so a shared screen
 * doesn't leak it. Brands registered before per-brand saving used the shared
 * TEST_ACCOUNT_PASSWORD, which we fetch as the fallback.
 */
function BrandPasswordLine({
  password: saved,
  projectId,
  brandId,
}: {
  password: string;
  projectId: string;
  brandId: string;
}) {
  const [show, setShow] = useState(false);
  const [askPin, setAskPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  useEffect(() => {
    if (saved) return;
    let cancelled = false;
    fetch("/api/research/default-password")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || typeof d.password !== "string" || !d.password) return;
        setFallback(d.password);
        // Persist so the next login / resume doesn't depend on the env var.
        saveBrandAccountPassword(projectId, brandId, d.password);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [saved, projectId, brandId]);
  const password = saved || fallback || "";
  if (!password) {
    return (
      <p className="mt-0.5 text-[11px] text-[var(--rs-muted)]">
        Password unavailable — set TEST_ACCOUNT_PASSWORD in .env.local
      </p>
    );
  }

  const submitPin = (value: string) => {
    if (value.length < 4) return;
    if (value === PASSWORD_REVEAL_PIN) {
      setShow(true);
      setAskPin(false);
      setPin("");
      setPinError(false);
    } else {
      setPinError(true);
      setPin("");
    }
  };

  return (
    <>
      <p className="mt-0.5 flex items-center gap-2 text-xs text-[var(--rs-muted)]">
        <span className="shrink-0">Password</span>
        <code className="truncate font-mono text-[var(--rs-fg)]">
          {show ? password : "•".repeat(Math.min(password.length, 12))}
        </code>
        <button
          type="button"
          onClick={() => {
            if (show) setShow(false);
            else {
              setPin("");
              setPinError(false);
              setAskPin(true);
            }
          }}
          aria-label={show ? "Hide password" : "Show password"}
          className="cursor-pointer rounded p-0.5 hover:text-[var(--rs-fg)]"
        >
          {show ? (
            <EyeOff className="size-3.5" strokeWidth={1.75} />
          ) : (
            <Eye className="size-3.5" strokeWidth={1.75} />
          )}
        </button>
        {show ? (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(password).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              });
            }}
            className="cursor-pointer rounded px-1 text-[10px] hover:text-[var(--rs-fg)]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
      </p>
      <Dialog open={askPin} onOpenChange={setAskPin}>
        <DialogContent className="max-w-xs gap-3">
          <DialogTitle className="text-sm font-medium">
            Enter PIN to reveal password
          </DialogTitle>
          <input
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 4);
              setPin(v);
              setPinError(false);
              if (v.length === 4) submitPin(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitPin(pin);
            }}
            placeholder="••••"
            aria-label="4-digit PIN"
            className={cn(
              "w-full rounded-lg border bg-background px-3 py-2.5 text-center font-mono text-lg tracking-[0.5em] outline-none transition-colors focus:border-primary",
              pinError ? "border-red-400" : "border-border",
            )}
          />
          <p
            className={cn(
              "text-xs",
              pinError ? "text-red-300" : "text-muted-foreground",
            )}
          >
            {pinError
              ? "Wrong PIN — try again."
              : "4 digits. Reveals for this card only."}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PersonaForm({
  project,
  initial,
  market,
  onSave,
  onMarkReady,
  onResetBrand,
  onResetAll,
}: {
  project: import("@/lib/research/types").ResearchProject;
  initial: ResearchPersona | null;
  market?: string;
  onSave: (p: ResearchPersona) => void;
  onMarkReady: (brandId: string, ready: boolean) => void;
  onResetBrand: (brandId: string) => void;
  onResetAll: () => void;
}) {
  const [form, setForm] = useState<ResearchPersona>(
    initial ?? defaultResearchPersona(market),
  );
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    for (const b of project.brands) {
      if (b.accountUsername?.trim()) continue;
      const found = resolveBrandAccountUsername(project, b.id);
      if (found) saveBrandAccountUsername(project.id, b.id, found);
    }
  }, [project]);
  const field =
    "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary";

  const applyAddress = (kind: "ca" | "us") => {
    const addr = kind === "ca" ? randomCanadianAddress() : randomUsAddress();
    setForm((f) => ({ ...f, ...addr }));
    setSaved(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-2xl font-medium tracking-tight">
            Brand accounts
          </h2>
          <p className="mt-1 text-sm text-[var(--rs-muted)]">
            Each brand uses a unique Gmail +alias.{" "}
            <strong className="font-medium text-[var(--rs-fg)]">
              Start fresh
            </strong>{" "}
            mints a new alias and clears that brand&apos;s old run.
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {project.brands.map((b) => {
            const ready = brandHasTestAccount(project, b.id);
            return (
              <li
                key={b.id}
                className="flex flex-col gap-3 rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[var(--rs-fg)]">{b.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                        ready
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-[var(--rs-border)] text-[var(--rs-muted)]"
                      }`}
                    >
                      {ready ? "Registered" : "Needs signup"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-[var(--rs-muted)]">
                    {b.accountEmail?.trim() || "No email yet"}
                  </p>
                  {b.accountPhone?.trim() ? (
                    <p className="mt-0.5 text-xs text-[var(--rs-muted)]">
                      SMS {b.accountPhone.trim()}
                    </p>
                  ) : null}
                  {ready ? (
                    <>
                      {resolveBrandAccountUsername(project, b.id) ? (
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-[var(--rs-muted)]">
                          <span className="shrink-0">Username</span>
                          <code className="truncate font-mono text-[var(--rs-fg)]">
                            {resolveBrandAccountUsername(project, b.id)}
                          </code>
                        </p>
                      ) : /betonline/i.test(b.name + b.url) ? (
                        <p className="mt-0.5 text-[11px] text-amber-300/90">
                          BetOnline logs in with an account id, not this email.
                          Check the welcome mail for “Your username is:”.
                        </p>
                      ) : null}
                      <BrandPasswordLine
                        password={resolveBrandAccountPassword(project, b.id)}
                        projectId={project.id}
                        brandId={b.id}
                      />
                    </>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!ready ? (
                    <button
                      type="button"
                      onClick={() => onMarkReady(b.id, true)}
                      disabled={!b.accountEmail?.trim()}
                      className="cursor-pointer rounded-lg border border-[var(--rs-border)] px-3 py-1.5 text-xs text-[var(--rs-muted)] disabled:opacity-40"
                      title="Only if signup already succeeded outside the agent"
                    >
                      Mark registered
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onResetBrand(b.id)}
                    className="cursor-pointer rounded-lg bg-[var(--rs-bg)] px-3 py-1.5 text-xs text-[var(--rs-fg)]"
                  >
                    Start fresh
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={onResetAll}
          className="cursor-pointer self-start text-xs text-[var(--rs-muted)] underline-offset-2 hover:text-red-300 hover:underline"
        >
          Reset all brands (wipe reports)
        </button>
      </section>

      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...form,
            email: form.email.trim() || DEFAULT_TEST_EMAIL,
          });
          setSaved(true);
        }}
      >
        <div>
          <h2 className="font-heading text-xl font-medium tracking-tight">
            Persona kit
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared inbox ({DEFAULT_TEST_EMAIL}). Use a mobile number that can
            receive SMS — codes pause in Notifications for you to paste.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyAddress("ca")}
            className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/60"
          >
            Random Canadian address
          </button>
          <button
            type="button"
            onClick={() => applyAddress("us")}
            className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            Random US address
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["email", "Email", "email"],
              ["password", "Password (optional)", "password"],
              ["dateOfBirth", "Date of birth", "text"],
              ["phone", "Mobile (US +1 if country code is locked)", "tel"],
              ["country", "Country", "text"],
              ["state", "Province / state", "text"],
              ["addressLine1", "Street address", "text"],
              ["city", "City", "text"],
              ["postalCode", "Postal / ZIP", "text"],
            ] as const
          ).map(([key, label, type]) => (
            <label
              key={key}
              className={`flex flex-col gap-1.5 text-sm ${
                key === "addressLine1" ? "sm:col-span-2" : ""
              }`}
            >
              <span className="text-muted-foreground">{label}</span>
              <input
                type={type}
                className={field}
                value={key === "state" ? (form.state ?? "") : (form[key] ?? "")}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [key]: e.target.value }))
                }
                required={key !== "password" && key !== "state"}
                placeholder={
                  key === "dateOfBirth"
                    ? "YYYY-MM-DD"
                    : key === "phone"
                      ? "+1 number that can receive SMS"
                      : undefined
                }
              />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Bovada and most US books lock the country code to +1. A Spanish +34
          number cannot receive their SMS. Use a US mobile, Google Voice, or
          similar — or skip if the site offers verify later.
        </p>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Notes</span>
          <textarea
            className={field}
            rows={2}
            value={form.notes ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary"
          >
            Save persona
          </button>
          {saved ? <span className="text-xs text-primary">Saved</span> : null}
        </div>
      </form>
    </div>
  );
}
