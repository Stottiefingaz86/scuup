"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Camera,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  Globe,
  KeyRound,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AnimatedTabs } from "@/components/animated-tabs";
import { BrandMark, BrandTabLabel } from "@/components/brand-mark";
import { EvidenceObservations } from "@/components/evidence-observations";
import { GapCompare } from "@/components/gap-compare";
import { LiveCaptureDialog } from "@/components/live-capture-dialog";
import { Verdict } from "@/components/verdict";
import { ProjectShell } from "@/components/project-shell";
import { RunAgentButton } from "@/components/run-agent-button";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { ScoreBar } from "@/components/score-bar";
import { ScoreChip, TierLegend } from "@/components/score-chip";
import { ScoreGauge } from "@/components/score-gauge";
import {
  agentCanReach,
  agentCanReachLoggedIn,
  ANALYSIS_AREA_LABELS,
  journeyRequiresLogin,
} from "@/lib/constants";
import { projectAreas } from "@/lib/coverage";
import { agentKey, runAgentBatch, useRunningAgents } from "@/lib/run-agent";
import {
  areaScore,
  type Brand,
  type JourneyAnalysis,
  type Project,
} from "@/lib/types";

/** Session badge. `actual` reflects what a specific analysed visit really
 * was (e.g. a signup walk that ended authenticated); without it the badge
 * falls back to what the journey type requires. */
function AccessBadge({
  area,
  actual,
  muted,
}: {
  area: string;
  actual?: boolean;
  muted?: boolean;
}) {
  const loggedIn = actual ?? journeyRequiresLogin(area);
  return (
    <span
      title={
        loggedIn
          ? "Scored from a logged-in session with the agent's test account"
          : "Scored from the public site, logged out"
      }
      className={cn(
        "inline-flex cursor-help items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        loggedIn
          ? "border-primary/30 text-primary"
          : "border-border text-muted-foreground",
        muted && "opacity-70"
      )}
    >
      {loggedIn ? <KeyRound className="size-2.5" /> : <Globe className="size-2.5" />}
      {loggedIn ? "Logged in" : "Logged out"}
    </span>
  );
}

/** Every screenshot the score was measured from, plus the plain-language
 * method: real visit → captured screens → checks scored from them → average.
 * This is the trust story — the number is auditable, not a black box. */
