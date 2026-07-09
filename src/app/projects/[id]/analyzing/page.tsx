"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  CircleAlert,
  KeyRound,
  Loader2,
  ShieldAlert,
  Telescope,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";
import {
  agentCanReach,
  ANALYSIS_AREA_LABELS,
  LANDING,
} from "@/lib/constants";
import { getProject, markProjectComplete, useProject } from "@/lib/project-store";
import { runAgent } from "@/lib/run-agent";
import type { Brand } from "@/lib/types";

type JobState =
  | { phase: "pending" }
  | { phase: "running" }
  | { phase: "done"; score: number }
  | { phase: "blocked" }
  | { phase: "failed"; reason: string };

/** Browserbase free plan allows 3 concurrent sessions. */
const MAX_CONCURRENT = 3;

const jobKey = (brandId: string, area: string) => `${brandId}:${area}`;

function AreaChip({ area, state }: { area: string; state: JobState }) {
  const label = ANALYSIS_AREA_LABELS[area] ?? area;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
        state.phase === "pending" && "border-border text-muted-foreground/60",
        state.phase === "running" && "border-primary/50 bg-primary/10 text-foreground",
        state.phase === "done" && "border-brand/40 bg-brand/[0.06] text-foreground",
        (state.phase === "blocked" || state.phase === "failed") &&
          "border-score-mid/40 bg-score-mid/[0.06] text-muted-foreground"
      )}
      title={state.phase === "failed" ? state.reason : undefined}
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
  const startedRef = useRef(false);

  useEffect(() => {
    if (!project || startedRef.current) return;
    if (project.status === "complete") {
      router.replace(`/projects/${project.id}/overview`);
      return;
    }
    startedRef.current = true;

    // Snapshot now — the store object identity changes on each save.
    const brands = [...project.brands];
    const projectId = project.id;
    // Everything the agent can walk on its own runs up front: the landing
    // first impression plus every selected public journey. Login-gated
    // journeys wait for a saved account (Accounts page).
    const areas = [LANDING, ...project.journeys.filter((j) => agentCanReach(j))];

    const setJob = (key: string, state: JobState) =>
      setStates((prev) => ({ ...prev, [key]: state }));

    let successCount = 0;

    (async () => {
      // Brand-major order: each brand's landing scores first, so the page
      // shows early results while deeper journeys are still walking.
      const queue: { brand: Brand; area: string }[] = brands.flatMap((brand) =>
        areas.map((area) => ({ brand, area }))
      );
      const workers = Array.from(
        { length: Math.min(MAX_CONCURRENT, queue.length) },
        async () => {
          for (;;) {
            const job = queue.shift();
            if (!job) return;
            const key = jobKey(job.brand.id, job.area);
            setJob(key, { phase: "running" });
            try {
              const analysis = await runAgent(projectId, job.brand, job.area);
              if (!analysis.blocked) successCount += 1;
              setJob(
                key,
                analysis.blocked
                  ? { phase: "blocked" }
                  : { phase: "done", score: analysis.score }
              );
            } catch (e) {
              setJob(key, {
                phase: "failed",
                reason: e instanceof Error ? e.message : "analysis failed",
              });
            }
          }
        }
      );
      await Promise.all(workers);
      // Only mark complete when at least one journey scored — a total
      // infrastructure failure (e.g. prod misconfig) must not skip the audit.
      if (getProject(projectId) && successCount > 0) {
        markProjectComplete(projectId);
        setTimeout(() => router.push(`/projects/${projectId}/overview`), 1200);
      }
    })();
  }, [project, router]);

  if (project === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Project not found.
      </div>
    );
  }

  const areas = project
    ? [LANDING, ...project.journeys.filter((j) => agentCanReach(j))]
    : [];
  const gatedAreas = project
    ? project.journeys.filter((j) => !agentCanReach(j))
    : [];
  const totalJobs = project ? project.brands.length * areas.length : 0;
  const settled = Object.values(states).filter(
    (s) => s.phase !== "pending" && s.phase !== "running"
  ).length;
  const progress = totalJobs === 0 ? 0 : Math.round((settled / totalJobs) * 100);

  return (
    <div className="flex min-h-screen flex-col items-center px-6 py-16">
      <div className="flex items-center gap-2">
        <Telescope className="size-6 text-primary" />
        <span className="text-lg font-semibold tracking-tight">
          PlayerScope AI
        </span>
      </div>

      <Card className="mt-10 w-full max-w-2xl">
        <CardHeader>
          <CardTitle>
            {progress >= 100 ? "Audit complete" : "Walking every journey"}
          </CardTitle>
          <CardDescription>
            {project
              ? `${project.name} — real browsers are visiting each brand and walking every selected journey. A vision model scores what they see.`
              : "Loading project…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Progress value={progress} />
            <span className="text-sm text-muted-foreground tabular-nums">
              {settled} of {totalJobs} journey visits scored — {progress}%
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
                need a logged-in account. Set up test accounts on the Accounts
                page after this pass — agents then walk those journeys
                automatically too.
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
