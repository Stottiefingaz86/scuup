"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  Camera,
  ChevronDown,
  Globe,
  Grid3x3,
  KeyRound,
  LoaderCircle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { BrandMark } from "@/components/brand-mark";
import { ProjectShell } from "@/components/project-shell";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import {
  backfillFeatures,
  jobsNeedingFeatures,
} from "@/lib/backfill-features";
import { ANALYSIS_AREA_LABELS } from "@/lib/constants";
import { getCoverage } from "@/lib/coverage";
import { buildFeatureMatrix, analysesNeedingFeatureExtract } from "@/lib/features";
import { cn } from "@/lib/utils";
import type {
  Brand,
  FeatureCellEvidence,
  FeatureMatrixRow,
  FeatureStatus,
  Priority,
  Project,
} from "@/lib/types";

const STATUS_LABEL: Record<FeatureStatus, string> = {
  strong: "Strong",
  medium: "Medium",
  weak: "Weak",
  partial: "Partial",
  yes: "Yes",
  no: "No",
  hidden: "Hidden",
  promo_led: "Promo-led",
};

const STATUS_CLASS: Record<FeatureStatus, string> = {
  strong: "text-score-strong",
  yes: "text-score-strong",
  medium: "text-score-mid",
  partial: "text-score-mid",
  promo_led: "text-score-mid",
  weak: "text-score-weak",
  no: "text-score-weak",
  hidden: "text-score-weak",
};

const PRIORITY_ORDER: Priority[] = ["critical", "high", "medium", "low"];

function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "critical")
    return <Badge variant="destructive">Critical</Badge>;
  if (priority === "high") return <Badge>High</Badge>;
  if (priority === "medium") return <Badge variant="secondary">Medium</Badge>;
  return <Badge variant="outline">Low</Badge>;
}

/** Where the proof came from: public page or behind a login. */
function ContextBadge({ loggedIn }: { loggedIn: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        loggedIn
          ? "border-primary/30 text-primary"
          : "border-border text-muted-foreground"
      )}
    >
      {loggedIn ? <KeyRound className="size-2.5" /> : <Globe className="size-2.5" />}
      {loggedIn ? "Logged in" : "Logged out"}
    </span>
  );
}

/** The proof strip under an expanded feature row: one card per brand with
 * the screenshot the vision model based the status on. */
