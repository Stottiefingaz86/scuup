"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  ExternalLink,
  LoaderCircle,
  MessagesSquare,
  RefreshCw,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AnimatedTabs } from "@/components/animated-tabs";
import { BrandMark } from "@/components/brand-mark";
import { ProjectShell } from "@/components/project-shell";
import { Verdict } from "@/components/verdict";
import { ANALYSIS_AREA_LABELS } from "@/lib/constants";
import { runVoc } from "@/lib/project-store";
import type {
  Brand,
  Project,
  VocAnalysis,
  VocTheme,
} from "@/lib/types";

/** Where an alignment row links to inside the report. */
function areaHref(projectId: string, area: string): string {
  if (area === "features") return `/projects/${projectId}/features`;
  if (area === "retention" || area === "loyalty_rewards")
    return `/projects/${projectId}/retention`;
  return `/projects/${projectId}/journeys`;
}

function areaLabel(area: string): string {
  if (area === "features") return "Features";
  if (area === "retention") return "Retention";
  return ANALYSIS_AREA_LABELS[area] ?? area;
}

const VERDICT_STYLE: Record<
  string,
  { label: string; className: string; icon: typeof CircleCheck }
> = {
  confirms: {
    label: "Confirms our score",
    className: "bg-emerald-500/15 text-emerald-500",
    icon: CircleCheck,
  },
  contradicts: {
    label: "Contradicts our score",
    className: "bg-rose-500/15 text-rose-500",
    icon: CircleAlert,
  },
  gap: {
    label: "Beyond what we can see",
    className: "bg-amber-500/15 text-amber-500",
    icon: CircleHelp,
  },
};

/** Green / grey / red proportional bar of sampled review ratings. */
function SentimentBar({ split }: { split: VocAnalysis["ratingSplit"] }) {
  const total = split.positive + split.neutral + split.negative;
  if (total === 0) return null;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="bg-emerald-500/80"
          style={{ width: pct(split.positive) }}
        />
        <div
          className="bg-muted-foreground/30"
          style={{ width: pct(split.neutral) }}
        />
        <div className="bg-rose-500/80" style={{ width: pct(split.negative) }} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-emerald-500">
            {split.positive}
          </span>{" "}
          positive (4–5★)
        </span>
        <span>
          <span className="font-medium text-foreground/70">
            {split.neutral}
          </span>{" "}
          neutral (3★)
        </span>
        <span>
          <span className="font-medium text-rose-500">{split.negative}</span>{" "}
          negative (1–2★)
        </span>
      </div>
    </div>
  );
}

function ThemeList({
  themes,
  tone,
}: {
  themes: VocTheme[];
  tone: "positive" | "negative";
}) {
  if (themes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No recurring {tone === "positive" ? "praise" : "complaints"} in the
        sampled reviews.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {themes.map((t) => (
        <div
          key={t.theme}
          className="flex flex-col gap-2 rounded-lg border bg-background/40 p-3.5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{t.theme}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                tone === "positive"
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "bg-rose-500/15 text-rose-500"
              )}
            >
              {t.mentions} mention{t.mentions === 1 ? "" : "s"}
            </span>
            {t.area ? (
              <span className="rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {areaLabel(t.area)}
              </span>
            ) : null}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t.insight}
          </p>
          {t.quotes.map((q, i) => (
            <blockquote
              key={i}
              className="border-s-2 border-border ps-3 text-xs italic leading-relaxed text-muted-foreground/90"
            >
              “{q.text}”
              <span className="ms-2 not-italic text-muted-foreground/60">
                {q.rating}★
                {q.date ? ` · ${new Date(q.date).toLocaleDateString(undefined, { dateStyle: "medium" })}` : ""}
              </span>
            </blockquote>
          ))}
        </div>
      ))}
    </div>
  );
}

