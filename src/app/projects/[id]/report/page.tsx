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
  Star,
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
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { ScoreChip, TierLegend } from "@/components/score-chip";
import { ScoreGauge } from "@/components/score-gauge";
import { ANALYSIS_AREA_LABELS } from "@/lib/constants";
import { getCoverage, projectAreas } from "@/lib/coverage";
import { buildFeatureMatrix } from "@/lib/features";
import {
  areaScore,
  overallScore,
  toObservation,
  type Brand,
  type FeatureStatus,
  type Project,
} from "@/lib/types";

const SECTIONS = [
  { id: "summary", title: "Executive summary" },
  { id: "ranking", title: "Competitor ranking" },
  { id: "findings", title: "Findings by area" },
  { id: "features", title: "Feature matrix" },
  { id: "voc", title: "Voice of customer" },
  { id: "design", title: "Design review" },
  { id: "action-plan", title: "Action plan" },
  { id: "coverage", title: "Data coverage & next steps" },
];

const FEATURE_STATUS_LABEL: Record<FeatureStatus, string> = {
  strong: "Strong",
  yes: "Yes",
  medium: "Medium",
  partial: "Partial",
  promo_led: "Promo-led",
  weak: "Weak",
  hidden: "Hidden",
  no: "No",
};

const FEATURE_STATUS_CLASS: Record<FeatureStatus, string> = {
  strong: "text-score-strong",
  yes: "text-score-strong",
  medium: "text-score-mid",
  partial: "text-score-mid",
  promo_led: "text-score-mid",
  weak: "text-score-weak",
  no: "text-score-weak",
  hidden: "text-score-weak",
};

/** How many matrix rows the printed report shows before deferring to the
 * app — priority order means the gaps that matter always make the cut. */
