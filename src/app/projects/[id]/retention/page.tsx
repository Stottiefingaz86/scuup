"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, CircleAlert, ExternalLink, Radio } from "lucide-react";
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
import { AreaFocus } from "@/components/area-focus";
import { BrandMark } from "@/components/brand-mark";
import { LiveCaptureDialog } from "@/components/live-capture-dialog";
import { ProjectShell } from "@/components/project-shell";
import { RetentionMechanicInsights } from "@/components/retention-mechanic-insights";
import { RunAgentButton } from "@/components/run-agent-button";
import { ScoreBar } from "@/components/score-bar";
import { ScoreChip, TierLegend } from "@/components/score-chip";
import { ScoreGauge } from "@/components/score-gauge";
import {
  backfillRetentionNotes,
  jobsNeedingRetentionNotes,
} from "@/lib/backfill-retention-notes";
import { RETENTION_MECHANICS } from "@/lib/constants";
import {
  applyRetentionGates,
  mechanicGapReason,
  naCtaForMechanic,
  RETENTION_MECHANIC_META,
} from "@/lib/retention-scoring";
import { cn } from "@/lib/utils";
import type { Brand, JourneyAnalysis, Project } from "@/lib/types";

const LOYALTY = "loyalty_rewards";

function retentionContext(analysis: JourneyAnalysis | null) {
  return (
    analysis?.retentionContext ?? { loggedIn: false, fromSession: false }
  );
}

function gatedRetention(analysis: JourneyAnalysis | null) {
  if (!analysis?.retention) return undefined;
  return applyRetentionGates(analysis.retention, retentionContext(analysis));
}

/** The brand's real loyalty analysis, or null (not run / blocked). */
function loyaltyOf(brand: Brand): JourneyAnalysis | null {
  const a = brand.analyses[LOYALTY];
  return a && !a.blocked ? a : null;
}

/** Mechanic score after evidence gates (login / tracked play). */
function mechanicScore(
  analysis: JourneyAnalysis | null,
  key: string
): number | null {
  const gated = gatedRetention(analysis);
  if (!gated) return null;
  const v = gated[key];
  return v === undefined ? null : v;
}

function mechanicCoverage(analysis: JourneyAnalysis | null): {
  observed: number;
  total: number;
} {
  const total = RETENTION_MECHANICS.length;
  const gated = gatedRetention(analysis);
  if (!gated) return { observed: 0, total };
  const observed = RETENTION_MECHANICS.filter(
    (m) => gated[m.key] !== null && gated[m.key] !== undefined
  ).length;
  return { observed, total };
}

/** Longitudinal value-back tile: what tracked play has revealed so far. */
function ValueBackTile({
  brand,
  project,
  onLaunch,
}: {
  brand: Brand;
  project: Project;
  onLaunch: (brand: Brand) => void;
}) {
  const own = brand.role === "own_brand";
  const sessions = project.sessions.filter((s) => s.brandId === brand.id);
  const rewardEvents = sessions.flatMap((s) =>
    s.events.filter((e) => e.kind === "reward")
  );
  const moneyEvents = sessions.flatMap((s) =>
    s.events.filter((e) => e.kind === "money")
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-5",
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
            <span className="text-xs text-muted-foreground">
              {sessions.length > 0
                ? `${sessions.length} tracked session${sessions.length === 1 ? "" : "s"}`
                : "No tracked play yet"}
            </span>
          </div>
        </div>
        <Button
          size="sm"
          variant={sessions.length > 0 ? "outline" : "default"}
          onClick={() => onLaunch(brand)}
        >
          <ExternalLink data-icon="inline-start" />
          {sessions.length > 0 ? "Track again" : "Start tracking"}
        </Button>
      </div>

      {sessions.length > 0 ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-3xl font-semibold tabular-nums">
              {rewardEvents.length}
            </span>
            <span className="text-sm text-muted-foreground">
              reward events across {moneyEvents.length} money events
            </span>
          </div>
          <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
            The observed value-back rate (what this brand actually returns per
            pound staked) sharpens as tracked sessions accumulate — rakeback,
            rebates and level-ups surface over weeks, not one visit.
          </p>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-3xl font-semibold text-muted-foreground/50">
              ?
            </span>
            <span className="text-sm text-muted-foreground">
              value-back unknown — no tracked play yet
            </span>
          </div>
          <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
            Track play sessions over time to measure what this brand actually
            gives back — rakeback, boosts, rebates and level-up rewards.
          </p>
        </>
      )}
    </div>
  );
}

const PROMO_VS_LOOP: [string, string][] = [
  ["One-off offers", "Always-on value"],
  ["Deposit bonus focused", "Progress and return focused"],
  ["Campaign-led", "Behaviour-led"],
  ["Hidden in promo page", "Visible across product"],
  ["Player asks “what offer is live?”", "Player asks “what can I unlock next?”"],
  ["Acquisition focused", "Habit and loyalty focused"],
];

