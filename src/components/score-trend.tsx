"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrendPoint } from "@/lib/use-trends";

/** Inline sparkline of a score's run history. */
function TrendSparkline({
  points,
  className,
}: {
  points: TrendPoint[];
  className?: string;
}) {
  const w = 72;
  const h = 20;
  const scores = points.map((p) => p.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = Math.max(max - min, 6); // flat lines still render mid-height
  const mid = (min + max) / 2;
  const x = (i: number) =>
    points.length === 1 ? w / 2 : (i / (points.length - 1)) * (w - 4) + 2;
  const y = (s: number) => h - 3 - ((s - (mid - span / 2)) / span) * (h - 6);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1]!;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-70"
      />
      <circle
        cx={x(points.length - 1)}
        cy={y(last.score)}
        r={2}
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Score movement since the previous run: sparkline + signed delta. Renders
 * nothing until a report has at least two runs of history — first-cycle
 * reports have no trend to show yet.
 */
export function ScoreTrend({
  points,
  className,
}: {
  points: TrendPoint[] | undefined;
  className?: string;
}) {
  if (!points || points.length < 2) return null;
  const delta =
    points[points.length - 1]!.score - points[points.length - 2]!.score;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const tone =
    delta > 0
      ? "text-score-strong"
      : delta < 0
        ? "text-score-weak"
        : "text-muted-foreground";
  const since = new Date(
    points[points.length - 2]!.analysedAt
  ).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <span
      title={`${points.length} runs tracked · previous run ${since}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2 py-1",
        className
      )}
    >
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium tabular-nums", tone)}>
        <Icon className="size-3.5" />
        {delta > 0 ? `+${delta}` : delta === 0 ? "±0" : delta}
      </span>
      <TrendSparkline points={points.slice(-8)} className={tone} />
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        vs last run
      </span>
    </span>
  );
}