const REPORT_FEATURE_ROWS = 25;

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

  const featureRows = buildFeatureMatrix(project);

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
          description="Overall score is the average of four pillars: journey scores, the retention read, voice of customer (Trustpilot, rescaled to 100), and the design review. N/A means not observed — never estimated."
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
                  <TableHead className="text-center">
                    Voice of customer
                  </TableHead>
                  <TableHead className="text-center">Design</TableHead>
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
                    <TableCell className="text-center">
                      <ScoreChip
                        score={
                          brand.voc?.trustScore != null
                            ? Math.round(brand.voc.trustScore * 20)
                            : null
                        }
                        muted={brand.role !== "own_brand"}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <ScoreChip
                        score={brand.design?.score ?? null}
                        muted={brand.role !== "own_brand"}
                      />
                    </TableCell>
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
                        {!analysis.blocked &&
                        (analysis.screenshots?.length ?? 0) > 0 ? (
                          <div className="flex flex-col gap-1.5 border-t pt-3">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              Evidence — {analysis.screenshots!.length} screen
                              {analysis.screenshots!.length === 1
                                ? ""
                                : "s"}{" "}
                              captured on this visit
                            </span>
                            <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1">
                              {analysis.screenshots!.map((src, i) => (
                                <ScreenshotLightbox
                                  key={`${src}-${i}`}
                                  src={src}
                                  alt={`${brand.name} — ${ANALYSIS_AREA_LABELS[area] ?? area}, captured screen ${i + 1}`}
                                  caption={`${brand.name} — ${ANALYSIS_AREA_LABELS[area] ?? area} · screen ${i + 1} of ${analysis.screenshots!.length}, captured ${new Date(analysis.analysedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}`}
                                  className="aspect-[8/5] w-24 shrink-0"
                                />
                              ))}
                            </div>
                          </div>
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

      {/* 04 — Feature matrix */}
      {featureRows.length > 0 ? (
        <section id="features" className="flex flex-col gap-6">
          <SectionHeading
            index={4}
            title="Feature matrix"
            description="Every feature the analyst saw on screen, side by side. Each cell is backed by a screenshot in the app — nothing here is inferred from marketing pages."
          />
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    {project.brands.map((brand) => (
                      <TableHead key={brand.id} className="text-center">
                        <span className="inline-flex items-center gap-1.5">
                          <BrandMark brand={brand} className="size-4" />
                          {brand.name}
                          {brand.role === "own_brand" ? (
                            <span className="text-[10px] text-brand">(you)</span>
                          ) : null}
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="text-end">Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {featureRows.slice(0, REPORT_FEATURE_ROWS).map((row) => (
                    <TableRow key={row.feature}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{row.feature}</span>
                          <span className="text-xs text-muted-foreground">
                            {row.category}
                          </span>
                        </div>
                      </TableCell>
                      {project.brands.map((brand) => {
                        const status = row.values[brand.id] ?? null;
                        return (
                          <TableCell key={brand.id} className="text-center">
                            {status ? (
                              <span
                                className={cn(
                                  "text-sm font-medium",
                                  FEATURE_STATUS_CLASS[status]
                                )}
                              >
                                {FEATURE_STATUS_LABEL[status]}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground/60">
                                —
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-end">
                        <Badge
                          variant={
                            row.priority === "critical"
                              ? "destructive"
                              : row.priority === "high"
                                ? "default"
                                : row.priority === "medium"
                                  ? "secondary"
                                  : "outline"
                          }
                        >
                          {row.priority}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {featureRows.length > REPORT_FEATURE_ROWS ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Showing the {REPORT_FEATURE_ROWS} highest-priority features of{" "}
                  {featureRows.length} detected — the full matrix with
                  screenshot evidence lives in the Features tab.
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  A dash means the feature was never observed for that brand —
                  it may exist behind a login the agent couldn&apos;t reach.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* 05 — Voice of customer */}
      {project.brands.some((b) => b.voc) ? (
        <section id="voc" className="flex flex-col gap-6">
          <SectionHeading
            index={5}
            title="Voice of customer"
            description="What real players say in public reviews — and where that confirms or contradicts what we measured on the site."
          />
          {project.brands
            .filter((b) => b.voc)
            .map((brand) => {
              const voc = brand.voc!;
              const total =
                voc.ratingSplit.positive +
                voc.ratingSplit.neutral +
                voc.ratingSplit.negative;
              return (
                <Card key={brand.id}>
                  <CardContent className="flex flex-col gap-4 py-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <BrandLabel brand={brand} />
                      <span className="inline-flex items-center gap-1 font-heading text-base font-semibold">
                        <Star className="size-4 fill-amber-400 text-amber-400" />
                        {voc.trustScore?.toFixed(1) ?? "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {voc.sampled} recent of{" "}
                        {voc.totalReviews?.toLocaleString() ?? "?"} reviews ·{" "}
                        {total > 0
                          ? `${Math.round((voc.ratingSplit.positive / total) * 100)}% positive`
                          : ""}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {voc.summary}
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium uppercase tracking-wide text-emerald-500">
                          Customers praise
                        </span>
                        <ul className="flex flex-col gap-1">
                          {voc.positives.slice(0, 3).map((t) => (
                            <li
                              key={t.theme}
                              className="text-xs leading-relaxed text-muted-foreground"
                            >
                              {t.theme}{" "}
                              <span className="text-muted-foreground/50">
                                ({t.mentions})
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium uppercase tracking-wide text-rose-500">
                          Needs attention
                        </span>
                        <ul className="flex flex-col gap-1">
                          {voc.negatives.slice(0, 3).map((t) => (
                            <li
                              key={t.theme}
                              className="text-xs leading-relaxed text-muted-foreground"
                            >
                              {t.theme}{" "}
                              <span className="text-muted-foreground/50">
                                ({t.mentions})
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    {voc.alignment.length > 0 ? (
                      <ul className="flex flex-col gap-1.5 border-t pt-3">
                        {voc.alignment.slice(0, 3).map((a, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
                          >
                            <span
                              className={cn(
                                "mt-1.5 size-1 shrink-0 rounded-full",
                                a.verdict === "confirms"
                                  ? "bg-emerald-500"
                                  : a.verdict === "contradicts"
                                    ? "bg-rose-500"
                                    : "bg-amber-500"
                              )}
                            />
                            {a.note}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
        </section>
      ) : null}

      {/* 06 — Design review */}
      {project.brands.some((b) => b.design) ? (
        <section id="design" className="flex flex-col gap-6">
          <SectionHeading
            index={6}
            title="Design review"
            description="What each site is built with, its real colour palette, and whether the design craft holds up — measured from the live rendered code."
          />
          {project.brands
            .filter((b) => b.design)
            .map((brand) => {
              const design = brand.design!;
              return (
                <Card key={brand.id}>
                  <CardContent className="flex flex-col gap-4 py-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <BrandLabel brand={brand} />
                      <span className="font-heading text-base font-semibold tabular-nums">
                        {design.score}/100
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {[
                          design.theme === "dark"
                            ? "Dark mode"
                            : design.theme === "light"
                              ? "Light mode"
                              : "Mixed themes",
                          design.stack.framework,
                          design.stack.designSystem,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                    <div className="flex h-8 w-full max-w-md overflow-hidden rounded-md border">
                      {design.palette.map((s, i) => (
                        <div
                          key={`${s.hex}-${i}`}
                          className="min-w-0 flex-1"
                          style={{ backgroundColor: s.hex }}
                          title={`${s.role} — ${s.hex}`}
                        />
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {design.summary}
                    </p>
                    {design.stack.verdict &&
                    design.stack.health &&
                    design.stack.health !== "solid" ? (
                      <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-600 dark:text-amber-500/90">
                        {design.stack.health === "mixed"
                          ? "Mixed foundation — "
                          : "Fragile foundation — "}
                        {design.stack.verdict}
                      </p>
                    ) : null}
                    <div className="grid gap-x-6 gap-y-1 text-xs leading-relaxed text-muted-foreground md:grid-cols-2">
                      <span>
                        Accessibility {design.accessibility.score}/100 —{" "}
                        {design.accessibility.findings.find((f) => f.pass === false)
                          ?.note ?? "no measured failures"}
                      </span>
                      <span>
                        Consistency {design.consistency.score}/100 —{" "}
                        {design.consistency.note}
                      </span>
                    </div>
                    {design.improvements.length > 0 ? (
                      <ul className="flex flex-col gap-1.5 border-t pt-3">
                        {design.improvements.slice(0, 3).map((s, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
                          >
                            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand/60" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
        </section>
      ) : null}

      {/* 07 — Action plan */}
      <section id="action-plan" className="flex flex-col gap-6">
        <SectionHeading
          index={7}
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

      {/* 08 — Coverage */}
      <section id="coverage" className="flex flex-col gap-6">
        <SectionHeading
          index={8}
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
        Generated by Scuup · {reportDate} · All scores from real
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
