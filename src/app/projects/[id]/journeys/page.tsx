"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Globe,
  KeyRound,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { AnimatedTabs } from "@/components/animated-tabs";
import { BrandMark, BrandTabLabel } from "@/components/brand-mark";
import { EvidenceObservations } from "@/components/evidence-observations";
import { GapCompare } from "@/components/gap-compare";
import { LiveCaptureDialog } from "@/components/live-capture-dialog";
import { Verdict } from "@/components/verdict";
import { ProjectShell } from "@/components/project-shell";
import { RunAgentButton } from "@/components/run-agent-button";
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
import { runAgentBatch, useRunningAgents } from "@/lib/run-agent";
import { areaScore, type Brand, type Project } from "@/lib/types";

/** Public journeys are walked logged out; the rest need a session. */
function AccessBadge({ area, muted }: { area: string; muted?: boolean }) {
  const loggedIn = journeyRequiresLogin(area);
  return (
    <span
      title={
        loggedIn
          ? "Scored from a logged-in session — needs a saved test account"
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

function JourneysContent({ project }: { project: Project }) {
  const ownBrand = project.brands.find((b) => b.role === "own_brand")!;
  const competitors = project.brands.filter((b) => b.role === "competitor");
  const areas = projectAreas(project);
  const [selected, setSelected] = useState<string>(areas[0]);
  const [hoverCol, setHoverCol] = useState<string | null>(null);
  const [tabBrand, setTabBrand] = useState<string>(ownBrand.id);
  const [captureBrand, setCaptureBrand] = useState<Brand | null>(null);

  const detailBrand =
    project.brands.find((b) => b.id === tabBrand) ?? ownBrand;
  const detail = detailBrand.analyses[selected];

  // Comparison target: viewing a competitor compares against you; viewing
  // your own brand compares against the strongest analysed competitor.
  const rivalBrand =
    detailBrand.role === "own_brand"
      ? (competitors
          .filter((b) => b.analyses[selected] && !b.analyses[selected].blocked)
          .sort(
            (a, b) => b.analyses[selected].score - a.analyses[selected].score
          )[0] ?? null)
      : ownBrand.analyses[selected] && !ownBrand.analyses[selected].blocked
        ? ownBrand
        : null;
  const rivalDetail = rivalBrand?.analyses[selected];
  const hasGaps = project.brands.some((b) =>
    areas.some((a) => areaScore(b, a) === null)
  );
  const runningCount = useRunningAgents().length;
  const agentJobs = project.brands.flatMap((brand) =>
    areas
      .filter((a) => agentCanReach(a) && areaScore(brand, a) === null)
      .map((area) => ({ brand, area }))
  );

  /** Action shown in an N/A cell: the agent if it can get there itself
   * (or with a saved login), otherwise a manual launch. Blocked runs show
   * why. Login-gated agent runs fail with a clear "set up Accounts" error
   * when no session is saved. */
  const naAction = (brand: Brand, area: string) => (
    <span className="inline-flex items-center gap-1.5">
      {brand.analyses[area]?.blocked ? (
        <span
          title={
            brand.analyses[area].blockReason ??
            "The agent was blocked before it could observe this area."
          }
          className="inline-flex cursor-help items-center gap-1 rounded-md bg-score-weak/10 px-1.5 py-0.5 text-[11px] font-medium text-score-weak"
        >
          <CircleAlert className="size-3" />
          Blocked
        </span>
      ) : (
        <ScoreChip score={null} />
      )}
      {agentCanReachLoggedIn(area) ? (
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
          onClick={(e) => {
            e.stopPropagation();
            setCaptureBrand(brand);
          }}
        >
          <ExternalLink className="size-3" />
          Launch
        </Button>
      )}
    </span>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Scorecard */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <CardTitle>Journey score matrix</CardTitle>
              <CardDescription>
                Every score comes from a real analysed visit. Click a row for
                the deep dive.
              </CardDescription>
            </div>
            {agentJobs.length > 0 ? (
              <Button
                size="sm"
                disabled={runningCount > 0}
                className="gap-1.5"
                onClick={async () => {
                  const failures = await runAgentBatch(project.id, agentJobs);
                  if (failures.length === 0) {
                    toast.success("All agent runs finished", {
                      description: "Every reachable area is now scored.",
                    });
                  } else {
                    for (const f of failures) {
                      toast.error(
                        `${f.brand} — ${ANALYSIS_AREA_LABELS[f.area] ?? f.area} failed`,
                        { description: f.error, duration: 10000 }
                      );
                    }
                  }
                }}
              >
                {runningCount > 0 ? (
                  <>Agents running ({runningCount})…</>
                ) : (
                  <>Fill {agentJobs.length} gaps with the agent</>
                )}
              </Button>
            ) : null}
          </div>
          <TierLegend className="mt-1" />
        </CardHeader>
        <CardContent>
          <Table onMouseLeave={() => setHoverCol(null)}>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                <TableHead className="text-center">
                  <span className="inline-flex items-center gap-1.5">
                    <BrandMark brand={ownBrand} className="size-4" />
                    {ownBrand.name} (you)
                  </span>
                </TableHead>
                {competitors.map((c) => (
                  <TableHead
                    key={c.id}
                    className="text-center"
                    onMouseEnter={() => setHoverCol(c.id)}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <BrandMark brand={c} className="size-4" />
                      {c.name}
                    </span>
                  </TableHead>
                ))}
                <TableHead className="text-right">Gap to best</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areas.map((area) => {
                const own = areaScore(ownBrand, area);
                const allScores = project.brands
                  .map((b) => areaScore(b, area))
                  .filter((s): s is number => s !== null);
                const best = allScores.length ? Math.max(...allScores) : null;
                const gap = own !== null && best !== null ? own - best : null;
                return (
                  <TableRow
                    key={area}
                    onClick={() => setSelected(area)}
                    className={cn(
                      "cursor-pointer",
                      selected === area &&
                        "bg-accent/50 shadow-[inset_2px_0_0_0_var(--brand)]"
                    )}
                  >
                    <TableCell
                      className="font-medium"
                      onMouseEnter={() => setHoverCol(null)}
                    >
                      <span className="inline-flex items-center gap-2">
                        {ANALYSIS_AREA_LABELS[area] ?? area}
                        <AccessBadge area={area} />
                      </span>
                    </TableCell>
                    <TableCell
                      className="text-center"
                      onMouseEnter={() => setHoverCol(null)}
                    >
                      {own !== null ? (
                        <ScoreChip score={own} />
                      ) : (
                        naAction(ownBrand, area)
                      )}
                    </TableCell>
                    {competitors.map((c) => (
                      <TableCell
                        key={c.id}
                        className="text-center"
                        onMouseEnter={() => setHoverCol(c.id)}
                      >
                        {areaScore(c, area) === null ? (
                          naAction(c, area)
                        ) : (
                          <ScoreChip
                            score={areaScore(c, area)}
                            muted={hoverCol !== c.id}
                          />
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-right tabular-nums">
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
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {hasGaps ? (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              N/A — not observed yet. The agent reaches public areas (sign-up
              form, casino, sportsbook, rewards, support) on its own. Deposit,
              withdrawal and account journeys need a logged-in session — save
              a test account on the Accounts page and the agent walks those
              too, or record a live session.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <LiveCaptureDialog
        brand={captureBrand}
        projectId={project.id}
        onClose={() => setCaptureBrand(null)}
      />

      {/* Deep dive */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <CardTitle className="font-heading text-xl">
                {ANALYSIS_AREA_LABELS[selected] ?? selected} deep dive
              </CardTitle>
              <AccessBadge area={selected} />
              <div className="ms-auto flex items-center gap-1">
                <span className="me-1 font-mono text-xs tabular-nums text-muted-foreground">
                  {areas.indexOf(selected) + 1}/{areas.length}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-7"
                  aria-label="Previous journey"
                  onClick={() =>
                    setSelected(
                      areas[
                        (areas.indexOf(selected) - 1 + areas.length) %
                          areas.length
                      ]
                    )
                  }
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-7"
                  aria-label="Next journey"
                  onClick={() =>
                    setSelected(
                      areas[(areas.indexOf(selected) + 1) % areas.length]
                    )
                  }
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            <AnimatedTabs
              tabs={project.brands.map((b) => ({
                value: b.id,
                label: (
                  <BrandTabLabel brand={b} score={areaScore(b, selected)} />
                ),
              }))}
              value={tabBrand}
              onValueChange={setTabBrand}
            />
          </div>
        </CardHeader>
        <CardContent>
          {detail && !detail.blocked ? (
            <div
              key={`${selected}-${tabBrand}`}
              className="flex flex-col gap-6 duration-300 animate-in fade-in-0 slide-in-from-bottom-2"
            >
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <ScoreGauge
                  score={detail.score}
                  size={140}
                  caption={ANALYSIS_AREA_LABELS[selected]}
                  muted={detailBrand.role !== "own_brand"}
                  className="shrink-0"
                />
                <div className="flex min-w-0 flex-col gap-2">
                  <Verdict text={detail.summary} />
                  <span className="text-xs text-muted-foreground">
                    Analysed{" "}
                    {new Date(detail.analysedAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · {detail.finalUrl}
                  </span>
                </div>
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

              <Separator />

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
            <div
              key={`${selected}-${tabBrand}-empty`}
              className="flex flex-col items-start gap-3 py-6 duration-300 animate-in fade-in-0"
            >
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                {detail?.blocked
                  ? (detail.blockReason ??
                    "The agent was blocked before it could observe this area.")
                  : agentCanReach(selected)
                    ? `No analysis captured for ${detailBrand.name} here yet. The agent can navigate there and score it on its own.`
                    : `No analysis captured for ${detailBrand.name} here yet. This journey sits behind a login — launch the site in a recorded session to score it.`}
              </p>
              <div className="flex items-center gap-2">
                {agentCanReach(selected) ? (
                  <RunAgentButton
                    projectId={project.id}
                    brand={detailBrand}
                    area={selected}
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
