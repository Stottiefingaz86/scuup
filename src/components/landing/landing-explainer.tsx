"use client";

import { useState } from "react";
import {
  Check,
  ListChecks,
  Lock,
  MousePointerClick,
  Target,
} from "lucide-react";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { WhatYouGetAccordion } from "@/components/landing/what-you-get-accordion";
import { cn } from "@/lib/utils";
import {
  ANALYSIS_AREA_LABELS,
  JOURNEY_HEURISTICS,
  LANDING,
  journeyRequiresLogin,
} from "@/lib/constants";

const MEASURE_AREAS = [
  LANDING,
  "signup",
  "deposit",
  "withdraw",
  "casino",
  "sports_betslip",
  "loyalty_rewards",
  "support",
  "my_account",
] as const;

const HEURISTIC_COUNT = Object.values(JOURNEY_HEURISTICS).reduce(
  (n, list) => n + list.length,
  0
);

const HOW_STEPS = [
  {
    step: "01",
    icon: MousePointerClick,
    title: "Walk the journeys",
    description:
      "A real browser in your market moves like a player: sign-up, lobby, cashier, rewards, support. Every screen captured.",
  },
  {
    step: "02",
    icon: ListChecks,
    title: "Score on iGaming heuristics",
    description:
      "Every capture rated 0–100 on the same fixed heuristics. Offer clarity, cashier trust, reward cadence.",
  },
  {
    step: "03",
    icon: Target,
    title: "Compare and prioritise",
    description:
      "Scores roll up to your Player CX Score. Gaps ranked, fixes ordered by impact vs effort.",
  },
];

const METHODOLOGY = [
  "Same heuristics on every site",
  "Vision-scored screenshots",
  "Market-routed browsing",
  "iGaming-native analyst",
];

function areaNote(area: string): string {
  if (area === "loyalty_rewards") {
    return "Scores retention loop mechanics, reward visibility, progress meters, value-back, and reward cadence.";
  }
  if (journeyRequiresLogin(area)) {
    return "Scored from a logged-in browser session in your market, same heuristic names on every brand.";
  }
  return "Vision-scored from captured screenshots, fixed names so every brand compares on the same axes.";
}

