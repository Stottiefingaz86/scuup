"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { TierLegend } from "@/components/score-chip";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { TIERS, TIER_BG } from "@/lib/score";
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
    title: "Walk the journeys",
    description:
      "Automated sessions open a real browser in your target market and navigate like a player — homepage, sign-up, casino lobby, rewards hub, support, and more. Every step is captured.",
  },
  {
    step: "02",
    title: "Score on iGaming heuristics",
    description:
      "Each capture is rated against the same product heuristics for every site — offer clarity, tier transparency, cashier trust, reward cadence. Not generic UX checklists.",
  },
  {
    step: "03",
    title: "Compare and prioritise",
    description:
      "Scores roll up to 0–100 per journey and overall Player CX Score. Gap analysis shows where you win and lose, heuristic by heuristic. An action plan ranks fixes by impact vs effort.",
  },
];

const METHODOLOGY = [
  "A canonical heuristic list per journey — the same axis names on every site so scores are comparable.",
  "iGaming domain expertise in the analyst — promo vs loop retention, cashier trust, regulated vs crypto patterns.",
  "Vision scoring on captured screenshots — every point tied to UI evidence, not assumptions from HTML.",
  "Market-routed browsing — sessions appear from the region you select so geo-gated content matches local players.",
];

const REPORT_SECTIONS = [
  {
    num: "01",
    title: "Executive summary",
    description:
      "Where you rank in the set, your overall Player CX Score, and a plain-language read of the biggest gap.",
  },
  {
    num: "02",
    title: "Scorecard & ranking",
    description:
      "Every site ranked side-by-side with journey scores and tier-coloured gauges on the same heuristics.",
  },
  {
    num: "03",
    title: "Findings by journey",
    description:
      "Heuristic scores, analyst summary, observations, detected features, and screenshot evidence per journey.",
  },
  {
    num: "04",
    title: "Action plan",
    description:
      "Impact vs effort matrix plus Fix now / Improve next / Strategic bets — each tied to audit evidence.",
  },
  {
    num: "05",
    title: "Coverage & next steps",
    description:
      "What's captured vs what still needs a logged-in session or live recording.",
  },
];

