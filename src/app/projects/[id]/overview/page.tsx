"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  ExternalLink,
  FileText,
  Lightbulb,
  Radio,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BrandCard } from "@/components/brand-card";
import { BrandMark } from "@/components/brand-mark";
import { LiveCaptureDialog } from "@/components/live-capture-dialog";
import { ProjectShell } from "@/components/project-shell";
import { RunAgentButton } from "@/components/run-agent-button";
import { ScoreBar } from "@/components/score-bar";
import { TierLegend } from "@/components/score-chip";
import { getCoverage } from "@/lib/coverage";
import { agentCanReach, LANDING } from "@/lib/constants";
import {
  areaScore,
  overallScore,
  toObservation,
  type Brand,
  type Project,
} from "@/lib/types";

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

function OverviewContent({ project }: { project: Project }) {
  const ownBrand = project.brands.find((b) => b.role === "own_brand")!;
  const [captureBrand, setCaptureBrand] = useState<Brand | null>(null);
  const coverage = getCoverage(project);

  const scored = project.brands
    .map((b) => ({ brand: b, score: overallScore(b) }))
    .filter((b): b is { brand: Brand; score: number } => b.score !== null)
    .sort((a, b) => b.score - a.score);
  const ownScore = overallScore(ownBrand);
  const ownRank =
    ownScore === null
      ? null
      : scored.findIndex((s) => s.brand.id === ownBrand.id) + 1;
  const leader = scored[0];
  const rankByBrand = Object.fromEntries(
    scored.map((s, i) => [s.brand.id, i + 1])
  );

  const ownLanding = ownBrand.analyses[LANDING];

  const heroStats = [
    {
      label: "Player CX rank",
      value: ownRank === null ? "—" : ordinal(ownRank),
      detail:
        ownRank === null
          ? "no scored analysis yet"
          : `of ${scored.length} scored brands`,
    },
    {
      label: "Player CX Score",
      value: ownScore ?? "N/A",
      detail: leader
        ? `leader ${leader.brand.name} at ${leader.score}`
        : "no brands scored yet",
    },
    {
      label: "Data coverage",
      value: `${coverage.pct}%`,
      detail: `${coverage.captured} of ${coverage.total} areas captured`,
    },
    {
      label: "Live sessions",
      value: project.sessions.length,
      detail:
        project.sessions.length === 0
          ? "record sessions to go deeper"
          : "recorded this cycle",
    },
  ] as const;

  const execRead = (() => {
    if (ownScore === null) {
      return {
        headline: (
          <>
            We couldn&apos;t score your brand yet —{" "}
            <span className="text-brand">take over a live session</span> to
            get your baseline.
          </>
        ),
        body:
          ownLanding?.blockReason ??
          "The agent was blocked before it could observe your site. Launch it in a recorded session — a human passes the checks our agent can't.",
      };
    }
    if (leader && leader.brand.id !== ownBrand.id) {
      return {
        headline: (
          <>
            <span className="text-brand">{leader.brand.name}</span> leads the
            set at {leader.score} — you&apos;re {leader.score - ownScore}{" "}
            points behind on first impressions.
          </>
        ),
        body:
          ownLanding?.summary ??
          "Run more analyses to understand where the gap comes from.",
      };
    }
    return {
      headline: (
        <>
          You lead the set at <span className="text-brand">{ownScore}</span> —
          now protect it by going deeper than first impressions.
        </>
      ),
      body:
        ownLanding?.summary ??
        "Record live sessions to extend your lead into cashier, rewards and support.",
    };
  })();

  return (
    <div className="flex flex-col gap-6">
      {/* Executive read */}
      <Card className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-brand/10 blur-3xl"
        />
        <CardContent className="grid gap-8 lg:grid-cols-[1fr_auto]">
          <div className="flex flex-col justify-center gap-3">
            <Badge variant="outline" className="w-fit gap-1.5">
              <Sparkles className="size-3" />
              Executive read
            </Badge>
            <h2 className="max-w-xl font-heading text-2xl font-medium leading-snug tracking-tight">
              {execRead.headline}
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              {execRead.body}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1 w-fit"
              nativeButton={false}
              render={<Link href={`/projects/${project.id}/journeys`} />}
            >
              See the journey analysis
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4 lg:grid-cols-2">
            {heroStats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col gap-1 bg-card px-5 py-4"
              >
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </span>
                <span className="font-heading text-3xl font-semibold tabular-nums">
                  {stat.value}
                </span>
                <span className="text-xs text-muted-foreground">
                  {stat.detail}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Brand cards */}
      <TierLegend className="px-1" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {project.brands.map((brand) => (
          <BrandCard
            key={brand.id}
            brand={brand}
            projectId={project.id}
            rank={rankByBrand[brand.id]}
          />
        ))}
      </div>

      {/* Data coverage */}
      {coverage.gaps.length > 0 ? (
        <Card>
          <CardContent className="grid gap-6 lg:grid-cols-[240px_1fr]">
            <div className="flex flex-col justify-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Data coverage
              </span>
              <span className="font-heading text-4xl font-semibold tabular-nums">
                {coverage.pct}%
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${coverage.pct}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {coverage.captured} of {coverage.total} areas captured so far.
                Every gap below fills in with a recorded live session — no
                guesses, no synthetic scores.
              </span>
            </div>
            <div className="flex max-h-96 flex-col gap-3 overflow-y-auto pe-1">
              {coverage.gaps.map((gap) => (
                <div
                  key={gap.id}
                  className="flex items-start gap-3 rounded-xl border p-4"
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md",
                      gap.reason === "blocked"
                        ? "bg-score-weak/10 text-score-weak"
                        : "bg-score-mid/10 text-score-mid"
                    )}
                  >
                    {gap.reason === "blocked" ? (
                      <ShieldAlert className="size-4" />
                    ) : (
                      <Radio className="size-4" />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium">{gap.title}</span>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      {gap.detail}
                    </span>
                  </div>
                  {gap.reason === "not_analysed" && agentCanReach(gap.area) ? (
                    <RunAgentButton
                      projectId={project.id}
                      brand={gap.brand}
                      area={gap.area}
                      label={gap.cta}
                      variant="outline"
                      className="ms-auto shrink-0"
                    />
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="ms-auto shrink-0"
                      onClick={() => setCaptureBrand(gap.brand)}
                    >
                      <ExternalLink data-icon="inline-start" />
                      {gap.cta}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <LiveCaptureDialog
        brand={captureBrand}
        projectId={project.id}
        onClose={() => setCaptureBrand(null)}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* First impression ranking */}
        <Card className="group/score">
          <CardHeader>
            <CardTitle>First impression</CardTitle>
            <CardDescription>
              What a new player sees in the first seconds on each site.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {project.brands
              .map((b) => ({ brand: b, score: areaScore(b, LANDING) }))
              .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
              .map(({ brand, score }, i) =>
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
                    <span className="ms-auto rounded-md border border-dashed border-border px-1.5 py-0.5 font-heading text-xs text-muted-foreground/60">
                      N/A
                    </span>
                  </div>
                )
              )}
          </CardContent>
        </Card>

        {/* Own brand heuristics */}
        <Card className="group/score">
          <CardHeader>
            <CardTitle>Your first-impression breakdown</CardTitle>
            <CardDescription>
              {ownLanding && !ownLanding.blocked
                ? "How the vision model scored each heuristic on your landing experience."
                : "Appears once your site has a successful analysis."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {ownLanding && !ownLanding.blocked ? (
              ownLanding.heuristics.map((h) => (
                <ScoreBar
                  key={h.name}
                  label={h.name}
                  score={h.score}
                  highlight
                />
              ))
            ) : (
              <div className="flex flex-col items-start gap-3 py-4">
                <p className="text-sm text-muted-foreground">
                  {ownLanding?.blockReason ??
                    "No analysis captured for your brand yet."}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCaptureBrand(ownBrand)}
                >
                  <ExternalLink data-icon="inline-start" />
                  Launch site & record
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Observations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="size-4 text-brand" />
                What the analyst saw
              </CardTitle>
              <CardDescription>
                Concrete observations from this cycle&apos;s real site visits.
              </CardDescription>
            </div>
            <Button
              nativeButton={false}
              render={<Link href={`/projects/${project.id}/report`} />}
            >
              <FileText data-icon="inline-start" />
              View report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {project.brands.some(
            (b) => (b.analyses[LANDING]?.observations.length ?? 0) > 0
          ) ? (
            <div className="grid gap-3 md:grid-cols-2">
              {project.brands
                .filter(
                  (b) => (b.analyses[LANDING]?.observations.length ?? 0) > 0
                )
                .map((b) => (
                  <div
                    key={b.id}
                    className={cn(
                      "flex flex-col gap-2.5 rounded-xl border bg-background/40 p-5",
                      b.role === "own_brand" &&
                        "border-brand/30 bg-brand/[0.04]"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <BrandMark brand={b} className="size-5" />
                      <span className="font-heading font-medium">
                        {b.name}
                        {b.role === "own_brand" ? " (you)" : ""}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {b.analyses[LANDING]!.observations.slice(0, 4).map(
                        (o, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
                          >
                            <span className="mt-2 size-1 shrink-0 rounded-full bg-brand/60" />
                            {toObservation(o).text}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                ))}
            </div>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">
              No observations yet — they appear as soon as an analysis
              completes.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function OverviewPage() {
  const params = useParams<{ id: string }>();
  return (
    <ProjectShell projectId={params.id}>
      {(project) => <OverviewContent project={project} />}
    </ProjectShell>
  );
}