function RetentionContent({ project }: { project: Project }) {
  const ownBrand = project.brands.find((b) => b.role === "own_brand")!;
  const competitors = project.brands.filter((b) => b.role !== "own_brand");
  const ranked = [...project.brands].sort(
    (a, b) => (loyaltyOf(b)?.score ?? -1) - (loyaltyOf(a)?.score ?? -1)
  );
  const [hoverCol, setHoverCol] = useState<string | null>(null);
  const [captureBrand, setCaptureBrand] = useState<Brand | null>(null);
  const pendingNotes = jobsNeedingRetentionNotes(project);
  const [notesBackfill, setNotesBackfill] = useState(false);
  const [notesBackfillLabel, setNotesBackfillLabel] = useState("");
  const notesBackfillKey = useRef<string | null>(null);

  useEffect(() => {
    if (pendingNotes.length === 0) return;
    const key = `${project.id}:${pendingNotes.map((j) => j.brandId).join(",")}`;
    if (notesBackfillKey.current === key) return;
    notesBackfillKey.current = key;

    let cancelled = false;
    setNotesBackfill(true);
    setNotesBackfillLabel(`Generating insight notes… (0/${pendingNotes.length})`);
    void backfillRetentionNotes(project.id, project, (done, total, label) => {
      if (!cancelled) setNotesBackfillLabel(`${label} (${done}/${total})`);
    }).finally(() => {
      if (!cancelled) setNotesBackfill(false);
    });
    return () => {
      cancelled = true;
    };
  }, [project, pendingNotes]);

  const ownAnalysis = loyaltyOf(ownBrand);
  const ownMechanics = RETENTION_MECHANICS.flatMap((m) => {
    const score = mechanicScore(ownAnalysis, m.key);
    return score === null ? [] : [{ label: m.label as string, score }];
  });

  const anyUnobserved = project.brands.some((b) => {
    const a = loyaltyOf(b);
    return RETENTION_MECHANICS.some((m) => mechanicScore(a, m.key) === null);
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Ranked retention loop gauges */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ranked.map((brand, i) => {
          const analysis = loyaltyOf(brand);
          const cov = mechanicCoverage(analysis);
          return (
            <Card key={brand.id} className="group/score">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BrandMark brand={brand} className="size-4" />
                    {brand.name}
                    {brand.role === "own_brand" ? " (you)" : ""}
                  </CardTitle>
                  {analysis ? (
                    <Badge variant={i === 0 ? "default" : "secondary"}>
                      #{i + 1}
                    </Badge>
                  ) : null}
                </div>
                {analysis?.retentionType ? (
                  <CardDescription>{analysis.retentionType}</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-3">
                {analysis ? (
                  <>
                    <ScoreGauge
                      score={analysis.score}
                      size={130}
                      caption="Retention Loop"
                      muted={brand.role !== "own_brand"}
                    />
                    {cov.observed > 0 && cov.observed < cov.total ? (
                      <p className="flex items-center gap-1.5 text-xs text-score-mid">
                        <CircleAlert className="size-3.5 shrink-0" />
                        Partial — {cov.observed} of {cov.total} mechanics
                        observed
                      </p>
                    ) : null}
                    <p className="line-clamp-4 text-sm text-muted-foreground">
                      {analysis.summary}
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <ScoreChip score={null} />
                    <p className="text-center text-xs leading-relaxed text-muted-foreground">
                      {brand.analyses[LOYALTY]?.blocked
                        ? (brand.analyses[LOYALTY].blockReason ??
                          "The agent was blocked here.")
                        : "Loyalty area not analysed yet."}
                    </p>
                    <RunAgentButton
                      projectId={project.id}
                      brand={brand}
                      area={LOYALTY}
                      label={
                        brand.analyses[LOYALTY]?.blocked
                          ? "Retry with agent"
                          : "Run agent"
                      }
                      variant="outline"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Per-brand deep dive with evidence */}
      <AreaFocus
        project={project}
        areas={[LOYALTY]}
        rankings={false}
        emptyHint="Run the agent to score the public loyalty hub, or record a live session for the logged-in loop."
      />

      {/* Eight-mechanic loop breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Retention loop breakdown</CardTitle>
          <CardDescription>
            The eight mechanics that decide whether players come back — scored
            per brand from the loyalty visit. Public mechanics (visibility,
            clarity, value-back, emotional pull) score from the agent;
            progress, personalisation, and account integration need login;
            frequency loop needs tracked play over time.
          </CardDescription>
          <TierLegend className="mt-1" />
        </CardHeader>
        <CardContent>
          <Table onMouseLeave={() => setHoverCol(null)}>
            <TableHeader>
              <TableRow>
                <TableHead>Mechanic</TableHead>
                {project.brands.map((b) => (
                  <TableHead
                    key={b.id}
                    className="text-center"
                    onMouseEnter={() =>
                      setHoverCol(b.role === "own_brand" ? null : b.id)
                    }
                  >
                    {b.role === "own_brand" ? `${b.name} (you)` : b.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {RETENTION_MECHANICS.map((mechanic) => {
                const meta = RETENTION_MECHANIC_META.find(
                  (m) => m.key === mechanic.key
                );
                return (
                <TableRow key={mechanic.key}>
                  <TableCell
                    className="font-medium"
                    onMouseEnter={() => setHoverCol(null)}
                  >
                    <span className="flex flex-col gap-0.5">
                      {mechanic.label}
                      {meta?.requires === "login" ? (
                        <span className="text-[10px] font-normal text-muted-foreground">
                          Needs login
                        </span>
                      ) : meta?.requires === "tracked_play" ? (
                        <span className="text-[10px] font-normal text-muted-foreground">
                          Needs tracked play
                        </span>
                      ) : null}
                    </span>
                  </TableCell>
                  {project.brands.map((b) => {
                    const analysis = loyaltyOf(b);
                    const score = mechanicScore(analysis, mechanic.key);
                    const ctx = retentionContext(analysis);
                    return (
                      <TableCell
                        key={b.id}
                        className="text-center"
                        onMouseEnter={() =>
                          setHoverCol(b.role === "own_brand" ? null : b.id)
                        }
                      >
                        {score === null ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span title={mechanicGapReason(mechanic.key, ctx)}>
                              <ScoreChip score={null} />
                            </span>
                            {naCtaForMechanic(mechanic.key) === "launch" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 gap-1 px-2 text-xs"
                                onClick={() => setCaptureBrand(b)}
                              >
                                <ExternalLink className="size-3" />
                                Launch
                              </Button>
                            ) : analysis?.retention ? (
                              <RunAgentButton
                                projectId={project.id}
                                brand={b}
                                area={LOYALTY}
                                label="Agent"
                                variant="outline"
                                className="h-6 px-2 text-xs"
                              />
                            ) : (
                              <RunAgentButton
                                projectId={project.id}
                                brand={b}
                                area={LOYALTY}
                                label="Agent"
                                variant="outline"
                                className="h-6 px-2 text-xs"
                              />
                            )}
                          </span>
                        ) : (
                          <ScoreChip
                            score={score}
                            muted={b.role !== "own_brand" && hoverCol !== b.id}
                          />
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
          {anyUnobserved ? (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              N/A means we don&apos;t have the right evidence yet — not that the
              mechanic is missing. Public mechanics score from the agent&apos;s
              loyalty visit. Progress, personalisation, and account integration
              need a logged-in Launch session — we won&apos;t recommend changes
              there until you sign in. Frequency loop needs tracked play over
              days or weeks (claims, reloads, emails).
            </p>
          ) : null}
        </CardContent>
      </Card>

      <RetentionMechanicInsights
        ownBrand={ownBrand}
        competitors={competitors}
        loyaltyOf={loyaltyOf}
        mechanicScore={mechanicScore}
        loadingLabel={notesBackfill ? notesBackfillLabel : undefined}
      />

      {/* Value-back tracker */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Radio className="size-4 text-brand" />
            <CardTitle>Value-back tracker</CardTitle>
            <Button
              size="sm"
              variant="ghost"
              className="ms-auto text-muted-foreground"
              nativeButton={false}
              render={<Link href={`/projects/${project.id}/sessions`} />}
            >
              Session breakdowns
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
          <CardDescription>
            Rewards are issued over time — rakeback, rebates, boosts and
            level-ups can take months or years to surface. Tracked play
            sessions accumulate into an observed value-back rate: what each
            brand actually returns per pound staked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {project.brands.map((brand) => (
              <ValueBackTile
                key={brand.id}
                brand={brand}
                project={project}
                onLaunch={setCaptureBrand}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Where your loop breaks</CardTitle>
            <CardDescription>
              Your weakest retention mechanics, in priority order.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {ownMechanics.length > 0 ? (
              [...ownMechanics]
                .sort((a, b) => a.score - b.score)
                .map((m) => (
                  <ScoreBar
                    key={m.label}
                    label={m.label}
                    score={m.score}
                    highlight
                  />
                ))
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Run the agent on your own loyalty area to see which of the
                  eight mechanics are costing you returning players.
                </p>
                <RunAgentButton
                  projectId={project.id}
                  brand={ownBrand}
                  area={LOYALTY}
                  label="Analyse your loop"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Promo-led vs retention-loop-led</CardTitle>
            <CardDescription>
              The strategic difference this analysis measures.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Promo-led</TableHead>
                  <TableHead>Retention-loop-led</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PROMO_VS_LOOP.map(([promo, loop]) => (
                  <TableRow key={promo}>
                    <TableCell className="text-muted-foreground">
                      {promo}
                    </TableCell>
                    <TableCell>{loop}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

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
