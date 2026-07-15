"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  CircleAlert,
  ExternalLink,
  Gift,
  LoaderCircle,
  TrendingDown,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BrandMark } from "@/components/brand-mark";
import { LiveCaptureDialog } from "@/components/live-capture-dialog";
import { ProjectShell } from "@/components/project-shell";
import { EvidenceShotStrip } from "@/components/evidence-shot-strip";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { ScoreChip, TierLegend } from "@/components/score-chip";
import {
  backfillRetentionNotes,
  jobsNeedingRetentionNotes,
} from "@/lib/backfill-retention-notes";
import { buildMechanicInsights } from "@/lib/retention-insights";
import {
  applyRetentionGates,
  mechanicGapReason,
  RETENTION_MECHANIC_META,
} from "@/lib/retention-scoring";
import { agentKey, runAgentBatch, useRunningAgents } from "@/lib/run-agent";
import { cn } from "@/lib/utils";
import type { Brand, JourneyAnalysis, Project } from "@/lib/types";

const LOYALTY = "loyalty_rewards";

/** Mechanics we can honestly evidence: public pages always, login-gated ones
 * when the agent's test account got in. Tracked-play mechanics are out, we
 * can't observe reward cadence over weeks, so we never show that row. */
const DISPLAY_MECHANICS = RETENTION_MECHANIC_META.filter(
  (m) => m.requires !== "tracked_play"
);

function retentionContext(analysis: JourneyAnalysis | null) {
  return analysis?.retentionContext ?? { loggedIn: false, fromSession: false };
}

/** The brand's real loyalty analysis, or null (not run / blocked). */
function loyaltyOf(brand: Brand): JourneyAnalysis | null {
  const a = brand.analyses[LOYALTY];
  return a && !a.blocked ? a : null;
}

/** Mechanic score after evidence gates (login-only mechanics stay N/A when
 * the visit was logged out). */
function mechanicScore(
  analysis: JourneyAnalysis | null,
  key: string
): number | null {
  if (!analysis?.retention) return null;
  const gated = applyRetentionGates(
    analysis.retention,
    retentionContext(analysis)
  );
  const v = gated?.[key];
  return v === undefined ? null : v;
}

/** One brand's loyalty offer, read from its promo pages, tier tables and
 * help centre, the plain answer to "what do players actually get?". */