function ScoreEvidence({
  detail,
  brandName,
  area,
}: {
  detail: JourneyAnalysis;
  brandName: string;
  area: string;
}) {
  const shots = detail.screenshots ?? [];
  const checks = detail.heuristics.length;
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Camera className="size-4 text-brand" />
          Where this number comes from
        </h3>
        {shots.length > 0 ? (
          <span className="text-[11px] text-muted-foreground/70">
            {shots.length} screen{shots.length === 1 ? "" : "s"} captured —
            click to inspect
          </span>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        The agent visited {brandName} live, walked this journey and captured
        the screens below. Each of the {checks} checks in the score breakdown
        was scored 0–100 from exactly what these screens show; the overall{" "}
        {detail.score} is their average — nothing else feeds the number.
      </p>
      {shots.length > 0 ? (
        <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1">
          {shots.map((src, i) => (
            <ScreenshotLightbox
              key={`${src}-${i}`}
              src={src}
              alt={`${brandName} — ${ANALYSIS_AREA_LABELS[area] ?? area}, captured screen ${i + 1} of ${shots.length}`}
              caption={`${brandName} — ${ANALYSIS_AREA_LABELS[area] ?? area} · screen ${i + 1} of ${shots.length}, captured ${new Date(detail.analysedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}`}
              className="aspect-[8/5] w-32 shrink-0"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The full analysis for one area, rendered inline under its row so the
 * row → detail relationship is physically obvious. */
function AreaDeepDive({
  project,
  area,
  onLaunch,
}: {
  project: Project;
  area: string;
  onLaunch: (brand: Brand) => void;
}) {
  const ownBrand = project.brands.find((b) => b.role === "own_brand")!;
  const competitors = project.brands.filter((b) => b.role === "competitor");
  const [tabBrand, setTabBrand] = useState<string>(ownBrand.id);

  const detailBrand =
    project.brands.find((b) => b.id === tabBrand) ?? ownBrand;
  const detail = detailBrand.analyses[area];

  // Comparison target: viewing a competitor compares against you; viewing
  // your own brand compares against the strongest analysed competitor.
  const rivalBrand =
    detailBrand.role === "own_brand"
      ? (competitors
          .filter((b) => b.analyses[area] && !b.analyses[area].blocked)
          .sort((a, b) => b.analyses[area].score - a.analyses[area].score)[0] ??
        null)
      : ownBrand.analyses[area] && !ownBrand.analyses[area].blocked
        ? ownBrand
        : null;
  const rivalDetail = rivalBrand?.analyses[area];

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <AnimatedTabs
        tabs={project.brands.map((b) => ({
          value: b.id,
          label: <BrandTabLabel brand={b} score={areaScore(b, area)} />,
        }))}
        value={tabBrand}
        onValueChange={setTabBrand}
      />
      {detail && !detail.blocked ? (
        <div
          key={`${area}-${tabBrand}`}
          className="flex min-w-0 flex-col gap-6 duration-300 animate-in fade-in-0"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <ScoreGauge
              score={detail.score}
              size={132}
              caption={ANALYSIS_AREA_LABELS[area]}
              muted={detailBrand.role !== "own_brand"}
              className="shrink-0"
            />
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center gap-2">
                <AccessBadge
                  area={area}
                  actual={detail.loggedIn ?? detail.authenticated}
                />
              </div>
              <Verdict text={detail.summary} />
              <span className="break-all text-xs text-muted-foreground">
                Analysed{" "}
                {new Date(detail.analysedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                · {detail.finalUrl}
              </span>
            </div>
          </div>

          <ScoreEvidence
            detail={detail}
            brandName={detailBrand.name}
            area={area}
          />

          {rivalBrand && rivalDetail ? (
            <GapCompare
              viewed={detail}
              viewedName={detailBrand.name}
              rival={rivalDetail}
              rivalName={rivalBrand.name}
              rivalIsYou={rivalBrand.role === "own_brand"}
            />
          ) : null}

          <Separator />

          <div className="grid min-w-0 gap-8 lg:grid-cols-2">
            <div className="group/score flex min-w-0 flex-col gap-4">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-medium">Score breakdown</h3>
                <span className="text-[11px] text-muted-foreground/70">
                  {detail.heuristics.length} checks, each 0–100 · overall ={" "}
                  their average
                </span>
              </div>
              {detail.heuristics.map((h) => (
                <div key={h.name} className="flex min-w-0 flex-col gap-1">
                  <ScoreBar
                    label={h.name}
                    score={h.score}
                    highlight={detailBrand.role === "own_brand"}
                    muted={detailBrand.role !== "own_brand"}
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {h.note}
                  </p>
                </div>
              ))}
            </div>
            <div className="min-w-0">
              <EvidenceObservations
                analysis={detail}
                brandName={detailBrand.name}
              />
            </div>
          </div>
        </div>
      ) : (
        <div
          key={`${area}-${tabBrand}-empty`}
          className="flex flex-col items-start gap-3 py-4 duration-300 animate-in fade-in-0"
        >
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {detail?.blocked
              ? (detail.blockReason ??
                "The agent was blocked before it could observe this area.")
              : agentCanReach(area)
                ? `No analysis captured for ${detailBrand.name} here yet. The agent runs automatically — this fills in on its own.`
                : agentCanReachLoggedIn(area)
                  ? `No analysis captured for ${detailBrand.name} here yet. This journey needs the brand's test account — the agent logs in (or registers first) and walks it automatically.`
                  : `No analysis captured for ${detailBrand.name} here yet. This journey sits behind a login — launch the site in a recorded session to score it.`}
          </p>
          <div className="flex items-center gap-2">
            {detail?.blocked && agentCanReachLoggedIn(area) ? (
              <RunAgentButton
                projectId={project.id}
                brand={detailBrand}
                area={area}
                label="Retry with agent"
              />
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onLaunch(detailBrand)}
            >
              <ExternalLink data-icon="inline-start" />
              Take control of {detailBrand.name}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function JourneysContent({ project }: { project: Project }) {
  const ownBrand = project.brands.find((b) => b.role === "own_brand")!;
  const competitors = project.brands.filter((b) => b.role === "competitor");
  const areas = projectAreas(project);
  const [expanded, setExpanded] = useState<string | null>(areas[0] ?? null);
  const [captureBrand, setCaptureBrand] = useState<Brand | null>(null);

  const hasGaps = project.brands.some((b) =>
    areas.some((a) => areaScore(b, a) === null)
  );
  const running = useRunningAgents();
  const runningCount = running.length;
  // Signup first (it registers or logs into the test account and unlocks
  // the session), login-gated journeys last so they reuse it.
  const jobOrder = (a: string) =>
    a === "signup" ? 0 : journeyRequiresLogin(a) ? 2 : 1;
  const agentJobs = project.brands.flatMap((brand) =>
    areas
      .filter((a) => agentCanReachLoggedIn(a) && areaScore(brand, a) === null)
      .sort((a, b) => jobOrder(a) - jobOrder(b))
      .map((area) => ({ brand, area }))
  );

  // The agent fills gaps by itself — no buttons to click. Each brand+area
  // is attempted once per visit; what fails lands in the failure panel with
  // a Take control fallback instead of being retried in a loop.
  const autoTried = useRef<Set<string>>(new Set());
  const [failures, setFailures] = useState<
    { brand: string; area: string; error: string }[]
  >([]);
  const autoJobs = agentJobs.filter(
    ({ brand, area }) =>
      !brand.analyses[area]?.blocked &&
      !autoTried.current.has(agentKey(brand.id, area))
  );
  const autoJobsKey = autoJobs
    .map(({ brand, area }) => agentKey(brand.id, area))
    .join(",");
  useEffect(() => {
    if (project.status === "archived" || autoJobs.length === 0) return;
    for (const { brand, area } of autoJobs) {
      autoTried.current.add(agentKey(brand.id, area));
    }
    void runAgentBatch(project.id, autoJobs).then((fails) => {
      if (fails.length > 0) {
        setFailures((prev) => [...prev, ...fails]);
      } else {
        toast.success("Agent runs finished", {
          description: "Every reachable area is now scored.",
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autoJobsKey captures the job set
  }, [autoJobsKey, project.id]);

  const retryFailures = async () => {
    const jobs = failures.flatMap((f) => {
      const brand = project.brands.find((b) => b.name === f.brand);
      return brand ? [{ brand, area: f.area }] : [];
    });
    setFailures([]);
    const fails = await runAgentBatch(project.id, jobs);
    setFailures(fails);
  };

  /** What an unscored cell shows: a spinner while the agent works, the
   * block reason when it was walled (Take control lives in the expanded
   * detail), or a plain N/A while the run is queued. */
  const naAction = (brand: Brand, area: string) => {
    if (running.includes(agentKey(brand.id, area))) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <LoaderCircle className="size-3.5 animate-spin text-primary" />
          Agent…
        </span>
      );
    }
    const analysis = brand.analyses[area];
    if (analysis?.blocked) {
      return (
        <span
          title={
            analysis.blockReason ??
            "The agent was blocked before it could observe this area."
          }
          className="inline-flex cursor-help items-center gap-1 rounded-md bg-score-weak/10 px-1.5 py-0.5 text-[11px] font-medium text-score-weak"
        >
          <CircleAlert className="size-3" />
          Blocked
        </span>
      );
    }
    return <ScoreChip score={null} />;
  };

  // One shared grid template keeps the header and every row aligned; the
  // deep dive lives OUTSIDE the grid so its content can never distort the
  // column layout (the failure mode tables have).
  const gridTemplate = {
    gridTemplateColumns: `minmax(200px, 1.7fr) repeat(${project.brands.length}, minmax(84px, 1fr)) minmax(80px, 0.7fr)`,
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <CardTitle>Journey scores</CardTitle>
              <CardDescription>
                Every score is the average of journey checks scored from
                screens captured on a real visit. Open a row to see the
                screens, the checks and the math.
              </CardDescription>
            </div>
            {runningCount > 0 ? (
              <span className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary">
                <LoaderCircle className="size-3.5 animate-spin" />
                Agent scoring {runningCount} area
                {runningCount === 1 ? "" : "s"}…
              </span>
            ) : null}
          </div>
          <TierLegend className="mt-1" />
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border">
            <div
              className="grid items-center gap-2 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground"
              style={gridTemplate}
            >
              <span>Journey</span>
              <span className="inline-flex items-center justify-center gap-1.5 text-center">
                <BrandMark brand={ownBrand} className="size-4" />
                <span className="truncate">{ownBrand.name} (you)</span>
              </span>
              {competitors.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center justify-center gap-1.5 text-center"
                >
                  <BrandMark brand={c} className="size-4" />
                  <span className="truncate">{c.name}</span>
                </span>
              ))}
              <span className="text-right">Gap to best</span>
            </div>

            {areas.map((area) => {
              const own = areaScore(ownBrand, area);
              const allScores = project.brands
                .map((b) => areaScore(b, area))
                .filter((s): s is number => s !== null);
              const best = allScores.length ? Math.max(...allScores) : null;
              const gap = own !== null && best !== null ? own - best : null;
              const isOpen = expanded === area;
              return (
                <div
                  key={area}
                  className={cn(
                    "border-b last:border-b-0",
                    isOpen && "bg-accent/20"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : area)}
                    className={cn(
                      "grid w-full cursor-pointer items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-accent/40",
                      isOpen && "shadow-[inset_2px_0_0_0_var(--brand)]"
                    )}
                    style={gridTemplate}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <ChevronDown
                        className={cn(
                          "size-3.5 shrink-0 text-muted-foreground/50 transition-transform",
                          isOpen && "rotate-180"
                        )}
                      />
                      <span className="truncate">
                        {ANALYSIS_AREA_LABELS[area] ?? area}
                      </span>
                      <AccessBadge area={area} />
                    </span>
                    <span className="text-center">
                      {own !== null ? (
                        <ScoreChip score={own} />
                      ) : (
                        naAction(ownBrand, area)
                      )}
                    </span>
                    {competitors.map((c) => (
                      <span key={c.id} className="text-center">
                        {areaScore(c, area) === null ? (
                          naAction(c, area)
                        ) : (
                          <ScoreChip score={areaScore(c, area)} muted />
                        )}
                      </span>
                    ))}
                    <span className="text-right tabular-nums">
                      {gap === null ? (
                        <span className="text-xs text-muted-foreground/60">
                          —
                        </span>
                      ) : gap >= 0 ? (
                        <Badge variant="secondary">Leading</Badge>
                      ) : (
                        <span className="font-heading text-sm font-semibold text-tier-1">
                          {gap}
                        </span>
                      )}
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="border-t bg-background/40 px-4 py-5 shadow-[inset_2px_0_0_0_var(--brand)] sm:px-6">
                      <AreaDeepDive
                        project={project}
                        area={area}
                        onLaunch={setCaptureBrand}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {failures.length > 0 && runningCount === 0 ? (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-score-weak/30 bg-score-weak/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <CircleAlert className="size-4 text-score-weak" />
                  The agent couldn&apos;t finish {failures.length} run
                  {failures.length === 1 ? "" : "s"}
                </p>
                <Button size="sm" variant="outline" onClick={retryFailures}>
                  Retry all
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {failures.map((f) => {
                  const brand = project.brands.find((b) => b.name === f.brand);
                  return (
                    <div
                      key={`${f.brand}-${f.area}`}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-lg border bg-background/40 p-3"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-medium">
                          {f.brand} —{" "}
                          {ANALYSIS_AREA_LABELS[f.area] ?? f.area}
                        </span>
                        <span className="text-xs leading-relaxed text-muted-foreground">
                          {f.error}
                        </span>
                      </div>
                      {brand ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => setCaptureBrand(brand)}
                        >
                          <ExternalLink data-icon="inline-start" />
                          Take control
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {hasGaps ? (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              N/A areas fill automatically — the agent logs in with the
              brand&apos;s test account when one exists (registering on Sign
              Up if not) and walks every journey it can. Anything it
              can&apos;t reach shows why, with a Take control button to walk
              it yourself.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <LiveCaptureDialog
        brand={captureBrand}
        projectId={project.id}
        onClose={() => setCaptureBrand(null)}
      />
    </div>
  );
}

export default function JourneysPage() {
  const params = useParams<{ id: string }>();
  return (
    <ProjectShell projectId={params.id}>
      {(project) => <JourneysContent project={project} />}
    </ProjectShell>
  );
}
