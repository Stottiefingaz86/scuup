"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  KeyRound,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScuupLogo } from "@/components/scuup-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";
import {
  agentCanReach,
  agentCanReachLoggedIn,
  ANALYSIS_AREA_LABELS,
  LANDING,
} from "@/lib/constants";
import {
  getProject,
  markProjectComplete,
  markProjectDraft,
  runDesignReview,
  runVoc,
  useProject,
} from "@/lib/project-store";
import { friendlyAgentError, isBrowserbaseQuotaError, runAgent } from "@/lib/run-agent";
import { ensureEmailVerified } from "@/components/verify-email-banner";
import type { Brand } from "@/lib/types";

type JobState =
  | { phase: "pending" }
  | { phase: "running" }
  | { phase: "done"; score: number }
  | { phase: "blocked" }
  | { phase: "failed"; reason: string };

/** Browserbase free plan allows 3 concurrent sessions. */
const MAX_CONCURRENT = 3;

/** Browserbase also burst-limits session creation to 5 per minute — space
 * out job starts so a batch launch (or fast-failing jobs) can't trip it. */
const MIN_START_GAP_MS = 14000;

const jobKey = (brandId: string, area: string) => `${brandId}:${area}`;

/** The two non-journey score pillars, run as a final phase once the
 * journey walks are done: VoC scrapes public reviews, Design measures the
 * live rendered code. Each needs a browser session, so they go through
 * the same paced queue as journeys. */
const EXTRA_AREAS = ["voc", "design"];

const EXTRA_LABELS: Record<string, string> = {
  voc: "Voice of Customer",
  design: "Design Review",
};

function countScored(
  states: Record<string, JobState>,
  project?: { brands: Brand[] } | null
) {
  const fromRun = Object.values(states).filter((s) => s.phase === "done").length;
  if (fromRun > 0) return fromRun;
  if (!project) return 0;
  return project.brands.reduce(
    (n, b) => n + Object.values(b.analyses).filter((a) => !a.blocked).length,
    0
  );
}

function finishRun(
  projectId: string,
  scored: number,
  router: ReturnType<typeof useRouter>
) {
  if (scored > 0) {
    markProjectComplete(projectId);
    router.replace(`/projects/${projectId}/overview`);
  } else {
    markProjectDraft(projectId);
    router.replace(`/projects/${projectId}/overview?analysis_failed=1`);
  }
}

function AreaChip({
  area,
  state,
  waiting,
}: {
  area: string;
  state: JobState;
  waiting?: boolean;
}) {
  const label = ANALYSIS_AREA_LABELS[area] ?? EXTRA_LABELS[area] ?? area;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
        state.phase === "pending" &&
          (waiting
            ? "border-border/60 text-muted-foreground/45"
            : "border-border text-muted-foreground/60"),
        state.phase === "running" && "border-primary/50 bg-primary/10 text-foreground",
        state.phase === "done" && "border-brand/40 bg-brand/[0.06] text-foreground",
        (state.phase === "blocked" || state.phase === "failed") &&
          "border-score-mid/40 bg-score-mid/[0.06] text-muted-foreground"
      )}
      title={
        state.phase === "failed"
          ? state.reason
          : waiting
            ? "Runs after this brand's journeys finish"
            : undefined
      }
    >
      {state.phase === "running" ? (
        <Loader2 className="size-3 animate-spin text-primary" />
      ) : state.phase === "done" ? (
        <Check className="size-3 text-brand" />
      ) : state.phase === "blocked" ? (
        <ShieldAlert className="size-3 text-score-mid" />
      ) : state.phase === "failed" ? (
        <CircleAlert className="size-3 text-score-weak" />
      ) : (
        <span className="size-3 rounded-full border border-border" />
      )}
      {label}
      {state.phase === "done" ? (
        <span className="font-heading font-semibold tabular-nums">
          {state.score}
        </span>
      ) : null}
    </span>
  );
}