function EvidenceStrip({
  row,
  brands,
}: {
  row: FeatureMatrixRow;
  brands: Brand[];
}) {
  const withEvidence = brands
    .map((b) => ({ brand: b, ev: row.evidence[b.id] }))
    .filter((x): x is { brand: Brand; ev: FeatureCellEvidence } => x.ev != null);

  if (withEvidence.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        No stored evidence for this feature — re-run the journeys to capture
        fresh screenshots.
      </p>
    );
  }

  return (
    <div className="grid gap-3 py-1 sm:grid-cols-2 xl:grid-cols-4">
      {withEvidence.map(({ brand, ev }) => (
        <div
          key={brand.id}
          className="flex flex-col gap-2 rounded-lg border bg-background/40 p-3"
        >
          <div className="flex items-center gap-2">
            <BrandMark brand={brand} className="size-4" />
            <span className="truncate text-xs font-medium">
              {brand.name}
              {brand.role === "own_brand" ? " (you)" : ""}
            </span>
            <span
              className={cn(
                "ms-auto text-xs font-medium",
                STATUS_CLASS[ev.status]
              )}
            >
              {STATUS_LABEL[ev.status]}
            </span>
          </div>
          {ev.screenshot ? (
            <ScreenshotLightbox
              src={ev.screenshot}
              alt={`${brand.name} — ${row.feature} evidence`}
              className="h-28 w-full"
            />
          ) : (
            <div className="flex h-28 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground/60">
              No screenshot saved for this detection
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <ContextBadge loggedIn={ev.loggedIn} />
            <span className="text-[11px] text-muted-foreground">
              {ANALYSIS_AREA_LABELS[ev.area] ?? ev.area}
            </span>
          </div>
          {ev.note ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {ev.note}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function FeaturesContent({ project }: { project: Project }) {
  const coverage = getCoverage(project);
  const matrix = useMemo(() => buildFeatureMatrix(project), [project]);
  const pendingJobs = useMemo(() => jobsNeedingFeatures(project), [project]);
  const categories = useMemo(
    () => [...new Set(matrix.map((f) => f.category))],
    [matrix]
  );
  const [category, setCategory] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillLabel, setBackfillLabel] = useState("");
  const backfillKey = useRef<string | null>(null);

  useEffect(() => {
    if (pendingJobs.length === 0) return;
    const key = `${project.id}:${pendingJobs.map((j) => `${j.brandId}:${j.area}`).join(",")}`;
    if (backfillKey.current === key) return;
    backfillKey.current = key;

    let cancelled = false;
    setBackfilling(true);
    setBackfillLabel(`Starting… (0/${pendingJobs.length})`);
    void backfillFeatures(project.id, project, (done, total, label) => {
      if (!cancelled) setBackfillLabel(`${label} (${done}/${total})`);
    }).finally(() => {
      if (!cancelled) setBackfilling(false);
    });
    return () => {
      cancelled = true;
    };
  }, [project, pendingJobs]);

  const rows = useMemo(() => {
    const filtered =
      category === "all"
        ? matrix
        : matrix.filter((f) => f.category === category);
    return [...filtered].sort(
      (a, b) =>
        PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
    );
  }, [matrix, category]);

  const ownBrand = project.brands.find((b) => b.role === "own_brand")!;
  const competitors = project.brands.filter((b) => b.role === "competitor");

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3x3 className="size-4 text-brand" />
            Feature matrix
          </CardTitle>
          <CardDescription>
            A deep dive, not a score pillar — this matrix shows what each
            brand ships so you can see the gaps, but it never moves the
            Player CX Score. Screenshot-detected features only — click a row
            to see the proof.
            Most cells come from public (logged-out) visits; a &quot;—&quot;
            means not seen in captured screenshots, so it may still exist
            behind login.{" "}
            {backfilling
              ? `Extracting from saved screenshots… ${backfillLabel}`
              : matrix.length > 0
                ? `${matrix.length} feature${matrix.length === 1 ? "" : "s"} detected.`
                : pendingJobs.length > 0
                  ? `Scanning ${pendingJobs.length} captured journey${pendingJobs.length === 1 ? "" : "s"}…`
                  : "No screenshot evidence available yet."}
          </CardDescription>
          {matrix.length > 0 ? (
            <ToggleGroup
              value={[category]}
              onValueChange={(value) => {
                const next = (value as string[])[0];
                if (next) setCategory(next);
              }}
              variant="outline"
              size="sm"
              className="mt-2 flex-wrap"
            >
              <ToggleGroupItem value="all">All</ToggleGroupItem>
              {categories.map((c) => (
                <ToggleGroupItem key={c} value={c}>
                  {c}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {backfilling ? (
            <div className="flex items-center gap-3 rounded-xl border border-dashed p-6">
              <LoaderCircle className="size-5 shrink-0 animate-spin text-primary" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                Reading features from your existing screenshot evidence — no
                need to re-visit sites. {backfillLabel}
              </p>
            </div>
          ) : null}
          {!backfilling && matrix.length === 0 ? (
            <div className="flex items-start gap-4 rounded-xl border border-dashed p-6">
              <div className="flex flex-col gap-2">
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {pendingJobs.length > 0
                    ? "Feature extraction failed or returned no visible features. Try re-running the agent on casino and loyalty journeys."
                    : analysesNeedingFeatureExtract(project) > 0
                      ? "Analyses exist but have no saved screenshots — re-run the agent to capture evidence."
                      : "Run the agent on casino, landing and loyalty to build the matrix. Journey coverage is " +
                        `${coverage.pct}%.`}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  nativeButton={false}
                  render={<Link href={`/projects/${project.id}/journeys`} />}
                >
                  Go to journeys
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
            </div>
          ) : null}
          {!backfilling && matrix.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>{ownBrand.name} (you)</TableHead>
                  {competitors.map((c) => (
                    <TableHead key={c.id}>{c.name}</TableHead>
                  ))}
                  <TableHead>Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const isOpen = expanded === row.feature;
                  const hasShots = Object.values(row.evidence).some(
                    (ev) => ev?.screenshot
                  );
                  const loggedInOnly = Object.values(row.evidence).every(
                    (ev) => !ev || ev.loggedIn
                  );
                  const cellFor = (brandId: string) => {
                    const value = row.values[brandId];
                    const ev = row.evidence[brandId];
                    if (!value)
                      return <span className="text-muted-foreground/50">—</span>;
                    return (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 font-medium",
                          STATUS_CLASS[value]
                        )}
                      >
                        {STATUS_LABEL[value]}
                        {ev?.screenshot ? (
                          <Camera className="size-3 opacity-50" />
                        ) : null}
                      </span>
                    );
                  };
                  return (
                    <React.Fragment key={row.feature}>
                      <TableRow
                        onClick={() =>
                          setExpanded(isOpen ? null : row.feature)
                        }
                        className={cn("cursor-pointer", isOpen && "bg-accent/40")}
                      >
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <ChevronDown
                              className={cn(
                                "size-3.5 text-muted-foreground/50 transition-transform",
                                isOpen && "rotate-180"
                              )}
                            />
                            {row.feature}
                            {loggedInOnly && Object.values(row.evidence).some(Boolean) ? (
                              <KeyRound
                                className="size-3 text-primary/70"
                                aria-label="Seen in logged-in sessions only"
                              />
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.category}
                        </TableCell>
                        <TableCell>{cellFor(ownBrand.id)}</TableCell>
                        {competitors.map((c) => (
                          <TableCell key={c.id}>{cellFor(c.id)}</TableCell>
                        ))}
                        <TableCell>
                          <PriorityBadge priority={row.priority} />
                        </TableCell>
                      </TableRow>
                      {isOpen ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={4 + competitors.length}>
                            <EvidenceStrip row={row} brands={project.brands} />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}
          {!backfilling && matrix.length > 0 ? (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Camera className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <Camera className="me-0.5 inline size-3 opacity-50" /> = a
                screenshot proves this cell — click the row to see it.
                &quot;—&quot; = not seen on the pages we captured (usually
                logged out); it may exist behind login. Run deposit, withdraw
                and account journeys with a saved test account to extend
                coverage.
              </span>
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {project.brands.map((b) => {
              const analysed = Object.values(b.analyses).filter(
                (a) => !a.blocked
              ).length;
              const features = matrix.filter(
                (row) => row.values[b.id] != null
              ).length;
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-xl border p-4"
                >
                  <BrandMark brand={b} className="size-8" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {b.name}
                      {b.role === "own_brand" ? " (you)" : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {features} feature{features === 1 ? "" : "s"} ·{" "}
                      {analysed} area{analysed === 1 ? "" : "s"} captured
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function FeaturesPage() {
  const params = useParams<{ id: string }>();
  return (
    <ProjectShell projectId={params.id}>
      {(project) => <FeaturesContent project={project} />}
    </ProjectShell>
  );
}
