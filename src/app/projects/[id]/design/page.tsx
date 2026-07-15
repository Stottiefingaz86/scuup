"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowDown,
  Braces,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Contrast,
  LoaderCircle,
  Moon,
  Palette,
  RefreshCw,
  Sun,
  SunMoon,
  ThumbsUp,
  Type,
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AnimatedTabs } from "@/components/animated-tabs";
import { BrandMark } from "@/components/brand-mark";
import { ProjectShell } from "@/components/project-shell";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { ScoreBar } from "@/components/score-bar";
import { ScoreGauge } from "@/components/score-gauge";
import { Verdict } from "@/components/verdict";
import { ANALYSIS_AREA_LABELS } from "@/lib/constants";
import { runDesignReview } from "@/lib/project-store";
import { collectDesignReviewShots } from "@/lib/design-shots";
import type { Brand, DesignReview, Project } from "@/lib/types";

const THEME_META = {
  dark: { label: "Dark mode", icon: Moon },
  light: { label: "Light mode", icon: Sun },
  mixed: { label: "Mixed themes", icon: SunMoon },
} as const;

/** Legible label colour for a swatch chip on top of its own hex. */
function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum =
    0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? "#111111" : "#ffffff";
}

/** 0-1 chroma, used to lead with the brand colours, not the neutrals. */
function saturationOf(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mx = Math.max(r, g, b);
  return mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx;
}

/** The visual centrepiece: designer swatch cards sampled from the live
 * site, brand accents lead, neutrals follow. */