export default function AnalyzingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const project = useProject(params.id);
  const [states, setStates] = useState<Record<string, JobState>>({});
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [runFinished, setRunFinished] = useState<{
    scored: number;
    failed: number;
  } | null>(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const abortRef = useRef(false);

  const leave = (dest: "overview" | "overview_failed" = "overview") => {
    if (!project) return;
    abortRef.current = true;
    finishedRef.current = true;
    const scored = countScored(states, project);
    if (scored > 0) {
      markProjectComplete(project.id);
      router.push(`/projects/${project.id}/overview`);
      return;
    }
    markProjectDraft(project.id);
    router.push(
      dest === "overview_failed"
        ? `/projects/${project.id}/overview?analysis_failed=1`
        : `/projects/${project.id}/overview`
    );
  };

  useEffect(() => {
    if (!project || startedRef.current) return;
    if (project.status === "complete") {
      router.replace(`/projects/${project.id}/overview`);
      return;
    }
    if (project.status !== "analyzing") {
      router.replace(`/projects/${project.id}/overview`);
      return;
    }

    let cancelled = false;

    (async () => {
      const verified = await ensureEmailVerified();
      if (cancelled) return;
      if (!verified) {
        router.replace(`/projects/${project.id}/overview?verify=1`);
        return;
      }
      if (startedRef.current) return;
      startedRef.current = true;

      const brands = [...project.brands];
      const projectId = project.id;
      const publicAreas = [
        LANDING,
        ...project.journeys.filter((j) => agentCanReach(j)),
      ];
      // Gated journeys run in a second phase: the signup run in phase one
      // registers a test account, and phase two reuses that logged-in
      // session for deposit / withdraw / account.
      const gatedAreas = project.journeys.filter(
        (j) => !agentCanReach(j) && agentCanReachLoggedIn(j)
      );

      const setJob = (key: string, state: JobState) =>
        setStates((prev) => ({ ...prev, [key]: state }));

      let successCount = 0;
      let quotaExhausted = false;
      const quotaMessage =
        "Browser session quota exhausted — upgrade Browserbase or wait for the monthly reset.";

      let nextStartAt = 0;
      const runQueue = async (queue: { brand: Brand; area: string }[]) => {
        const workers = Array.from(
          { length: Math.min(MAX_CONCURRENT, queue.length) },
          async () => {
            for (;;) {
              const job = queue.shift();
              if (!job) return;
              const key = jobKey(job.brand.id, job.area);

              if (abortRef.current) return;

              if (quotaExhausted) {
                setJob(key, { phase: "failed", reason: quotaMessage });
                continue;
              }

              const wait = Math.max(0, nextStartAt - Date.now());
              nextStartAt = Date.now() + wait + MIN_START_GAP_MS;
              if (wait > 0) await new Promise((r) => setTimeout(r, wait));
              if (abortRef.current) return;
              setJob(key, { phase: "running" });
              try {
                if (job.area === "voc") {
                  const voc = await runVoc(projectId, job.brand.id);
                  setJob(key, {
                    phase: "done",
                    score: Math.round((voc.trustScore ?? 0) * 20),
                  });
                } else if (job.area === "design") {
                  const design = await runDesignReview(projectId, job.brand.id);
                  setJob(key, { phase: "done", score: design.score });
                } else {
                  const analysis = await runAgent(projectId, job.brand, job.area);
                  if (!analysis.blocked) successCount += 1;
                  setJob(
                    key,
                    analysis.blocked
                      ? { phase: "blocked" }
                      : { phase: "done", score: analysis.score }
                  );
                }
              } catch (e) {
                const reason = friendlyAgentError(
                  e instanceof Error ? e : new Error("analysis failed")
                );
                if (isBrowserbaseQuotaError(reason)) {
                  quotaExhausted = true;
                  setQuotaError(reason);
                }
                setJob(key, { phase: "failed", reason });
              }
            }
          }
        );
        await Promise.all(workers);
      };

      const buildBrandJobs = (brand: Brand) => [
        ...publicAreas.map((area) => ({ brand, area })),
        ...gatedAreas.map((area) => ({ brand, area })),
        ...EXTRA_AREAS.map((area) => ({ brand, area })),
      ];

      // Per-brand pipeline: VoC and Design start as soon as *this* brand's
      // journeys finish — not after every competitor clears the queue.
      await runQueue(brands.flatMap(buildBrandJobs));
      if (cancelled || finishedRef.current || !getProject(projectId)) return;
      finishedRef.current = true;

      const totalRunJobs =
        brands.length *
        (publicAreas.length + gatedAreas.length + EXTRA_AREAS.length);
      setRunFinished({
        scored: successCount,
        failed: totalRunJobs - successCount,
      });

      setTimeout(() => finishRun(projectId, successCount, router), 1500);
    })();

    return () => {
      cancelled = true;
    };
  }, [project, router]);

  if (project === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Project not found.
      </div>
    );
  }

  const journeyAreas = project
    ? [
        LANDING,
        ...project.journeys.filter((j) => agentCanReach(j)),
        ...project.journeys.filter(
          (j) => !agentCanReach(j) && agentCanReachLoggedIn(j)
        ),
      ]
    : [];

  function brandJourneysSettled(brandId: string) {
    return journeyAreas.every((area) => {
      const state = states[jobKey(brandId, area)];
      return state && state.phase !== "pending" && state.phase !== "running";
    });
  }

  const areas = project ? [...journeyAreas, ...EXTRA_AREAS] : [];
  const gatedAreas = project
    ? project.journeys.filter((j) => !agentCanReachLoggedIn(j))
    : [];
  const totalJobs = project ? project.brands.length * areas.length : 0;
  const settled = Object.values(states).filter(
    (s) => s.phase !== "pending" && s.phase !== "running"
  ).length;
  const progress = totalJobs === 0 ? 0 : Math.round((settled / totalJobs) * 100);
  const allSettled = totalJobs > 0 && settled >= totalJobs;
  const scoredCount = countScored(states, project);
  const hasResults = scoredCount > 0 || (runFinished?.scored ?? 0) > 0;
  const isRunning = Object.values(states).some(
    (s) => s.phase === "running" || s.phase === "pending"
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex w-full items-center justify-between border-b px-6 py-4">
        <ScuupLogo href={`/projects/${params.id}/overview`} />
        <Button variant="ghost" size="sm" onClick={() => leave("overview")}>
          <ArrowLeft data-icon="inline-start" />
          Overview
        </Button>
      </header>

      <div className="flex flex-1 flex-col items-center px-6 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>
            {allSettled
              ? hasResults
                ? "Audit complete"
                : "Analysis couldn't finish"
              : "Walking every journey"}
          </CardTitle>
          <CardDescription>
            {project
              ? allSettled && !hasResults
                ? `${project.name} — every journey visit failed. You'll be sent back to overview shortly.`
                : `${project.name} — real browsers walk each brand's journeys, then scrape public reviews and measure the live code for Voice of Customer and Design as soon as that brand finishes.`
              : "Loading project…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {quotaError ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Browser sessions unavailable</AlertTitle>
              <AlertDescription className="flex flex-col gap-3">
                <span>{quotaError}</span>
                <span className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => leave("overview_failed")}
                  >
                    Go to overview
                  </Button>
                  {hasResults ? (
                    <Button size="sm" onClick={() => leave("overview")}>
                      View partial results
                      <ArrowRight data-icon="inline-end" />
                    </Button>
                  ) : null}
                </span>
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-2">
            <Progress value={progress} />
            <span className="text-sm text-muted-foreground tabular-nums">
              {settled} of {totalJobs} checks complete — {progress}%
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {project?.brands.map((brand) => (
              <div
                key={brand.id}
                className="flex flex-col gap-2.5 rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <BrandMark brand={brand} className="size-6" />
                  <span className="text-sm font-medium">
                    {brand.name}
                    {brand.role === "own_brand" ? (
                      <span className="ms-1.5 text-xs text-brand">(you)</span>
                    ) : null}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {areas.map((area) => (
                    <AreaChip
                      key={area}
                      area={area}
                      state={states[jobKey(brand.id, area)] ?? { phase: "pending" }}
                      waiting={
                        EXTRA_AREAS.includes(area) &&
                        !brandJourneysSettled(brand.id) &&
                        (states[jobKey(brand.id, area)]?.phase ?? "pending") ===
                          "pending"
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {gatedAreas.length > 0 ? (
            <p className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              <KeyRound className="mt-0.5 size-3.5 shrink-0 text-brand" />
              <span>
                {gatedAreas
                  .map((a) => ANALYSIS_AREA_LABELS[a] ?? a)
                  .join(", ")}{" "}
                need a logged-in account. On Sign Up the agent registers a
                test account, then automatically walks deposit, withdraw and
                account journeys in the same session when login succeeds.
              </span>
            </p>
          ) : null}

          {allSettled || runFinished ? (
            <div className="flex flex-col items-center gap-2 pt-2">
              <p className="text-center text-sm text-muted-foreground">
                {hasResults
                  ? "Redirecting to your results…"
                  : "Redirecting to overview…"}
              </p>
              <Button
                className="w-full sm:w-auto"
                onClick={() =>
                  leave(hasResults ? "overview" : "overview_failed")
                }
              >
                {hasResults ? "View results" : "Go to overview"}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 border-t pt-4 sm:flex-row sm:justify-center">
              {isRunning ? (
                <p className="text-center text-sm text-muted-foreground sm:flex-1 sm:text-left">
                  Analysis still running — you can leave and come back later.
                </p>
              ) : null}
              <div className="flex w-full flex-wrap justify-center gap-2 sm:w-auto">
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  onClick={() => leave("overview")}
                >
                  Back to overview
                </Button>
                {hasResults ? (
                  <Button
                    className="flex-1 sm:flex-none"
                    onClick={() => leave("overview")}
                  >
                    View results so far
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
