"use client";

import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  MessagesSquare,
  Palette,
  Repeat,
  Route,
  ShieldCheck,
  X,
} from "lucide-react";
import { LandingShell } from "@/components/landing/landing-shell";
import { ScuupMark } from "@/components/landing/scuup-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  FREE_PLAN_FEATURES,
  PRO_PLUS_PRICE_MONTHLY,
  PRO_PLUS_SELLING_POINTS,
  PRO_PRICE_MONTHLY,
  PRO_SELLING_POINTS,
} from "@/lib/plan";
import {
  HEURISTIC_COUNT,
  HowItWorks,
  MEASURE_AREAS,
  ScoringScale,
  WhatWeMeasure,
  WhatYouGet,
} from "@/components/landing/landing-explainer";
import { LandingHeaderActions } from "@/components/landing/landing-header-actions";
import { ShowcaseCarousel } from "@/components/landing/showcase-carousel";
import { LandingFaq } from "@/components/landing/landing-faq";
import { MarketsMarquee } from "@/components/landing/markets-marquee";
import { SharedReportReview } from "@/components/landing/shared-report-review";

/* ------------------------------------------------------------------ */
/* Hero visual: a real screenshot of the live workspace in a browser   */
/* frame — no mocked UI, the actual product with actual scores.        */
/* ------------------------------------------------------------------ */

