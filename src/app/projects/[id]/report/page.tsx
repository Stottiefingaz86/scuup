"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  Mail,
  Printer,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { ActionPlanView } from "@/components/action-plan-view";
import { BrandMark } from "@/components/brand-mark";
import { ProjectShell } from "@/components/project-shell";
import { ScoreChip, TierLegend } from "@/components/score-chip";
import { ScoreGauge } from "@/components/score-gauge";
import { ANALYSIS_AREA_LABELS } from "@/lib/constants";
import { getCoverage, projectAreas } from "@/lib/coverage";
import {
  areaScore,
  overallScore,
  toObservation,
  type Brand,
  type Project,
} from "@/lib/types";

const SECTIONS = [
  { id: "summary", title: "Executive summary" },
  { id: "ranking", title: "Competitor ranking" },
  { id: "findings", title: "Findings by area" },
  { id: "action-plan", title: "Action plan" },
  { id: "coverage", title: "Data coverage & next steps" },
];

function SectionHeading({
  index,
  title,
  description,
}: {
  index: number;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-b pb-4">
      <span className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-brand">
        Section {String(index).padStart(2, "0")}
      </span>
      <h2 className="font-heading text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      {description ? (
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

function BrandLabel({ brand }: { brand: Brand }) {
  return (
    <span className="inline-flex items-center gap-2">
      <BrandMark brand={brand} className="size-5" />
      <span className="font-medium">
        {brand.name}
        {brand.role === "own_brand" ? (
          <span className="ms-1 text-xs text-brand">(you)</span>
        ) : null}
      </span>
    </span>
  );
}

function ReportContent({ project }: { project: Project }) {
  const areas = projectAreas(project);
  const coverage = getCoverage(project);
  const ownBrand = project.brands.find((b) => b.role === "own_brand")!;

  const ranked = project.brands
    .map((b) => ({ brand: b, score: overallScore(b) }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const leader = ranked.find((r) => r.score !== null);
  const ownScore = overallScore(ownBrand);

  const reportDate = new Date(
    project.analysedAt ?? project.createdAt
  ).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const analysedAreas = areas.filter((area) =>
    project.brands.some((b) => areaScore(b, area) !== null)
  );

  return (
    <div className="report-document mx-auto flex w-full max-w-4xl flex-col gap-10">
      {/* Toolbar */}
      <div className="flex items-center gap-2 print:hidden">
        <span className="text-sm text-muted-foreground">
          Every number in this report comes from a real analysed visit or
          recorded session.
        </span>
        <div className="ms-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <a
                href={`mailto:?subject=${encodeURIComponent(
                  `${project.name} — Competitor CX report`
                )}&body=${encodeURIComponent(
                  `The latest competitor CX report for ${project.name}: ${
                    typeof window !== "undefined" ? window.location.href : ""
                  }`
                )}`}
              />
            }
          >
            <Mail data-icon="inline-start" />
            Send email
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer data-icon="inline-start" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Cover */}
      <Card className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-28 -top-28 size-72 rounded-full bg-brand/10 blur-3xl"
        />
        <CardContent className="flex flex-col gap-8 py-10">
          <div className="flex flex-col gap-3">
            <Badge variant="outline" className="w-fit gap-1.5">
              <Sparkles className="size-3" />
              Competitor CX intelligence · {reportDate}
            </Badge>
            <h1 className="max-w-2xl font-heading text-4xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              {project.market} · {project.brands.length} brands ·{" "}
              {coverage.pct}% data coverage this cycle ·{" "}
              {project.sessions.length} recorded session
              {project.sessions.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {project.brands.map((b) => (
              <span
                key={b.id}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                  b.role === "own_brand" && "border-brand/40 bg-brand/5"
                )}
              >
                <BrandMark brand={b} className="size-4" />
                {b.name}
              </span>
            ))}
          </div>

          <TierLegend />

          <Separator />

          <ol className="grid gap-2 text-sm sm:grid-cols-2">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex items-center gap-2.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="font-heading text-xs font-semibold text-brand">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* 01 — Executive summary */}
      <section id="summary" className="flex flex-col gap-6">
        <SectionHeading
          index={1}
          title="Executive summary"
          description="What the analyst found across this cycle's real site visits."
        />
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <Card>
            <CardContent className="flex flex-col items-center gap-2 px-10 py-6">
              {ownScore !== null ? (
                <ScoreGauge
                  score={ownScore}
                  size={170}
                  caption="Your Player CX Score"
                />
              ) : (
                <div className="flex h-[120px] flex-col items-center justify-center gap-1.5">
                  <span className="font-heading text-4xl font-semibold text-muted-foreground/40">
                    N/A
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Your brand couldn&apos;t be scored yet
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col justify-center gap-3 py-6">
              {leader ? (
                <>
                  <p className="font-heading text-xl font-medium leading-snug">
                    {leader.brand.id === ownBrand.id ? (
                      <>
                        You lead the set at{" "}
                        <span className="text-brand">{leader.score}</span>.
                      </>
                    ) : (
                      <>
                        <span className="text-brand">
                          {leader.brand.name}
                        </span>{" "}
                        leads the set at {leader.score}
                        {ownScore !== null
                          ? ` — you trail by ${leader.score! - ownScore}.`
                          : "."}
                      </>
                    )}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {ownBrand.analyses.landing && !ownBrand.analyses.landing.blocked
                      ? ownBrand.analyses.landing.summary
                      : (ownBrand.analyses.landing?.blockReason ??
                        "Your brand has no successful analysis yet — resolve the gap from the coverage section to establish your baseline.")}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No brand has a successful analysis yet. Resolve the gaps in
                  the coverage section to populate this report.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 02 — Ranking */}
      <section id="ranking" className="flex flex-col gap-6">
        <SectionHeading
          index={2}
          title="Competitor ranking"
          description="Overall score is the average of each brand's successfully analysed areas. N/A means not observed — never estimated."
        />
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  {areas.map((area) => (
                    <TableHead key={area} className="text-center">
                      {ANALYSIS_AREA_LABELS[area] ?? area}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Overall</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map(({ brand, score }) => (
                  <TableRow
                    key={brand.id}
                    className={cn(
                      brand.role === "own_brand" && "bg-brand/[0.04]"
                    )}
                  >
                    <TableCell>
                      <BrandLabel brand={brand} />
                    </TableCell>
                    {areas.map((area) => (
                      <TableCell key={area} className="text-center">
                        <ScoreChip
                          score={areaScore(brand, area)}
                          muted={brand.role !== "own_brand"}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      {score !== null ? (
                        <span className="font-heading text-base font-semibold tabular-nums">
                          {score}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">
                          N/A
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* 03 — Findings by area */}
      <section id="findings" className="flex flex-col gap-6">
        <SectionHeading
          index={3}
          title="Findings by area"
          description="Per-area summaries and the concrete observations behind each score."
        />
        {analysedAreas.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              No areas have a successful analysis yet.
            </CardContent>
          </Card>
        ) : (
          analysedAreas.map((area) => (
            <Card key={area}>
              <CardContent className="flex flex-col gap-5 py-6">
                <h3 className="font-heading text-lg font-medium">
                  {ANALYSIS_AREA_LABELS[area] ?? area}
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {project.brands.map((brand) => {
                    const analysis = brand.analyses[area];
                    if (!analysis) return null;
                    return (
                      <div
                        key={brand.id}
                        className={cn(
                          "flex flex-col gap-2.5 rounded-xl border bg-background/40 p-5",
                          brand.role === "own_brand" &&
                            "border-brand/30 bg-brand/[0.04]"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <BrandLabel brand={brand} />
                          <span className="ms-auto">
                            <ScoreChip
                              score={analysis.blocked ? null : analysis.score}
                              muted={brand.role !== "own_brand"}
                            />
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {analysis.blocked
                            ? analysis.blockReason
                            : analysis.summary}
                        </p>
                        {!analysis.blocked &&
                        analysis.observations.length > 0 ? (
                          <ul className="flex flex-col gap-1.5 border-t pt-3">
                            {analysis.observations.slice(0, 3).map((o, i) => (
                              <li
                                key={i}
                                className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
                              >
                                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand/60" />
                                {toObservation(o).text}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {/* 04 — Action plan */}
      <section id="action-plan" className="flex flex-col gap-6">
        <SectionHeading
          index={4}
          title="Action plan"
          description="Prioritised roadmap synthesised from every finding in this report — each action cites the evidence behind it."
        />
        {project.actionPlan ? (
          <ActionPlanView plan={project.actionPlan} />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-start gap-3 py-8">
              <p className="text-sm text-muted-foreground">
                The action plan hasn&apos;t been built for this project yet.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="print:hidden"
                nativeButton={false}
                render={<Link href={`/projects/${project.id}/action-plan`} />}
              >
                Build it on the Action Plan page
                <ArrowRight data-icon="inline-end" />
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      {/* 05 — Coverage */}
      <section id="coverage" className="flex flex-col gap-6">
        <SectionHeading
          index={5}
          title="Data coverage & next steps"
          description="What this edition could and couldn't observe, and exactly how the next edition gets sharper."
        />
        <Card>
          <CardContent className="flex flex-col gap-6 py-6">
            <div className="flex items-center gap-6">
              <span className="font-heading text-5xl font-semibold tabular-nums">
                {coverage.pct}%
              </span>
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${coverage.pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {coverage.captured} of {coverage.total} brand-areas captured
                  this cycle. Missing areas are shown as N/A rather than
                  estimated — the score you see is the score that was
                  observed.
                </span>
              </div>
            </div>

            {coverage.gaps.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {coverage.gaps.slice(0, 8).map((gap) => (
                  <div
                    key={gap.id}
                    className="flex items-start gap-3 rounded-lg border p-3.5"
                  >
                    {gap.reason === "blocked" ? (
                      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-score-weak" />
                    ) : (
                      <Radio className="mt-0.5 size-4 shrink-0 text-score-mid" />
                    )}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{gap.title}</span>
                      <span className="text-xs leading-relaxed text-muted-foreground">
                        {gap.detail}
                      </span>
                    </div>
                  </div>
                ))}
                {coverage.gaps.length > 8 ? (
                  <span className="text-xs text-muted-foreground">
                    +{coverage.gaps.length - 8} more gaps — see the Overview
                    coverage card.
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="size-4 text-brand" />
                Full coverage — every area in scope was observed this cycle.
              </p>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-fit print:hidden"
              nativeButton={false}
              render={<Link href={`/projects/${project.id}/overview`} />}
            >
              Resolve gaps from the Overview
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      </section>

      <p className="pb-10 text-center text-xs text-muted-foreground">
        Generated by PlayerScope AI · {reportDate} · All scores from real
        analysed visits — no synthetic data.
      </p>
    </div>
  );
}

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  return (
    <ProjectShell projectId={params.id}>
      {(project) => <ReportContent project={project} />}
    </ProjectShell>
  );
}