function JourneyPicker({
  active,
  onSelect,
  variant,
}: {
  active: string;
  onSelect: (area: string) => void;
  variant: "mobile" | "desktop";
}) {
  if (variant === "mobile") {
    return (
      <div className="min-w-0 max-w-full overflow-hidden border-b border-border bg-muted/10 py-3 lg:hidden">
        <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Journey area
        </p>
        <div
          className="flex w-full min-w-0 touch-pan-x gap-2 overflow-x-auto overscroll-x-contain scroll-ps-3 scroll-pe-3 px-3 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Journey areas"
        >
          {MEASURE_AREAS.map((area) => {
            const isActive = active === area;
            const count = JOURNEY_HEURISTICS[area]?.length ?? 0;
            const label = ANALYSIS_AREA_LABELS[area] ?? area;
            return (
              <button
                key={area}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelect(area)}
                className={cn(
                  "inline-flex shrink-0 snap-start items-center gap-2 rounded-full px-3.5 py-2 text-left text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-background/80 text-muted-foreground ring-1 ring-border/70"
                )}
              >
                <span className="max-w-[9.5rem] truncate sm:max-w-none">{label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                    isActive
                      ? "bg-primary-foreground/15 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <nav
      className="hidden max-h-[min(70vh,560px)] flex-col gap-0.5 overflow-y-auto border-b border-border bg-muted/10 p-2 lg:flex lg:border-b-0 lg:border-r"
      aria-label="Journey areas"
    >
      {MEASURE_AREAS.map((area) => {
        const loginGated = journeyRequiresLogin(area);
        const isActive = active === area;
        const count = JOURNEY_HEURISTICS[area]?.length ?? 0;
        return (
          <button
            key={area}
            type="button"
            onClick={() => onSelect(area)}
            className={cn(
              "flex items-start gap-3 rounded-lg px-3 py-2.5 text-start transition-colors",
              isActive
                ? "bg-background shadow-sm ring-1 ring-border"
                : "hover:bg-background/60"
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md font-mono text-xs font-medium tabular-nums",
                isActive
                  ? "bg-primary/12 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {count}
            </span>
            <span className="min-w-0 flex-1 pt-0.5">
              <span
                className={cn(
                  "block text-sm leading-snug",
                  isActive ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {ANALYSIS_AREA_LABELS[area] ?? area}
              </span>
              {loginGated ? (
                <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Lock className="size-3 shrink-0 opacity-70" />
                  Logged-in session
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function SectionIntro({
  id,
  kicker,
  title,
  description,
  className,
}: {
  id?: string;
  kicker: string;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div id={id} className={cn("flex max-w-2xl flex-col gap-3", className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brand">
        {kicker}
      </p>
      <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-[2.125rem] sm:leading-tight">
        {title}
      </h2>
      <p className="text-base leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

export function WhatWeMeasure() {
  const [active, setActive] = useState<string>(MEASURE_AREAS[0]);
  const heuristics = JOURNEY_HEURISTICS[active] ?? [];

  return (
    <section id="measure" className="mx-auto w-full max-w-7xl px-6 py-20 sm:py-28">
      <LandingReveal>
        <SectionIntro
          kicker="What we measure"
          title={`${MEASURE_AREAS.length} journey areas · ${HEURISTIC_COUNT} heuristics`}
          description="Scuup scores acquisition, play, money, retention, and support on a fixed heuristic set, so every site in your audit is measured on the same axes."
        />
      </LandingReveal>

      <LandingReveal delay={100} className="mt-10 min-w-0 max-w-full rounded-xl border border-border/80 bg-card/40 sm:mt-14 lg:overflow-hidden">
        <div className="grid min-w-0 lg:grid-cols-[minmax(240px,280px)_1fr]">
          <JourneyPicker
            active={active}
            onSelect={setActive}
            variant="mobile"
          />
          <JourneyPicker
            active={active}
            onSelect={setActive}
            variant="desktop"
          />

          <div
            className="min-w-0 p-4 sm:p-6 lg:p-8"
            role="tabpanel"
            aria-label={ANALYSIS_AREA_LABELS[active] ?? active}
          >
            <div className="flex flex-col gap-2 border-b border-border/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-heading text-lg font-semibold sm:text-xl">
                {ANALYSIS_AREA_LABELS[active] ?? active}
              </h3>
              <span className="inline-flex w-fit items-center rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
                {heuristics.length} heuristics · scored 0–100
              </span>
            </div>

            <ul className="mt-4 grid grid-cols-1 gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-2.5">
              {heuristics.map((h, i) => (
                <li
                  key={h}
                  className="flex items-start gap-3 rounded-lg bg-background/50 px-3 py-2.5 ring-1 ring-border/60 sm:bg-background/40 sm:px-3.5 sm:py-3"
                >
                  <span className="w-5 shrink-0 pt-0.5 font-mono text-[11px] tabular-nums text-brand/80">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm leading-snug text-foreground/90">{h}</span>
                </li>
              ))}
            </ul>

            <p className="mt-5 rounded-lg bg-muted/15 px-3.5 py-3 text-sm leading-relaxed text-muted-foreground ring-1 ring-border/50 sm:mt-6 sm:px-4">
              {areaNote(active)}
            </p>
          </div>
        </div>
      </LandingReveal>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-border bg-background py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-6">
        <LandingReveal>
          <SectionIntro
            kicker="How it works"
            title="Real browsers. Fixed heuristics. Screenshot evidence."
            description="Add your URLs, pick a market, and Scuup does the rest."
          />
        </LandingReveal>

        <ol className="mt-14 grid gap-5 lg:grid-cols-3">
          {HOW_STEPS.map((step, i) => (
            <LandingReveal key={step.step} delay={i * 90} as="li">
              <div className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-xl border bg-background/60 p-6 pb-7 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_20px_50px_-32px_oklch(0.77_0.15_163/0.25)]">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-3 -top-6 font-heading text-[7rem] font-semibold leading-none text-foreground/[0.04] transition-colors group-hover:text-primary/[0.07]"
                >
                  {step.step}
                </span>
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <step.icon className="size-5" />
                </span>
                <h3 className="font-heading text-lg font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </LandingReveal>
          ))}
        </ol>

        <LandingReveal delay={200} className="mt-8">
          <ul className="flex flex-wrap gap-2.5">
            {METHODOLOGY.map((item) => (
              <li
                key={item}
                className="flex items-center gap-1.5 rounded-full border bg-background/40 px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30"
              >
                <Check className="size-3.5 text-brand" />
                {item}
              </li>
            ))}
          </ul>
        </LandingReveal>
      </div>
    </section>
  );
}

export function WhatYouGet() {
  return (
    <section id="report" className="mx-auto w-full max-w-7xl px-6 py-20 sm:py-28">
      <LandingReveal>
        <SectionIntro
          kicker="What you get"
          title="A live workspace and a report your board can read"
          description="Every audit produces an interactive dashboard for your product team and a structured report for leadership, both built from the same scored visits."
        />
      </LandingReveal>

      <LandingReveal delay={120} className="mt-14">
        <WhatYouGetAccordion />
      </LandingReveal>
    </section>
  );
}

export { HEURISTIC_COUNT, MEASURE_AREAS };
