"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Grid3x3, LoaderCircle } from "lucide-react";
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
import {
  backfillFeatures,
  jobsNeedingFeatures,
} from "@/lib/backfill-features";
import { getCoverage } from "@/lib/coverage";
import { buildFeatureMatrix, analysesNeedingFeatureExtract } from "@/lib/features";
import { cn } from "@/lib/utils";
import type { FeatureStatus, Priority, Project } from "@/lib/types";

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

function FeaturesContent({ project }: { project: Project }) {
  const coverage = getCoverage(project);
  const matrix = useMemo(() => buildFeatureMatrix(project), [project]);
  const pendingJobs = useMemo(() => jobsNeedingFeatures(project), [project]);
  const categories = useMemo(
    () => [...new Set(matrix.map((f) => f.category))],
    [matrix]
  );
  const [category, setCategory] = useState<string>("all");
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
            Screenshot-detected features only — each cell is backed by evidence
            from a captured journey, never keyword guessing.{" "}
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
                {rows.map((row) => (
                  <TableRow key={row.feature}>
                    <TableCell className="font-medium">{row.feature}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.category}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "font-medium",
                        row.values[ownBrand.id]
                          ? STATUS_CLASS[row.values[ownBrand.id]!]
                          : "text-muted-foreground/50"
                      )}
                    >
                      {row.values[ownBrand.id]
                        ? STATUS_LABEL[row.values[ownBrand.id]!]
                        : "—"}
                    </TableCell>
                    {competitors.map((c) => {
                      const value = row.values[c.id];
                      return (
                        <TableCell
                          key={c.id}
                          className={
                            value ? STATUS_CLASS[value] : "text-muted-foreground/50"
                          }
                        >
                          {value ? STATUS_LABEL[value] : "—"}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <PriorityBadge priority={row.priority} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