function BrandVoc({
  project,
  brand,
  running,
  error,
  onRun,
}: {
  project: Project;
  brand: Brand;
  running: boolean;
  error: string | null;
  onRun: () => void;
}) {
  const voc = brand.voc;

  if (!voc) {
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        {running ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin text-primary" />
            Reading {brand.name}&apos;s recent Trustpilot reviews and comparing
            them with the audit… this takes about a minute.
          </p>
        ) : error ? (
          <>
            <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-score-weak" />
              {error}
            </p>
            <Button size="sm" variant="outline" onClick={onRun}>
              <RefreshCw data-icon="inline-start" />
              Try again
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No review analysis yet — it starts automatically.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 duration-300 animate-in fade-in-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-5">
          <div className="flex flex-col items-center gap-0.5">
            <span className="flex items-center gap-1.5 font-heading text-3xl font-semibold">
              <Star className="size-5 fill-amber-400 text-amber-400" />
              {voc.trustScore?.toFixed(1) ?? "—"}
            </span>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              TrustScore
            </span>
          </div>
          <div className="flex min-w-0 max-w-2xl flex-col gap-1.5">
            <Verdict text={voc.summary} />
            <span className="text-xs text-muted-foreground">
              {voc.sampled} most recent of{" "}
              {voc.totalReviews?.toLocaleString() ?? "?"} reviews ·{" "}
              <a
                href={voc.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-border underline-offset-2 hover:text-foreground"
              >
                Trustpilot
              </a>{" "}
              · fetched{" "}
              {new Date(voc.fetchedAt).toLocaleDateString(undefined, {
                dateStyle: "medium",
              })}
            </span>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onRun} disabled={running}>
          {running ? (
            <LoaderCircle
              data-icon="inline-start"
              className="animate-spin"
            />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          Refresh
        </Button>
      </div>

      <SentimentBar split={voc.ratingSplit} />

      <Separator />

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <ThumbsUp className="size-4 text-emerald-500" />
            What customers praise
          </h3>
          <ThemeList themes={voc.positives} tone="positive" />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <ThumbsDown className="size-4 text-rose-500" />
            What needs attention
          </h3>
          <ThemeList themes={voc.negatives} tone="negative" />
        </div>
      </div>

      {voc.alignment.length > 0 ? (
        <>
          <Separator />
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-medium">Reviews vs our audit</h3>
              <span className="text-[11px] text-muted-foreground/70">
                Where what customers say confirms, contradicts or extends what
                the agent measured on the site.
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {voc.alignment.map((a, i) => {
                const style = VERDICT_STYLE[a.verdict] ?? VERDICT_STYLE.gap;
                const Icon = style.icon;
                return (
                  <div
                    key={i}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-lg border bg-background/40 p-3"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                            style.className
                          )}
                        >
                          <Icon className="size-3" />
                          {style.label}
                        </span>
                        <span className="text-xs font-medium">
                          {areaLabel(a.area)}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {a.note}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0"
                      nativeButton={false}
                      render={<Link href={areaHref(project.id, a.area)} />}
                    >
                      <ExternalLink data-icon="inline-start" />
                      View
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function VocContent({ project }: { project: Project }) {
  const ownBrand = project.brands.find((b) => b.role === "own_brand")!;
  const [tabBrand, setTabBrand] = useState<string>(ownBrand.id);
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const autoTried = useRef<Set<string>>(new Set());

  const brand = project.brands.find((b) => b.id === tabBrand) ?? ownBrand;

  const run = async (brandId: string) => {
    setRunning((prev) => new Set(prev).add(brandId));
    setErrors((prev) => ({ ...prev, [brandId]: "" }));
    try {
      await runVoc(project.id, brandId);
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        [brandId]: e instanceof Error ? e.message : "Review analysis failed",
      }));
    } finally {
      setRunning((prev) => {
        const next = new Set(prev);
        next.delete(brandId);
        return next;
      });
    }
  };

  // Reviews load themselves — no buttons to click. One attempt per brand
  // per visit; failures surface inline with a retry.
  const missing = project.brands.filter(
    (b) => !b.voc && !autoTried.current.has(b.id)
  );
  useEffect(() => {
    if (project.status === "archived" || missing.length === 0) return;
    for (const b of missing) autoTried.current.add(b.id);
    void (async () => {
      for (const b of missing) {
        await run(b.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the missing set
  }, [missing.map((b) => b.id).join(",")]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessagesSquare className="size-4 text-brand" />
          <CardTitle>Voice of Customer</CardTitle>
        </div>
        <CardDescription>
          What real players say in public reviews — split into praise and
          problems, each theme backed by verbatim quotes, and cross-checked
          against what the agent measured on the site.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <AnimatedTabs
          tabs={project.brands.map((b) => ({
            value: b.id,
            label: (
              <span className="inline-flex items-center gap-1.5">
                <BrandMark brand={b} className="size-4" />
                {b.role === "own_brand" ? `${b.name} (you)` : b.name}
                {b.voc?.trustScore != null ? (
                  <span className="inline-flex items-center gap-0.5 font-heading text-xs font-semibold tabular-nums text-amber-400">
                    <Star className="size-3 fill-amber-400" />
                    {b.voc.trustScore.toFixed(1)}
                  </span>
                ) : running.has(b.id) ? (
                  <LoaderCircle className="size-3 animate-spin text-primary" />
                ) : null}
              </span>
            ),
          }))}
          value={tabBrand}
          onValueChange={setTabBrand}
        />
        <BrandVoc
          key={brand.id}
          project={project}
          brand={brand}
          running={running.has(brand.id)}
          error={errors[brand.id] || null}
          onRun={() => void run(brand.id)}
        />
      </CardContent>
    </Card>
  );
}

export default function VocPage() {
  const params = useParams<{ id: string }>();
  return (
    <ProjectShell projectId={params.id}>
      {(project) => <VocContent project={project} />}
    </ProjectShell>
  );
}