const WORKSPACE_ITEMS = [
  "Overview with rank, Player CX Score, and executive read",
  "Journey deep-dives with heuristic-by-heuristic breakdown",
  "Evidence library — screenshots from every visit",
  "Gap analysis vs whoever leads your set",
  "Action plan with prioritisation matrix",
  "Feature matrix across all sites in the audit",
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
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
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
      <SectionIntro
        kicker="What we measure"
        title={`${MEASURE_AREAS.length} journey areas · ${HEURISTIC_COUNT} heuristics`}
        description="Scuup scores acquisition, play, money, retention, and support on a fixed heuristic set — so every site in your audit is measured on the same axes."
      />

      <div className="mt-14 grid gap-12 lg:grid-cols-[220px_1fr] lg:gap-16">
        <nav className="flex flex-col">
          {MEASURE_AREAS.map((area) => {
            const loginGated =
              area === "deposit" || area === "withdraw" || area === "my_account";
            const isActive = active === area;
            return (
              <button
                key={area}
                type="button"
                onClick={() => setActive(area)}
                className={cn(
                  "flex items-center justify-between gap-2 border-s-2 py-2.5 ps-4 text-start text-sm transition-colors",
                  isActive
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{ANALYSIS_AREA_LABELS[area] ?? area}</span>
                {loginGated ? (
                  <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                    Logged-in
                  </Badge>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b pb-4">
            <h3 className="font-heading text-xl font-semibold">
              {ANALYSIS_AREA_LABELS[active] ?? active}
            </h3>
            <p className="text-sm text-muted-foreground">
              {heuristics.length} heuristics · scored 0–100
            </p>
          </div>
          <ul className="mt-6 columns-1 gap-x-10 sm:columns-2">
            {heuristics.map((h) => (
              <li
                key={h}
                className="mb-3 break-inside-avoid text-sm leading-relaxed text-muted-foreground"
              >
                {h}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-muted-foreground">
            Loyalty journeys also score retention loop mechanics — reward visibility,
            progress meters, value-back, frequency cadence — with explicit rules for
            logged-in or tracked-play sessions.
          </p>
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-border bg-muted/40 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-6">
        <SectionIntro
          kicker="How it works"
          title="Real browsers. Fixed heuristics. Screenshot evidence."
          description="Add your URLs and pick a market. Scuup walks each journey, scores what it captures, and compares your set — no synthetic data, no scraped HTML."
        />

        <ol className="mt-14 border-t">
          {HOW_STEPS.map((step) => (
            <li
              key={step.step}
              className="grid gap-4 border-b py-10 md:grid-cols-[4rem_1fr]"
            >
              <span className="font-mono text-sm text-muted-foreground">{step.step}</span>
              <div className="flex flex-col gap-2">
                <h3 className="font-heading text-lg font-semibold">{step.title}</h3>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-muted-foreground" />
            Based on what
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {METHODOLOGY.map((item) => (
              <li key={item} className="text-sm leading-relaxed text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function WhatYouGet() {
  return (
    <section id="report" className="mx-auto w-full max-w-7xl px-6 py-20 sm:py-28">
      <SectionIntro
        kicker="What you get"
        title="A live workspace and a report your board can read"
        description="Every audit produces an interactive dashboard for your product team and a structured PDF for leadership — both built from the same scored visits."
      />

      <div className="mt-14 grid gap-16 lg:grid-cols-2">
        <div>
          <h3 className="font-heading text-lg font-semibold">In the workspace</h3>
          <ul className="mt-5 flex flex-col gap-3">
            {WORKSPACE_ITEMS.map((item) => (
              <li key={item} className="text-sm leading-relaxed text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-heading text-lg font-semibold">In the report</h3>
          <ol className="mt-5 flex flex-col gap-0">
            {REPORT_SECTIONS.map((s, i) => (
              <li key={s.num}>
                {i > 0 ? <Separator className="my-4" /> : null}
                <div className="flex gap-4">
                  <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">
                    {s.num}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {s.description}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function ScoringScale() {
  const tierWidths = [46, 15, 15, 15, 10];

  return (
    <section id="scoring" className="border-t border-border bg-muted/40 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-6">
        <SectionIntro
          kicker="Scoring"
          title="0–100 on a five-tier scale"
          description="Each heuristic is scored 0–100. Journey scores average their heuristics. Player CX Score averages all successful visits. Same rules for every site."
        />

        <div className="mt-10 flex h-1.5 overflow-hidden rounded-full">
          {TIERS.map((tier, i) => (
            <div
              key={tier.tier}
              className={cn(TIER_BG[tier.tier], "h-full first:rounded-s-full last:rounded-e-full")}
              style={{ width: `${tierWidths[i]}%` }}
              title={`${tier.label} (${tier.range})`}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {TIERS.map((tier) => (
            <span key={tier.tier} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", TIER_BG[tier.tier])} />
              {tier.label} {tier.range}
            </span>
          ))}
        </div>

        <div className="mt-10 grid gap-8 border-t pt-10 sm:grid-cols-3">
          {[
            { label: "Heuristic", example: "Tier transparency", score: 51 },
            { label: "Journey", example: "Loyalty & rewards", score: 48 },
            { label: "Player CX Score", example: "Overall", score: 62 },
          ].map((row) => (
            <div key={row.label}>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {row.label}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{row.example}</p>
              <p className="mt-2 font-heading text-4xl font-semibold tabular-nums">
                {row.score}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-end">
          <TierLegend className="text-xs" />
        </div>
      </div>
    </section>
  );
}

export { HEURISTIC_COUNT, MEASURE_AREAS };
