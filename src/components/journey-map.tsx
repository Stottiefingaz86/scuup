"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, KeyRound } from "lucide-react";
import { AnimatedTabs } from "@/components/animated-tabs";
import { BrandTabLabel } from "@/components/brand-mark";
import { BrandTestAccountPanel } from "@/components/brand-test-account-panel";
import { ScoreChip } from "@/components/score-chip";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { Verdict } from "@/components/verdict";
import { cn } from "@/lib/utils";
import { LOGIN_AGENT_JOURNEYS } from "@/lib/constants";
import {
  buildJourneyMap,
  groupStagesByPhase,
  mapProgress,
  type JourneyMapStage,
} from "@/lib/journey-map";
import { projectAreas } from "@/lib/coverage";
import { type Brand, type Project } from "@/lib/types";

function brandMapScore(brand: Brand, areas: string[]): number | null {
  const scored = buildJourneyMap(brand, areas).filter((s) => s.score !== null);
  if (scored.length === 0) return null;
  return Math.round(
    scored.reduce((sum, s) => sum + (s.score ?? 0), 0) / scored.length
  );
}

/** Top walk path — same layout as before, tighter styling. */
function WalkPathBar({
  stages,
  activeArea,
  onSelect,
}: {
  stages: JourneyMapStage[];
  activeArea: string | null;
  onSelect: (area: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-center gap-1.5 py-0.5">
        {stages.map((stage, i) => (
          <div key={stage.area} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSelect(stage.area)}
              className={cn(
                "flex min-w-[5.5rem] cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 text-center transition-colors",
                activeArea === stage.area
                  ? "border-primary/45 bg-primary/5"
                  : "border-border/80 bg-background hover:border-border",
                stage.status === "blocked" && activeArea !== stage.area &&
                  "border-score-weak/25",
                stage.status === "pending" && "opacity-60"
              )}
            >
              <span className="line-clamp-2 text-[11px] font-medium leading-tight">
                {stage.label}
              </span>
              {stage.score !== null ? (
                <ScoreChip score={stage.score} />
              ) : stage.status === "blocked" ? (
                <span className="text-[11px] font-medium text-score-weak">
                  Blocked
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">—</span>
              )}
            </button>
            {i < stages.length - 1 ? (
              <ChevronRight
                className="size-3.5 shrink-0 text-muted-foreground/35"
                aria-hidden
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function TrailSteps({
  steps,
  frictionSteps,
}: {
  steps: string[];
  frictionSteps: string[];
}) {
  if (steps.length === 0) return null;
  const frictionSet = new Set(frictionSteps);
  return (
    <ol className="flex flex-col gap-1.5">
      {steps.map((step, i) => (
        <li
          key={`${i}-${step}`}
          className={cn(
            "flex items-start gap-2 text-xs leading-relaxed",
            frictionSet.has(step)
              ? "text-score-weak"
              : "text-muted-foreground"
          )}
        >
          <span className="w-4 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/45">
            {i + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function StageCard({
  stage,
  brandName,
  project,
  brand,
  expanded,
  onToggle,
  highlighted,
}: {
  stage: JourneyMapStage;
  brandName: string;
  project: Project;
  brand: Brand;
  expanded: boolean;
  onToggle: () => void;
  highlighted: boolean;
}) {
  const hasTrail = stage.trailSteps.length > 0;
  const hasDetail =
    hasTrail || stage.observations.length > 0 || stage.screenshot;
  const needsTestAccount =
    (LOGIN_AGENT_JOURNEYS as readonly string[]).includes(stage.area) &&
    stage.status !== "walked";

  return (
    <div
      id={`journey-stage-${stage.area}`}
      className={cn(
        "min-w-0 flex-1 rounded-xl border bg-background transition-shadow",
        highlighted && "border-primary/40 shadow-[inset_3px_0_0_0_var(--primary)]",
        stage.status === "blocked" && !highlighted && "border-score-weak/25",
        stage.status === "pending" && "border-dashed opacity-90"
      )}
    >
      <div className="flex gap-4 p-4 sm:p-5">
        <button
          type="button"
          onClick={hasDetail ? onToggle : undefined}
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-3 text-left",
            hasDetail && "cursor-pointer"
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium">{stage.label}</h3>
                {stage.status === "walked" ? (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Walked
                  </span>
                ) : stage.status === "blocked" ? (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-score-weak">
                    Blocked
                  </span>
                ) : (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Not walked
                  </span>
                )}
                {stage.loggedIn ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <KeyRound className="size-2.5" />
                    Logged in
                  </span>
                ) : null}
              </div>

              {stage.summary ? (
                <Verdict text={stage.summary} />
              ) : stage.status === "pending" ? (
                <p className="text-xs text-muted-foreground">
                  The agent has not walked this journey yet.
                </p>
              ) : stage.blockReason ? (
                <p className="text-xs leading-relaxed text-score-weak">
                  {stage.blockReason}
                </p>
              ) : null}

              {stage.frictionSteps.length > 0 && !expanded ? (
                <p className="text-xs text-score-weak">
                  {stage.frictionSteps[0]}
                </p>
              ) : null}

              {hasDetail ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ChevronDown
                    className={cn(
                      "size-3 transition-transform",
                      expanded && "rotate-180"
                    )}
                  />
                  {expanded ? "Hide agent path" : "Show agent path"}
                </span>
              ) : null}
            </div>

            <div className="flex shrink-0 items-start gap-2">
              {stage.score !== null ? (
                <ScoreChip score={stage.score} className="text-sm" />
              ) : null}
              {stage.screenshot ? (
                <ScreenshotLightbox
                  src={stage.screenshot}
                  alt={`${brandName}: ${stage.label}`}
                  caption={`${brandName}: ${stage.label}`}
                  className="aspect-[8/5] h-16 shrink-0 rounded-md border border-border/60"
                />
              ) : null}
            </div>
          </div>
        </button>
      </div>

      {needsTestAccount ? (
        <div className="border-t px-4 py-4 sm:px-5">
          <BrandTestAccountPanel
            compact
            project={project}
            brand={brand}
            rerunArea={stage.area}
          />
        </div>
      ) : null}

      {expanded && hasDetail ? (
        <div className="flex flex-col gap-4 border-t px-4 py-4 sm:px-5">
          {hasTrail ? (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">
                Agent path · {stage.trailSteps.length} step
                {stage.trailSteps.length === 1 ? "" : "s"}
              </span>
              <TrailSteps
                steps={stage.trailSteps}
                frictionSteps={stage.frictionSteps}
              />
            </div>
          ) : null}
          {stage.observations.length > 0 ? (
            <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
              {stage.observations.map((obs, i) => (
                <li key={i}>{obs}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function JourneyMapView({ project }: { project: Project }) {
  const ownBrand = project.brands.find((b) => b.role === "own_brand")!;
  const areas = projectAreas(project);
  const [tabBrand, setTabBrand] = useState(ownBrand.id);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeArea, setActiveArea] = useState<string | null>(null);

  const brand = project.brands.find((b) => b.id === tabBrand) ?? ownBrand;
  const stages = buildJourneyMap(brand, areas);
  const phaseGroups = groupStagesByPhase(stages);
  const progress = mapProgress(stages);

  const focusStage = (area: string) => {
    setActiveArea(area);
    setExpanded(area);
    document
      .getElementById(`journey-stage-${area}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-lg font-medium">Player journey</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            How {brand.name} was walked — first impression through sign up,
            first time deposit, then play. From live agent sessions.
          </p>
        </div>
        <AnimatedTabs
          tabs={project.brands.map((b) => ({
            value: b.id,
            label: (
              <BrandTabLabel brand={b} score={brandMapScore(b, areas)} />
            ),
          }))}
          value={tabBrand}
          onValueChange={setTabBrand}
        />
        <p className="text-sm text-muted-foreground">
          {progress.walked} of {progress.total} journeys walked
          {progress.stoppedAt ? (
            <>
              {" · "}
              Stops at{" "}
              <button
                type="button"
                onClick={() => focusStage(progress.stoppedAt!.area)}
                className="cursor-pointer font-medium text-foreground hover:underline"
              >
                {progress.stoppedAt.label}
              </button>
              {progress.stoppedAt.status === "blocked"
                ? " (blocked)"
                : " (not walked yet)"}
            </>
          ) : (
            " · Full path captured"
          )}
        </p>
      </header>

      <WalkPathBar
        stages={stages}
        activeArea={activeArea}
        onSelect={focusStage}
      />

      <div className="flex flex-col gap-10">
        {phaseGroups.map((group) => (
          <div key={group.phase.key} className="flex flex-col gap-4">
            <div>
              <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {group.phase.label}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground/80">
                {group.phase.description}
              </p>
            </div>

            <div className="flex flex-col gap-5">
              {group.stages.map((stage) => {
                const stepNum =
                  stages.findIndex((s) => s.area === stage.area) + 1;
                const isLast = stepNum === stages.length;
                return (
                  <div key={stage.area} className="relative flex gap-4">
                    <div className="flex flex-col items-center pt-5">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full border font-heading text-xs font-semibold",
                          stage.status === "walked"
                            ? "border-primary/35 bg-primary/10 text-primary"
                            : stage.status === "blocked"
                              ? "border-score-weak/35 bg-score-weak/10 text-score-weak"
                              : "border-border text-muted-foreground"
                        )}
                      >
                        {stepNum}
                      </span>
                      {!isLast ? (
                        <span
                          className="mt-2 w-px flex-1 min-h-[1.5rem] bg-border/80"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <StageCard
                      stage={stage}
                      brandName={brand.name}
                      project={project}
                      brand={brand}
                      expanded={expanded === stage.area}
                      highlighted={activeArea === stage.area}
                      onToggle={() =>
                        setExpanded((v) =>
                          v === stage.area ? null : stage.area
                        )
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
