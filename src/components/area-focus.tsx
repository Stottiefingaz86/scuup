"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AnimatedTabs } from "@/components/animated-tabs";
import { BrandMark, BrandTabLabel } from "@/components/brand-mark";
import { EvidenceObservations } from "@/components/evidence-observations";
import { GapCompare } from "@/components/gap-compare";
import { LiveCaptureDialog } from "@/components/live-capture-dialog";
import { Verdict } from "@/components/verdict";
import { RunAgentButton } from "@/components/run-agent-button";
import { ScoreBar } from "@/components/score-bar";
import { ScoreChip } from "@/components/score-chip";
import { ScoreGauge } from "@/components/score-gauge";
import { agentCanReach, ANALYSIS_AREA_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { areaScore, type Brand, type Project } from "@/lib/types";

/**
 * Focused view of one or more analysis areas (e.g. Retention = loyalty
 * rewards, Cashier = deposit + withdraw). Renders a ranking per area and a
 * per-brand deep dive — 100% real analyses, with launch CTAs for gaps.
 */
export function AreaFocus({
  project,
  areas,
  emptyHint,
  rankings = true,
}: {
  project: Project;
  areas: string[];
  emptyHint: string;
  /** Hide the per-area ranking cards when the page renders its own. */
  rankings?: boolean;
}) {
  const ownBrand = project.brands.find((b) => b.role === "own_brand")!;
  const [captureBrand, setCaptureBrand] = useState<Brand | null>(null);
  const [tabBrand, setTabBrand] = useState<string>(ownBrand.id);
  const [selectedArea, setSelectedArea] = useState<string>(areas[0]);

  const detailBrand =
    project.brands.find((b) => b.id === tabBrand) ?? ownBrand;
  const detail = detailBrand.analyses[selectedArea];

  // Comparison target: viewing a competitor compares against you; viewing
  // your own brand compares against the strongest analysed competitor.
  const rivalBrand =
    detailBrand.role === "own_brand"
      ? project.brands
          .filter(
            (b) =>
              b.role !== "own_brand" &&
              b.analyses[selectedArea] &&
              !b.analyses[selectedArea].blocked
          )
          .sort(
            (a, b) =>
              b.analyses[selectedArea].score - a.analyses[selectedArea].score
          )[0] ?? null
      : ownBrand.analyses[selectedArea] &&
          !ownBrand.analyses[selectedArea].blocked
        ? ownBrand
        : null;
  const rivalDetail = rivalBrand?.analyses[selectedArea];

  return (
    <div className="flex flex-col gap-6">
      {/* Per-area rankings */}
      <div
        className={cn(
          areas.length > 1 ? "grid gap-6 lg:grid-cols-2" : "grid gap-6",
          !rankings && "hidden"
        )}
      >
        {areas.map((area) => {
          const ranked = project.brands
            .map((b) => ({ brand: b, score: areaScore(b, area) }))
            .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
          const anyScore = ranked.some((r) => r.score !== null);
          return (
            <Card key={area} className="group/score">
              <CardHeader>
                <CardTitle>{ANALYSIS_AREA_LABELS[area] ?? area}</CardTitle>
                <CardDescription>
                  {anyScore
                    ? "Ranked from real analysed visits."
                    : emptyHint}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {ranked.map(({ brand, score }, i) =>
                  score !== null ? (
                    <ScoreBar
                      key={brand.id}
                      rank={i + 1}
                      highlight={brand.role === "own_brand"}
                      muted={brand.role !== "own_brand"}
                      label={
                        brand.role === "own_brand"
                          ? `${brand.name} (you)`
                          : brand.name
                      }
                      score={score}
                    />
                  ) : (
                    <div
                      key={brand.id}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <BrandMark brand={brand} className="size-4" />
                      {brand.name}
                      <span className="ms-auto inline-flex items-center gap-1.5">
                        <ScoreChip score={null} />
                        {agentCanReach(area) ? (
                          <RunAgentButton
                            projectId={project.id}
                            brand={brand}
                            area={area}
                            label="Agent"
                            variant="outline"
                            className="h-6 px-2 text-xs"
                          />
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 gap-1 px-2 text-xs"
                            onClick={() => setCaptureBrand(brand)}
                          >
                            <ExternalLink className="size-3" />
                            Launch
                          </Button>
                        )}
                      </span>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Deep dive */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <CardTitle className="font-heading text-xl">Deep dive</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              {areas.length > 1 ? (
                <AnimatedTabs
                  tabs={areas.map((a) => ({
                    value: a,
                    label: ANALYSIS_AREA_LABELS[a] ?? a,
                  }))}
                  value={selectedArea}
                  onValueChange={setSelectedArea}
                />
              ) : null}
              <AnimatedTabs
                tabs={project.brands.map((b) => ({
                  value: b.id,
                  label: (
                    <BrandTabLabel
                      brand={b}
                      score={areaScore(b, selectedArea)}
                    />
                  ),
                }))}
                value={tabBrand}
                onValueChange={setTabBrand}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {detail && !detail.blocked ? (
            <div
              key={`${selectedArea}-${tabBrand}`}
              className="flex flex-col gap-6 duration-300 animate-in fade-in-0 slide-in-from-bottom-2"
            >
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <ScoreGauge
                  score={detail.score}
                  size={140}
                  caption={ANALYSIS_AREA_LABELS[selectedArea]}
                  muted={detailBrand.role !== "own_brand"}
                  className="shrink-0"
                />
                <Verdict text={detail.summary} />
              </div>
              {rivalBrand && rivalDetail ? (
                <GapCompare
                  viewed={detail}
                  viewedName={detailBrand.name}
                  rival={rivalDetail}
                  rivalName={rivalBrand.name}
                  rivalIsYou={rivalBrand.role === "own_brand"}
                />
              ) : null}
              <div className="grid gap-8 lg:grid-cols-2">
                <div className="group/score flex flex-col gap-4">
                  <h3 className="text-sm font-medium">Heuristic breakdown</h3>
                  {detail.heuristics.map((h) => (
                    <div key={h.name} className="flex flex-col gap-1">
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
                <EvidenceObservations
                  analysis={detail}
                  brandName={detailBrand.name}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3 py-6">
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                {detail?.blocked
                  ? (detail.blockReason ??
                    "The agent was blocked before it could observe this area.")
                  : `No analysis captured for ${detailBrand.name} here yet. ${emptyHint}`}
              </p>
              <div className="flex items-center gap-2">
                {agentCanReach(selectedArea) ? (
                  <RunAgentButton
                    projectId={project.id}
                    brand={detailBrand}
                    area={selectedArea}
                    label={
                      detail?.blocked ? "Retry with agent" : "Run the agent"
                    }
                  />
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCaptureBrand(detailBrand)}
                >
                  <ExternalLink data-icon="inline-start" />
                  Launch {detailBrand.name}
                </Button>
              </div>
            </div>
          )}
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