function HeroVisual() {
  return (
    <div className="relative mx-auto mt-16 w-full max-w-6xl px-4 sm:mt-20 sm:px-6">
      <div
        aria-hidden
        className="absolute inset-x-16 top-6 h-72 rounded-full bg-primary/15 blur-[120px]"
      />
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-card shadow-[0_32px_90px_-28px_rgba(0,0,0,0.8)]">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] bg-background/90 px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
          </span>
          <span className="mx-auto flex items-center gap-1.5 rounded-md bg-white/[0.06] px-3 py-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3 text-brand" aria-hidden />
            app.scuup.com · Winna vs Stake, Rainbet, FanDuel · Canada
          </span>
        </div>
        <Image
          src="/landing/app-overview.png"
          alt="The Scuup workspace: Player CX ranking with journey, retention, voice of customer and design scores"
          width={1520}
          height={940}
          priority
          className="w-full"
        />
        {/* Fade the bottom edge into the page so the screenshot reads as a
            window into the product, not a pasted image. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const PILLARS = [
  {
    icon: Route,
    title: "Journeys",
    description:
      "Agents walk sign-up, casino, sportsbook, cashier, rewards, and support in a real browser from your market (logged out and logged in) and score every screen on iGaming heuristics.",
  },
  {
    icon: Repeat,
    title: "Retention",
    description:
      "What FTD players actually get: welcome structure, loyalty tiers, reward cadence and VIP mechanics read from live pages and help centres, not marketing claims.",
  },
  {
    icon: MessagesSquare,
    title: "Voice of Customer",
    description:
      "Real player reviews scraped and analysed: sentiment, themes, and where public complaints confirm or contradict what we measured on the site.",
  },
  {
    icon: Palette,
    title: "Design Review",
    description:
      "The live rendered code, measured: tech stack, real colour palette, accessibility failures, and a design-director critique of every core screen.",
  },
];

const COMPARISON = [
  {
    capability: "Evidence",
    old: "Opinion decks and screenshots someone remembered to take",
    scuup: "A screenshot behind every number. Nothing is estimated.",
  },
  {
    capability: "Market view",
    old: "One market, audited once, stale in a quarter",
    scuup: "Any of 40 markets through local residential browsing, re-runnable on demand",
  },
  {
    capability: "Logged-in coverage",
    old: "Rarely. Nobody wants to register 5 accounts by hand.",
    scuup: "Agents register real test accounts and walk deposit, rewards and account flows",
  },
  {
    capability: "Player voice",
    old: "Surveys and panels, weeks later",
    scuup: "Live public reviews cross-checked against what the audit measured",
  },
  {
    capability: "Time to first read",
    old: "6–8 weeks and a workshop",
    scuup: "Under an hour, then a living workspace",
  },
];

const PRICING = [
  {
    name: "Free",
    price: "€0",
    period: "",
    taxNote: "",
    description: "Your brand, scored once",
    features: FREE_PLAN_FEATURES,
    cta: "Start free audit",
    href: "/projects/new",
    variant: "outline" as const,
  },
  {
    name: "Pro",
    price: `€${PRO_PRICE_MONTHLY}`,
    period: "/ month",
    taxNote: "exc. tax",
    description: "One competitive report",
    features: PRO_SELLING_POINTS,
    cta: "Upgrade to Pro",
    href: "/upgrade",
    variant: "default" as const,
    highlight: true,
  },
  {
    name: "Pro Plus",
    price: `€${PRO_PLUS_PRICE_MONTHLY}`,
    period: "/ month",
    taxNote: "exc. tax",
    description: "Five reports in parallel",
    features: PRO_PLUS_SELLING_POINTS,
    cta: "Upgrade to Pro Plus",
    href: "/upgrade",
    variant: "outline" as const,
  },
];

const HERO_STATS = [
  { value: "4", label: "score pillars" },
  { value: String(MEASURE_AREAS.length), label: "journey areas" },
  { value: String(HEURISTIC_COUNT), label: "iGaming heuristics" },
  { value: "40", label: "markets" },
];

export function LandingShowcase() {
  return (
    <LandingShell>
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-8 px-6 py-4">
          <Link href="/">
            <ScuupMark />
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#pillars" className="transition-colors hover:text-foreground">
              What we score
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#compare" className="transition-colors hover:text-foreground">
              Why Scuup
            </a>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              Pricing
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </a>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <LandingHeaderActions />
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="landing-hero-glow landing-bg-dots landing-bg-grain relative overflow-hidden pb-20 pt-20 sm:pt-28">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 text-center">
            <Badge
              variant="outline"
              className="gap-1.5 rounded-full border-primary/30 px-3 py-1 font-normal text-muted-foreground"
            >
              <span className="size-1.5 rounded-full bg-brand" />
              Quick competitor analysis for iGaming
            </Badge>
            <h1 className="mt-6 font-heading text-4xl font-semibold leading-[1.06] tracking-tight text-balance sm:text-6xl">
              Know where you stand{" "}
              <span className="text-gradient">in an instant</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Deep dives into casino, sports, retention and what players are
              really saying. You versus your competitors, from the market you
              operate in. Scuup (like “scoop”) pinpoints where you&apos;re
              losing players and shows you exactly how the leaders do it.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                className="glow-primary"
                nativeButton={false}
                render={<Link href="/projects/new" />}
              >
                Run your free audit
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={<Link href="#pillars" />}
              >
                See what we score
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              First report free · no credit card · results in under an hour
            </p>
          </div>

          <HeroVisual />
        </section>

        {/* Stats strip */}
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-px overflow-hidden px-6 sm:grid-cols-4">
            {HERO_STATS.map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center gap-1 py-8"
              >
                <span className="font-heading text-3xl font-semibold tabular-nums">
                  {s.value}
                </span>
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Four pillars */}
        <section id="pillars" className="mx-auto w-full max-w-7xl px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brand">
              The Player CX Score
            </p>
            <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              One score, four pillars,
              <br /> zero guesswork
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              How do we compete on loyalty? Why do players deposit there and
              not here? The Player CX Score answers it with four measured
              pillars, each auditable down to the screen it was scored from,
              so the number holds up in front of a sceptical board.
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="group flex flex-col gap-4 rounded-xl border bg-card/60 p-6 transition-colors hover:border-primary/40"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <p.icon className="size-5" />
                </span>
                <h3 className="font-heading text-lg font-semibold">{p.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {p.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <ShowcaseCarousel />

        <HowItWorks />
        <WhatWeMeasure />

        {/* Comparison */}
        <section id="compare" className="border-y border-border bg-card/40 py-20 sm:py-28">
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="max-w-2xl">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brand">
                Why Scuup
              </p>
              <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Built for how iGaming actually competes
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Agency CX audits are slow, expensive and opinion-shaped.
                Generic analytics tools don&apos;t know what a betslip or a
                rakeback loop is. Scuup is purpose-built for operator
                benchmarking.
              </p>
            </div>

            <div className="mt-12 overflow-hidden rounded-xl border">
              <div className="grid grid-cols-[1fr_1.2fr_1.2fr] gap-px bg-border text-sm sm:grid-cols-[220px_1fr_1fr]">
                <div className="bg-card/80 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Capability
                </div>
                <div className="bg-card/80 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Agency audit / DIY
                </div>
                <div className="bg-primary/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-primary">
                  Scuup
                </div>
                {COMPARISON.map((row) => (
                  <Fragment key={row.capability}>
                    <div className="bg-background px-4 py-4 font-medium">
                      {row.capability}
                    </div>
                    <div className="flex items-start gap-2 bg-background px-4 py-4 text-muted-foreground">
                      <X className="mt-0.5 size-3.5 shrink-0 text-tier-1/70" />
                      {row.old}
                    </div>
                    <div className="flex items-start gap-2 bg-primary/[0.04] px-4 py-4">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-brand" />
                      {row.scuup}
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </section>

        <WhatYouGet />
        <SharedReportReview />
        <ScoringScale />

        <MarketsMarquee />

        {/* Pricing */}
        <section id="pricing" className="border-t border-border bg-card/40 py-20 sm:py-28">
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="mx-auto max-w-xl text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brand">
                Pricing
              </p>
              <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                Start free, benchmark on Pro
              </h2>
              <p className="mt-4 text-muted-foreground">
                Free scores your brand once with no updates. Pro adds four
                competitors on one live report. Pro Plus runs five.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-6xl gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-3">
              {PRICING.map((plan) => (
                <div
                  key={plan.name}
                  className={cn(
                    "flex flex-col bg-background p-8",
                    plan.highlight && "bg-primary/[0.05]"
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-heading text-lg font-semibold">
                      {plan.name}
                    </h3>
                    {plan.highlight ? (
                      <Badge variant="secondary" className="font-normal">
                        Recommended
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                  <p className="mt-6 font-heading text-4xl font-semibold tabular-nums">
                    {plan.price}
                    {plan.period ? (
                      <span className="text-base font-normal text-muted-foreground">
                        {plan.period}
                      </span>
                    ) : null}
                  </p>
                  {plan.taxNote ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {plan.taxNote}
                    </p>
                  ) : null}
                  <ul className="mt-8 flex flex-1 flex-col gap-2.5 text-sm">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2.5 text-muted-foreground"
                      >
                        <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={cn("mt-8 w-full sm:w-auto", plan.highlight && "glow-primary")}
                    variant={plan.variant}
                    nativeButton={false}
                    render={<Link href={plan.href} />}
                  >
                    {plan.cta}
                    {plan.highlight ? (
                      <ArrowUpRight data-icon="inline-end" />
                    ) : null}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <LandingFaq />

        {/* Final CTA */}
        <section className="landing-hero-glow border-t border-border">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-6 px-6 py-24 text-center sm:py-32">
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Stop guessing where
              <br /> you&apos;re losing players
            </h2>
            <p className="max-w-lg text-muted-foreground">
              You vs the rest of your market. Scored, evidenced and ranked,
              with the fixes pinpointed. First read in under an hour.
            </p>
            <Button
              size="lg"
              className="glow-primary"
              nativeButton={false}
              render={<Link href="/projects/new" />}
            >
              Run your free audit
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <ScuupMark />
            <p className="text-sm text-muted-foreground">
              Player CX intelligence for iGaming operators.
            </p>
          </div>
          <Separator />
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            Compliant market research. Scuup pauses at CAPTCHAs, KYC and
            payment confirmation. No real money moves.
          </p>
        </div>
      </footer>
    </LandingShell>
  );
}