function PaletteSwatches({ palette }: { palette: DesignReview["palette"] }) {
  if (palette.length === 0) return null;
  const ordered = [...palette].sort(
    (a, b) => saturationOf(b.hex) - saturationOf(a.hex)
  );
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {ordered.map((s, i) => {
        const accent = saturationOf(s.hex) >= 0.3;
        return (
          <div
            key={`${s.hex}-${i}`}
            className="flex flex-col overflow-hidden rounded-xl border"
          >
            <div
              className="flex h-20 items-end justify-end p-2"
              style={{ backgroundColor: s.hex }}
            >
              {accent ? (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                  style={{
                    color: s.hex,
                    backgroundColor: textOn(s.hex),
                  }}
                >
                  Brand
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-0.5 px-2.5 py-2">
              <span className="truncate text-xs font-medium" title={s.role}>
                {s.role}
              </span>
              <span className="font-mono text-[10px] uppercase text-muted-foreground">
                {s.hex}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Mood-board strip: one real screen per journey with the design lead's
 * critique underneath, the branding story told visually. */
function JourneyMoodBoard({
  brand,
  design,
}: {
  brand: Brand;
  design: DesignReview;
}) {
  const notesByArea = new Map(
    design.journeyNotes.map((n) => [n.area, n.note])
  );
  const cards =
    design.reviewedScreens && design.reviewedScreens.length > 0
      ? design.reviewedScreens.map((s) => ({
          area: s.area,
          shot: s.screenshot,
          note: notesByArea.get(s.area) ?? "",
        }))
      : collectDesignReviewShots(brand).map((s) => ({
          area: s.area,
          shot: s.screenshot,
          note: notesByArea.get(s.area) ?? "",
        }));

  const visible = cards.filter((c) => c.note || c.shot);
  if (visible.length === 0) return null;
  return (
    <div className="flex w-full min-w-0 gap-3 overflow-x-auto pb-2">
      {visible.map((c) => (
        <div
          key={c.area}
          className="flex w-60 shrink-0 flex-col overflow-hidden rounded-xl border"
        >
          {c.shot ? (
            <ScreenshotLightbox
              src={c.shot}
              alt={`${brand.name}: ${ANALYSIS_AREA_LABELS[c.area] ?? c.area}`}
              caption={`${brand.name}: ${ANALYSIS_AREA_LABELS[c.area] ?? c.area}`}
              className="aspect-[8/5] w-full rounded-none border-0"
            />
          ) : (
            <div className="flex aspect-[8/5] items-center justify-center bg-muted/40 px-3 text-center text-xs text-muted-foreground">
              Login wall only, product screen not captured
            </div>
          )}
          <div className="flex flex-col gap-1 px-3 py-2.5">
            <span className="text-xs font-medium">
              {ANALYSIS_AREA_LABELS[c.area] ?? c.area}
            </span>
            {c.note ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {c.note}
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function A11yRow({
  finding,
}: {
  finding: DesignReview["accessibility"]["findings"][number];
}) {
  const Icon =
    finding.pass === true
      ? CircleCheck
      : finding.pass === false
        ? CircleAlert
        : CircleHelp;
  return (
    <div className="flex items-start gap-2.5">
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          finding.pass === true
            ? "text-emerald-500"
            : finding.pass === false
              ? "text-rose-500"
              : "text-muted-foreground/50"
        )}
      />
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-medium">{finding.check}</span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          {finding.note}
        </span>
      </div>
    </div>
  );
}

function BrandDesign({
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
  const design = brand.design;

  if (!design) {
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        {running ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin text-primary" />
            Opening {brand.name} in a live browser, reading the rendered code
            and reviewing the design… (~1 min)
          </p>
        ) : error ? (
          <>
            <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-score-weak" />
              {error}
            </p>
            <Button size="sm" variant="outline" onClick={onRun}>
              <RefreshCw data-icon="inline-start" />
              Retry
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            The design review runs automatically, this fills in on its own.
          </p>
        )}
      </div>
    );
  }

  const theme = THEME_META[design.theme] ?? THEME_META.mixed;
  const ThemeIcon = theme.icon;
  const own = brand.role === "own_brand";

  return (
    <div className="flex flex-col gap-6">
      {/* Verdict + score */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <ScoreGauge
          score={design.score}
          size={132}
          caption="Design craft"
          muted={!own}
          className="shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <ThemeIcon className="size-3" />
              {theme.label}
            </Badge>
            {design.stack.framework ? (
              <Badge variant="outline" className="gap-1.5">
                <Braces className="size-3" />
                {design.stack.framework}
              </Badge>
            ) : null}
            {design.stack.designSystem ? (
              <Badge variant="outline" className="gap-1.5">
                <Palette className="size-3" />
                {design.stack.designSystem}
              </Badge>
            ) : null}
          </div>
          <Verdict text={design.summary} />
          {design.craft ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">
                Visual craft {design.craft.score}/100
              </span>{" "}
             , {design.craft.note}
            </p>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {design.craft
              ? `Score = 40% visual craft (${design.craft.score}) + 30% consistency (${design.consistency.score}) + 30% accessibility (${design.accessibility.score}) · reviewed `
              : "Reviewed "}
            {new Date(design.fetchedAt).toLocaleDateString(undefined, {
              dateStyle: "medium",
            })}{" "}
            from the live rendered page + captured journey screens
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0"
          onClick={onRun}
          disabled={running}
        >
          {running ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          Refresh
        </Button>
      </div>

      {/* Palette */}
      <div className="flex flex-col gap-2.5">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Palette className="size-4 text-brand" />
          Colour palette
          <span className="text-xs font-normal text-muted-foreground">
           , measured from the live site, accents first
          </span>
        </h3>
        <PaletteSwatches palette={design.palette} />
      </div>

      {/* Journey mood board */}
      {design.journeyNotes.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-2.5">
          <h3 className="text-sm font-medium">
            The design across the core journeys
            <span className="ms-2 text-xs font-normal text-muted-foreground">
             , click a screen to inspect it
            </span>
          </h3>
          <JourneyMoodBoard brand={brand} design={design} />
        </div>
      ) : null}

      {/* Theme + typography + stack */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1.5 rounded-xl border p-4">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ThemeIcon className="size-3.5" />
            {theme.label}
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {design.themeNote}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl border p-4">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Type className="size-3.5" />
            Typography
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {design.typography}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl border p-4">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Braces className="size-3.5" />
            Built with
            {design.stack.health ? (
              <Badge
                variant="outline"
                className={cn(
                  "ms-auto gap-1 text-[10px] capitalize",
                  design.stack.health === "solid" &&
                    "border-emerald-500/40 text-emerald-500",
                  design.stack.health === "mixed" &&
                    "border-amber-500/40 text-amber-500",
                  design.stack.health === "fragile" &&
                    "border-rose-500/40 text-rose-500"
                )}
              >
                {design.stack.health === "solid" ? (
                  <CircleCheck className="size-3" />
                ) : (
                  <CircleAlert className="size-3" />
                )}
                {design.stack.health === "solid"
                  ? "Solid foundation"
                  : design.stack.health === "mixed"
                    ? "Mixed foundation"
                    : "Fragile foundation"}
              </Badge>
            ) : null}
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {[design.stack.framework, design.stack.designSystem]
              .filter(Boolean)
              .join(" · ") || "Stack not detectable from outside"}
          </p>
          {design.stack.verdict ? (
            <p
              className={cn(
                "text-xs leading-relaxed",
                design.stack.health === "solid"
                  ? "text-muted-foreground"
                  : "text-amber-500/90"
              )}
            >
              {design.stack.verdict}
            </p>
          ) : null}
          {design.stack.evidence ? (
            <span className="text-[11px] leading-relaxed text-muted-foreground/60">
              {design.stack.evidence}
            </span>
          ) : null}
        </div>
      </div>

      <Separator />

      {/* Accessibility + consistency */}
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Contrast className="size-4 text-brand" />
              Accessibility
            </h3>
            <span className="font-heading text-sm font-semibold tabular-nums">
              {design.accessibility.score}/100
            </span>
          </div>
          <ScoreBar
            label="Measured on the rendered page"
            score={design.accessibility.score}
            highlight={own}
            muted={!own}
          />
          <div className="flex flex-col gap-2.5">
            {design.accessibility.findings.map((f, i) => (
              <A11yRow key={i} finding={f} />
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">
              Branding consistency across journeys
            </h3>
            <span className="font-heading text-sm font-semibold tabular-nums">
              {design.consistency.score}/100
            </span>
          </div>
          <ScoreBar
            label="Logo, accents, tone and components"
            score={design.consistency.score}
            highlight={own}
            muted={!own}
          />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {design.consistency.note}
          </p>
        </div>
      </div>

      <Separator />

      {/* Strengths / improvements */}
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2.5">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <ThumbsUp className="size-4 text-emerald-500" />
            What the design gets right
          </h3>
          <ul className="flex flex-col gap-2">
            {design.strengths.map((s, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
              >
                <span className="mt-2 size-1 shrink-0 rounded-full bg-emerald-500/70" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex min-w-0 flex-col gap-2.5">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <ArrowDown className="size-4 text-brand" />
            What to improve first
          </h3>
          <ul className="flex flex-col gap-2">
            {design.improvements.map((s, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
              >
                <span className="mt-2 size-1 shrink-0 rounded-full bg-brand/70" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function DesignContent({ project }: { project: Project }) {
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
      await runDesignReview(project.id, brandId);
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        [brandId]: e instanceof Error ? e.message : "Design review failed",
      }));
    } finally {
      setRunning((prev) => {
        const next = new Set(prev);
        next.delete(brandId);
        return next;
      });
    }
  };

  // Reviews run themselves, no buttons. One attempt per brand per visit;
  // failures surface inline with a retry.
  const missing = project.brands.filter(
    (b) => !b.design && !autoTried.current.has(b.id)
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
          <Palette className="size-4 text-brand" />
          <CardTitle>Design Review</CardTitle>
        </div>
        <CardDescription>
          A designer&apos;s critique built from the live rendered code and the
          captured journey screens, what each site is built with, its real
          colour palette, dark-vs-light rationale, accessibility, and whether
          the branding holds up across the core journeys.
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
                {b.design ? (
                  <span className="font-heading text-xs font-semibold tabular-nums text-muted-foreground">
                    {b.design.score}
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
        <BrandDesign
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

export default function DesignPage() {
  const params = useParams<{ id: string }>();
  return (
    <ProjectShell projectId={params.id}>
      {(project) => <DesignContent project={project} />}
    </ProjectShell>
  );
}