function BrandOfferCard({
  brand,
  rank,
  running,
  onLaunch,
}: {
  brand: Brand;
  rank: number | null;
  running: boolean;
  onLaunch: (brand: Brand) => void;
}) {
  const own = brand.role === "own_brand";
  const analysis = loyaltyOf(brand);
  const blocked = brand.analyses[LOYALTY]?.blocked ?? false;
  const snap = analysis?.loyaltySnapshot;
  const shots = analysis?.screenshots ?? [];

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border p-5",
        own && "border-brand/30 bg-brand/[0.04]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <BrandMark brand={brand} className="size-5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">
              {brand.name}
              {own ? " (you)" : ""}
            </span>
            {analysis?.retentionType ? (
              <span className="text-xs text-muted-foreground">
                {analysis.retentionType}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {rank !== null && analysis ? (
            <Badge variant={rank === 0 ? "default" : "secondary"}>
              #{rank + 1}
            </Badge>
          ) : null}
          {analysis ? <ScoreChip score={analysis.score} muted={!own} /> : null}
        </div>
      </div>

      {analysis ? (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              First deposit gets
            </span>
            <p className="text-sm leading-relaxed">
              {snap?.ftdOffer ?? (
                <span className="text-muted-foreground">
                  No welcome offer visible on this visit.
                </span>
              )}
            </p>
          </div>

          {snap && snap.tiers.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Loyalty levels
              </span>
              {/* One shared grid so every level name sits in the same
               * column and wrapped perk text stays in its own lane. */}
              <div className="grid grid-cols-[auto_1fr] overflow-hidden rounded-lg border text-sm">
                {snap.tiers.map((t, i) => (
                  <Fragment key={`${t.name}-${i}`}>
                    <span
                      className={cn(
                        "whitespace-nowrap bg-muted/40 px-3 py-2 font-medium",
                        i > 0 && "border-t"
                      )}
                    >
                      {t.name}
                    </span>
                    <span
                      className={cn(
                        "px-3 py-2 leading-relaxed text-muted-foreground",
                        i > 0 && "border-t"
                      )}
                    >
                      {t.perks}
                    </span>
                  </Fragment>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Reward rhythm
            </span>
            <p className="text-sm leading-relaxed">
              {snap?.cadence ?? (
                <span className="text-muted-foreground">
                  No recurring rewards documented.
                </span>
              )}
            </p>
          </div>

          {analysis.summary ? (
            <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
              {analysis.summary}
            </p>
          ) : null}

          {shots.length > 0 ? (
            <EvidenceShotStrip
              analysis={analysis}
              label={`${brand.name}, loyalty & rewards`}
            />
          ) : null}
        </>
      ) : (
        <div className="flex flex-col items-start gap-3 py-2">
          {running ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin text-primary" />
              Agent is reading {brand.name}&apos;s promotions, VIP pages and
              help centre…
            </p>
          ) : blocked ? (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {brand.analyses[LOYALTY]?.blockReason ??
                  "The agent was blocked before it could read the loyalty pages."}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onLaunch(brand)}
              >
                <ExternalLink data-icon="inline-start" />
                Take control of {brand.name}
              </Button>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Not read yet, the agent runs automatically and fills this in on
              its own.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** The top actionable gaps vs the best competitor, flat, no accordion. */
function ImproveFirst({
  ownBrand,
  competitors,
}: {
  ownBrand: Brand;
  competitors: Brand[];
}) {
  const insights = buildMechanicInsights(ownBrand, competitors, loyaltyOf);
  const gaps = insights
    .filter(
      (i) =>
        i.canAdvise &&
        i.gap !== null &&
        i.gap < 0 &&
        i.requires !== "tracked_play"
    )
    .slice(0, 3);
  if (gaps.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fix first</CardTitle>
        <CardDescription>
          Where {ownBrand.name} trails the best competitor on rewards, each
          one cites what the agent saw and what to change.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {gaps.map((g) => (
          <div
            key={g.key}
            className="flex flex-col gap-3 rounded-xl border border-score-weak/30 bg-score-weak/[0.03] p-4 sm:flex-row sm:items-start"
          >
            {g.screenshotUrl ? (
              <ScreenshotLightbox
                src={g.screenshotUrl}
                alt={`Evidence: ${g.label}`}
                caption={`${ownBrand.name}: ${g.label}`}
                className="aspect-[8/5] w-full shrink-0 sm:w-36"
              />
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{g.label}</span>
                <ScoreChip score={g.ownScore} />
                {g.bestCompetitor ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <TrendingDown className="size-3 text-score-weak" />
                    {g.gap} vs {g.bestCompetitor.name} (
                    {g.bestCompetitor.score})
                  </span>
                ) : null}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {g.note}
              </p>
              <p className="text-sm leading-relaxed">
                <span className="font-medium text-brand">Do this: </span>
                {g.improve}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RetentionContent({ project }: { project: Project }) {
  const ownBrand = project.brands.find((b) => b.role === "own_brand")!;
  const competitors = project.brands.filter((b) => b.role !== "own_brand");
  const ranked = [...project.brands].sort(
    (a, b) => (loyaltyOf(b)?.score ?? -1) - (loyaltyOf(a)?.score ?? -1)
  );
  const [captureBrand, setCaptureBrand] = useState<Brand | null>(null);
  const running = useRunningAgents();

  // The agent fills missing loyalty reads by itself, one attempt per brand
  // per visit; a blocked run gets a Take control fallback, not a retry loop.
  const autoTried = useRef<Set<string>>(new Set());
  const autoJobs = project.brands.filter(
    (b) =>
      !b.analyses[LOYALTY] && !autoTried.current.has(agentKey(b.id, LOYALTY))
  );
  const autoJobsKey = autoJobs.map((b) => b.id).join(",");
  useEffect(() => {
    if (project.status === "archived" || autoJobs.length === 0) return;
    for (const b of autoJobs) autoTried.current.add(agentKey(b.id, LOYALTY));
    void runAgentBatch(
      project.id,
      autoJobs.map((brand) => ({ brand, area: LOYALTY }))
    ).then((fails) => {
      for (const f of fails) {
        toast.error(`${f.brand}, loyalty read failed`, {
          description: f.error,
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autoJobsKey captures the job set
  }, [autoJobsKey, project.id]);

  // Older analyses may be missing per-mechanic evidence notes, backfilled
  // silently in the background.
  const pendingNotes = jobsNeedingRetentionNotes(project);
  const notesBackfillKey = useRef<string | null>(null);
  useEffect(() => {
    if (project.status === "archived" || pendingNotes.length === 0) return;
    const key = `${project.id}:${pendingNotes.map((j) => j.brandId).join(",")}`;
    if (notesBackfillKey.current === key) return;
    notesBackfillKey.current = key;
    void backfillRetentionNotes(project.id, project, () => {});
  }, [project, pendingNotes]);

  // Only show mechanic rows at least one brand has real evidence for.
  const scoredMechanics = DISPLAY_MECHANICS.filter((m) =>
    project.brands.some((b) => mechanicScore(loyaltyOf(b), m.key) !== null)
  );

  return (
    <div className="flex flex-col gap-6">
      {/* What players actually get, the page lead */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gift className="size-4 text-brand" />
            <CardTitle>What players actually get</CardTitle>
          </div>
          <CardDescription>
            Read straight from each brand&apos;s promotions, VIP pages and help
            centre, the first-deposit offer, what each loyalty level unlocks,
            and how often rewards come back. Click a screenshot to see the
            evidence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {ranked.map((brand) => (
              <BrandOfferCard
                key={brand.id}
                brand={brand}
                rank={loyaltyOf(brand) ? ranked.indexOf(brand) : null}
                running={running.includes(agentKey(brand.id, LOYALTY))}
                onLaunch={setCaptureBrand}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Compact mechanic comparison, evidence-backed rows only */}
      {scoredMechanics.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>How the rewards compare</CardTitle>
            <CardDescription>
              Scored from what the agent could actually see on each
              brand&apos;s loyalty pages. N/A means the evidence isn&apos;t
              there, not that the mechanic is missing.
            </CardDescription>
            <TierLegend className="mt-1" />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mechanic</TableHead>
                  {project.brands.map((b) => (
                    <TableHead key={b.id} className="text-center">
                      {b.role === "own_brand" ? `${b.name} (you)` : b.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {scoredMechanics.map((mechanic) => (
                  <TableRow key={mechanic.key}>
                    <TableCell className="font-medium">
                      {mechanic.label}
                    </TableCell>
                    {project.brands.map((b) => {
                      const analysis = loyaltyOf(b);
                      const score = mechanicScore(analysis, mechanic.key);
                      return (
                        <TableCell key={b.id} className="text-center">
                          {score === null ? (
                            <span
                              className="cursor-help"
                              title={mechanicGapReason(
                                mechanic.key,
                                retentionContext(analysis)
                              )}
                            >
                              <ScoreChip score={null} />
                            </span>
                          ) : (
                            <ScoreChip
                              score={score}
                              muted={b.role !== "own_brand"}
                            />
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              Login-only mechanics (progress, personalisation, account
              integration) score automatically when the agent&apos;s test
              account gets in, no action needed from you.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Top gaps with evidence + action */}
      <ImproveFirst ownBrand={ownBrand} competitors={competitors} />

      <LiveCaptureDialog
        brand={captureBrand}
        projectId={project.id}
        onClose={() => setCaptureBrand(null)}
      />
    </div>
  );
}

export default function RetentionPage() {
  const params = useParams<{ id: string }>();
  return (
    <ProjectShell projectId={params.id}>
      {(project) => <RetentionContent project={project} />}
    </ProjectShell>
  );
}
