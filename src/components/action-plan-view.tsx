"use client";

import { Flame, Hammer, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ANALYSIS_AREA_LABELS } from "@/lib/constants";
import type {
  ActionPlan,
  Recommendation,
  RecommendationLevel,
  RecommendationType,
} from "@/lib/types";

const GROUPS: {
  type: RecommendationType;
  title: string;
  description: string;
  icon: typeof Flame;
  /** Accent used in the matrix chips and phase markers. */
  color: string;
}[] = [
  {
    type: "fix_now",
    title: "Fix now",
    description: "Low/medium effort, high impact. Ship these this quarter.",
    icon: Flame,
    color: "var(--brand)",
  },
  {
    type: "improve_next",
    title: "Improve next",
    description:
      "Requires product, design and dev effort. Plan into the roadmap.",
    icon: Hammer,
    color: "var(--chart-4)",
  },
  {
    type: "strategic_bet",
    title: "Strategic bets",
    description: "Bigger directional opportunities. Executive decisions.",
    icon: Rocket,
    color: "var(--chart-2)",
  },
];

const GROUP_COLOR: Record<RecommendationType, string> = Object.fromEntries(
  GROUPS.map((g) => [g.type, g.color])
) as Record<RecommendationType, string>;

function LevelDots({
  label,
  level,
  invert = false,
}: {
  label: string;
  level: RecommendationLevel;
  /** For effort, low is good — fill dots by cost, not by merit. */
  invert?: boolean;
}) {
  const filled = level === "high" ? 3 : level === "medium" ? 2 : 1;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <span className="flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "size-1.5 rounded-full",
              i < filled
                ? invert
                  ? "bg-foreground/55"
                  : "bg-brand"
                : "bg-muted"
            )}
          />
        ))}
      </span>
      <span className="capitalize">{level}</span>
    </span>
  );
}

/** Number chip shared by the matrix and the phase lists. */
function ActionChip({
  index,
  type,
  size = "sm",
}: {
  index: number;
  type: RecommendationType;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-heading font-semibold",
        size === "sm" ? "size-6 text-[11px]" : "size-7 text-xs"
      )}
      style={{
        background: `color-mix(in oklch, ${GROUP_COLOR[type]} 18%, transparent)`,
        color: GROUP_COLOR[type],
      }}
    >
      {index}
    </span>
  );
}

const LEVELS: RecommendationLevel[] = ["low", "medium", "high"];

function PriorityMatrix({
  recs,
  indexById,
}: {
  recs: Recommendation[];
  indexById: Record<string, number>;
}) {
  // Rows: impact high → low. Columns: effort low → high.
  const impactRows: RecommendationLevel[] = ["high", "medium", "low"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prioritisation matrix</CardTitle>
        <CardDescription>
          Impact vs effort for every action. Top-left is the quick-win zone —
          numbers match the lists below.
        </CardDescription>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5">
          {GROUPS.map((g) => (
            <span
              key={g.type}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="size-2 rounded-full"
                style={{ background: g.color }}
              />
              {g.title}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-1.5">
          {impactRows.map((impact, rowIndex) => (
            <div key={impact} className="contents">
              <div className="flex items-center pe-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground [writing-mode:sideways-lr]">
                  {impact} impact
                </span>
              </div>
              {LEVELS.map((effort) => {
                const cell = recs.filter(
                  (r) => r.impact === impact && r.effort === effort
                );
                const quickWin = impact === "high" && effort === "low";
                return (
                  <div
                    key={effort}
                    className={cn(
                      "relative flex min-h-20 flex-wrap content-start items-start gap-1.5 rounded-lg border p-2.5",
                      quickWin
                        ? "border-brand/40 bg-brand/[0.06]"
                        : "bg-card/40"
                    )}
                  >
                    {quickWin ? (
                      <span className="absolute right-2 top-1.5 text-[9px] font-medium uppercase tracking-wider text-brand/80">
                        Quick wins
                      </span>
                    ) : null}
                    {rowIndex === 0 && effort === "high" ? (
                      <span className="absolute right-2 bottom-1.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
                        Big bets
                      </span>
                    ) : null}
                    {cell.map((r) => (
                      <ActionChip
                        key={r.id}
                        index={indexById[r.id]}
                        type={r.type}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
          <div />
          {LEVELS.map((effort) => (
            <div
              key={effort}
              className="pt-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              {effort} effort
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActionRow({ rec, index }: { rec: Recommendation; index: number }) {
  return (
    <div className="flex gap-3.5 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20">
      <ActionChip index={index} type={rec.type} size="md" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-heading text-sm font-semibold">{rec.title}</h3>
          <Badge variant="outline" className="text-[10px]">
            {rec.area === "cross_journey"
              ? "Cross-journey"
              : (ANALYSIS_AREA_LABELS[rec.area] ?? rec.area)}
          </Badge>
          <span className="ms-auto text-xs text-muted-foreground">
            {rec.owner}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {rec.description}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-0.5">
          <LevelDots label="Impact" level={rec.impact} />
          <LevelDots label="Effort" level={rec.effort} invert />
          <span className="text-xs text-muted-foreground">
            Confidence{" "}
            <span className="capitalize text-foreground/80">
              {rec.confidence}
            </span>
          </span>
        </div>
        <p className="border-s-2 border-border ps-3 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/70">Evidence · </span>
          {rec.evidence}
        </p>
      </div>
    </div>
  );
}

/** The full prioritised plan: impact/effort matrix + numbered phase lists.
 * Used by both the Action Plan page and the report. */
export function ActionPlanView({ plan }: { plan: ActionPlan }) {
  // Stable numbering across the matrix and the phase lists.
  const ordered = GROUPS.flatMap((g) =>
    plan.recommendations.filter((r) => r.type === g.type)
  );
  const indexById = Object.fromEntries(ordered.map((r, i) => [r.id, i + 1]));

  return (
    <div className="flex flex-col gap-8">
      <PriorityMatrix recs={ordered} indexById={indexById} />

      {GROUPS.map((group, gi) => {
        const Icon = group.icon;
        const recs = plan.recommendations.filter((r) => r.type === group.type);
        if (recs.length === 0) return null;
        return (
          <section
            key={group.type}
            className="grid gap-5 lg:grid-cols-[260px_1fr]"
          >
            <div className="flex flex-col gap-2 lg:sticky lg:top-20 lg:self-start">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex size-8 items-center justify-center rounded-lg"
                  style={{
                    background: `color-mix(in oklch, ${group.color} 15%, transparent)`,
                  }}
                >
                  <Icon className="size-4" style={{ color: group.color }} />
                </div>
                <span className="font-heading text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Phase {gi + 1}
                </span>
              </div>
              <h2 className="font-heading text-xl font-semibold tracking-tight">
                {group.title}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {group.description}
              </p>
              <Badge variant="secondary" className="mt-1 w-fit">
                {recs.length} action{recs.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              {recs.map((rec) => (
                <ActionRow key={rec.id} rec={rec} index={indexById[rec.id]} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
