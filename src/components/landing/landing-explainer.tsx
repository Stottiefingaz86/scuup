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
          description="Scuup scores acquisition, play, money, retention, and support on a fixed heuristic set — so every site in your audit is measured on the same axes."
        />
      </LandingReveal>

      <LandingReveal delay={100} className="mt-14 overflow-hidden rounded-xl border bg-card/50">
        <div className="grid lg:grid-cols-[minmax(260px,300px)_1fr]">
          <nav
            className="flex flex-col gap-0.5 border-b border-border bg-muted/15 p-2 lg:border-b-0 lg:border-r"
            aria-label="Journey areas"
          >
            {MEASURE_AREAS.map((area) => {
              const loginGated =
                area === "deposit" || area === "withdraw" || area === "my_account";
              const isActive = active === area;
              const count = JOURNEY_HEURISTICS[area]?.length ?? 0;
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => setActive(area)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg px-3 py-3 text-start transition-colors",
                    isActive
                      ? "bg-background shadow-sm ring-1 ring-border"
                      : "hover:bg-background/60"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md font-mono text-xs font-medium tabular-nums",
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

          <div className="min-w-0 p-5 sm:p-6 lg:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
              <h3 className="font-heading text-xl font-semibold">
                {ANALYSIS_AREA_LABELS[active] ?? active}
              </h3>
              <p className="text-sm text-muted-foreground">
                {heuristics.length} heuristics · scored 0–100
              </p>
            </div>

            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {heuristics.map((h, i) => (
                <li
                  key={h}
                  className="flex items-start gap-3 rounded-lg border border-border/80 bg-background/40 px-3.5 py-3"
                >
                  <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm leading-snug text-foreground/90">{h}</span>
                </li>
              ))}
            </ul>

            <p className="mt-6 rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
              Loyalty journeys also score retention loop mechanics — reward visibility,
              progress meters, value-back, frequency cadence — with explicit rules for
              logged-in or tracked-play sessions.
            </p>
          </div>
        </div>
      </LandingReveal>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-border bg-card/40 py-20 sm:py-28">
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
          description="Every audit produces an interactive dashboard for your product team and a structured report for leadership — both built from the same scored visits."
        />
      </LandingReveal>

      <LandingReveal delay={120} className="mt-14">
        <WhatYouGetAccordion />
      </LandingReveal>
    </section>
  );
}

export { HEURISTIC_COUNT, MEASURE_AREAS };
