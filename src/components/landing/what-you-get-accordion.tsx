"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  LayoutDashboard,
  Presentation,
  Route,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Panel = {
  id: string;
  label: string;
  icon: LucideIcon;
  tagline: string;
  quote: string;
  footnote: string;
  strip: string;
  open: string;
};

const PANELS: Panel[] = [
  {
    id: "workspace",
    label: "Workspace",
    icon: LayoutDashboard,
    tagline: "Live audit dashboard for your product team.",
    quote:
      "Rank, Player CX Score, journey breakdowns, and screenshot evidence in one workspace, not another slide deck that goes stale the week you ship.",
    footnote: "Overview, journeys, evidence, gaps, and action plan.",
    strip: "bg-[oklch(0.52_0.14_163)]",
    open: "bg-[oklch(0.38_0.11_163)]",
  },
  {
    id: "executive",
    label: "Summary",
    icon: Presentation,
    tagline: "Board-ready executive read.",
    quote:
      "Where you rank in the set, your overall score, and the biggest gap, written so leadership gets it in one pass.",
    footnote: "Rank, rollup score, and plain-language gap analysis.",
    strip: "bg-[oklch(0.44_0.07_250)]",
    open: "bg-[oklch(0.32_0.06_250)]",
  },
  {
    id: "scorecard",
    label: "Scorecard",
    icon: Trophy,
    tagline: "Same heuristics on every brand.",
    quote:
      "Every competitor ranked side-by-side on identical journeys, tier-coloured gauges that hold up when someone in the room pushes back.",
    footnote: "Brand ranking table with journey and pillar scores.",
    strip: "bg-[oklch(0.58_0.17_38)]",
    open: "bg-[oklch(0.44_0.14_38)]",
  },
  {
    id: "findings",
    label: "Findings",
    icon: Route,
    tagline: "Evidence behind every point.",
    quote:
      "Heuristic scores, analyst notes, and captures per journey, open any finding and see the screen that earned it.",
    footnote: "Journey findings with inline screenshot proof.",
    strip: "bg-[oklch(0.42_0.11_285)]",
    open: "bg-[oklch(0.30_0.09_285)]",
  },
  {
    id: "action",
    label: "Actions",
    icon: Target,
    tagline: "Prioritised fix list.",
    quote:
      "Fix now, improve next, and strategic bets, ordered by impact vs effort and tied back to the audit, not a consultant's gut feel.",
    footnote: "Impact matrix plus coverage for missing sessions.",
    strip: "bg-[oklch(0.50_0.10_85)]",
    open: "bg-[oklch(0.36_0.09_85)]",
  },
];

function PanelHeader({ panel }: { panel: Panel }) {
  const Icon = panel.icon;
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
        <Icon className="size-4 text-white" strokeWidth={2} />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="font-heading text-base font-semibold text-white">{panel.label}</p>
        <p className="mt-0.5 text-sm leading-snug text-white/65">{panel.tagline}</p>
      </div>
    </div>
  );
}

export function WhatYouGetAccordion() {
  const [active, setActive] = useState(0);

  return (
    <>
      <div
        className="hidden h-[28rem] gap-1.5 lg:h-[26rem] lg:gap-1 md:flex"
        role="tablist"
        aria-label="What you get"
      >
        {PANELS.map((panel, index) => {
          const isActive = active === index;
          const Icon = panel.icon;

          return (
            <button
              key={panel.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`what-you-get-panel-${panel.id}`}
              id={`what-you-get-tab-${panel.id}`}
              onClick={() => setActive(index)}
              style={{ flex: isActive ? "1 1 0%" : "0 0 3.75rem" }}
              className={cn(
                "relative h-full min-w-0 overflow-hidden rounded-2xl text-left",
                "transition-[flex,flex-basis,box-shadow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                isActive ? panel.open : panel.strip,
                isActive && "shadow-[0_28px_80px_-24px_rgba(0,0,0,0.55)]",
                !isActive && "hover:brightness-110",
              )}
            >
              {/* Collapsed, icon pinned to top */}
              <div
                className={cn(
                  "absolute inset-0 flex justify-center pt-7 transition-opacity duration-300",
                  isActive ? "pointer-events-none opacity-0" : "opacity-100",
                )}
                aria-hidden={isActive}
              >
                <Icon className="size-5 text-white/90" strokeWidth={1.75} />
              </div>

              {/* Expanded */}
              <div
                id={`what-you-get-panel-${panel.id}`}
                role="tabpanel"
                aria-labelledby={`what-you-get-tab-${panel.id}`}
                className={cn(
                  "flex h-full min-w-[18rem] flex-col justify-between p-7 sm:p-8 lg:p-9",
                  "transition-opacity duration-500",
                  isActive
                    ? "opacity-100 delay-150"
                    : "pointer-events-none opacity-0",
                )}
              >
                <PanelHeader panel={panel} />

                <blockquote className="my-auto max-w-2xl py-6 font-heading text-[1.35rem] font-medium leading-[1.35] tracking-tight text-white/95 sm:text-[1.5rem] lg:text-[1.65rem]">
                  &ldquo;{panel.quote}&rdquo;
                </blockquote>

                <div className="flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-end sm:justify-between">
                  <p className="max-w-md text-sm leading-relaxed text-white/55">
                    {panel.footnote}
                  </p>
                  <Link
                    href="/projects/new"
                    className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
                  >
                    Start your audit
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Mobile */}
      <div className="flex flex-col gap-2 md:hidden">
        {PANELS.map((panel, index) => {
          const isActive = active === index;
          const Icon = panel.icon;

          return (
            <div
              key={panel.id}
              className={cn(
                "overflow-hidden rounded-2xl transition-colors duration-300",
                isActive ? panel.open : panel.strip,
              )}
            >
              <button
                type="button"
                onClick={() => setActive(isActive ? -1 : index)}
                className="flex w-full items-center gap-3 px-4 py-4 text-left"
              >
                <Icon className="size-5 shrink-0 text-white/90" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white">
                    {panel.label}
                  </span>
                  <span className="block text-xs text-white/60">{panel.tagline}</span>
                </span>
              </button>
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-out",
                  isActive ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <div className="border-t border-white/10 px-4 pb-5 pt-3">
                    <p className="text-sm leading-relaxed text-white/80">
                      &ldquo;{panel.quote}&rdquo;
                    </p>
                    <p className="mt-3 text-xs text-white/50">{panel.footnote}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
