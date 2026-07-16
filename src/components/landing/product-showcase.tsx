"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { LandingShell } from "@/components/landing/landing-shell";
import { ScuupMark } from "@/components/landing/scuup-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FREE_PLAN_FEATURES,
  PRO_PLUS_PRICE_MONTHLY,
  PRO_PLUS_SELLING_POINTS,
  PRO_PRICE_MONTHLY,
  PRO_SELLING_POINTS,
} from "@/lib/plan";
import {
  HowItWorks,
  WhatWeMeasure,
  WhatYouGet,
} from "@/components/landing/landing-explainer";
import { LandingHeaderActions } from "@/components/landing/landing-header-actions";
import { LandingProductNav } from "@/components/landing/landing-product-nav";
import { PillarSpotlights } from "@/components/landing/pillar-spotlights";
import { ShowcaseCarousel } from "@/components/landing/showcase-carousel";
import { LandingContact } from "@/components/landing/landing-contact";
import { AboutNavButton, AboutUsProvider } from "@/components/landing/landing-about";
import { LegalDialogProvider } from "@/components/landing/landing-legal-dialog";
import { CookieConsent } from "@/components/landing/cookie-consent";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { MarketsMarquee } from "@/components/landing/markets-marquee";
import { ScuupScrollHeadline } from "@/components/landing/scuup-scroll-headline";
import { SharedReportReview } from "@/components/landing/shared-report-review";
import { WhyScuupComparison } from "@/components/landing/why-scuup-comparison";

/** Hero accent phrase rolls between the tagline and the brand line. */
const HERO_ROLL_PHRASES = ["In an Instant", "Get The Scuup."] as const;

function HeroRollingPhrase() {
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % HERO_ROLL_PHRASES.length);
    }, 3200);
    return () => clearInterval(t);
  }, [reduceMotion]);

  return (
    <span className="relative mt-1 block">
      <span className="sr-only">{HERO_ROLL_PHRASES.join(". ")}</span>
      <span aria-hidden className="hero-roll-viewport block overflow-hidden">
        <span
          className="hero-roll-track block"
          style={
            reduceMotion
              ? undefined
              : { transform: `translate3d(0, calc(${index} * -1.2em), 0)` }
          }
        >
          {HERO_ROLL_PHRASES.map((line) => (
            <span key={line} className="hero-roll-line hero-roll-gradient block">
              {line}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Hero visual: a real screenshot of the live workspace in a browser   */
/* frame, no mocked UI, the actual product with actual scores.        */
/* ------------------------------------------------------------------ */

/** Animated radar behind the hero copy, Scuup scanning the market.
 * Static nodes sit on the grid; a subset flash when the 7s sweep passes. */
const RADAR_NODES = [
  { angle: 18, radius: 26, size: 1.5, blip: true },
  { angle: 52, radius: 14, size: 1 },
  { angle: 88, radius: 38, size: 1.25 },
  { angle: 118, radius: 22, size: 1, blip: true },
  { angle: 155, radius: 32, size: 1.5 },
  { angle: 192, radius: 16, size: 1 },
  { angle: 228, radius: 40, size: 1.25, blip: true },
  { angle: 262, radius: 24, size: 1 },
  { angle: 298, radius: 12, size: 1.5 },
  { angle: 332, radius: 34, size: 1, blip: true },
  { angle: 8, radius: 42, size: 1 },
  { angle: 145, radius: 8, size: 1.25 },
  { angle: 205, radius: 30, size: 1 },
  { angle: 275, radius: 18, size: 1.25 },
];

function HeroRadar() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-[-420px] z-0 size-[900px] -translate-x-1/2 opacity-70 sm:top-[-660px] sm:size-[1400px] xl:top-[-880px] xl:size-[1800px] [mask-image:radial-gradient(closest-side,black_35%,transparent_82%)]"
    >
      <div className="radar-rings absolute inset-0 rounded-full" />
      <div className="radar-sweep absolute inset-0 rounded-full" />
      {RADAR_NODES.map((node) => {
        const rad = (node.angle * Math.PI) / 180;
        const px = node.size * 4;
        return (
          <span
            key={`${node.angle}-${node.radius}`}
            className={cn(
              "radar-node absolute rounded-full bg-brand",
              node.blip && "radar-blip",
            )}
            style={{
              width: px,
              height: px,
              left: `${50 + node.radius * Math.sin(rad)}%`,
              top: `${50 - node.radius * Math.cos(rad)}%`,
              transform: "translate(-50%, -50%)",
              ...(node.blip && {
                animationDelay: `${((node.angle / 360) * 7).toFixed(2)}s`,
              }),
            }}
          />
        );
      })}
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative z-[2] mx-auto mt-16 w-full max-w-6xl px-4 sm:mt-20 sm:px-6">
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

export function LandingShowcase() {
  return (
    <AboutUsProvider>
    <LegalDialogProvider>
    <LandingShell>
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-8 px-6 py-4">
          <Link href="/">
            <ScuupMark />
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <LandingProductNav />
            <a href="#pricing" className="transition-colors hover:text-foreground">
              Pricing
            </a>
            <AboutNavButton />
            <a href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </a>
            <a href="#contact" className="transition-colors hover:text-foreground">
              Contact
            </a>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <LandingHeaderActions />
          </div>
        </div>
      </header>

      <main className="min-w-0">
        {/* Hero */}
        <section className="landing-hero-glow landing-bg-dots relative isolate overflow-hidden pb-20 pt-20 sm:pt-28">
          <div aria-hidden className="landing-grain-texture absolute z-[1]" />
          <HeroRadar />
          <div className="relative z-[2] mx-auto flex w-full max-w-4xl flex-col items-center px-6 text-center">
            <Link
              href="/login?mode=signup"
              className="group inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-4 py-1.5 text-sm font-medium text-foreground shadow-[0_0_24px_-8px_color-mix(in_oklch,var(--brand)_55%,transparent)] transition-colors hover:border-brand/70 hover:bg-brand/15"
            >
              <span className="size-1.5 rounded-full bg-brand" />
              Built by iGaming Experts
              <ArrowRight className="size-3.5 text-brand transition-transform group-hover:translate-x-0.5" />
            </Link>
            <h1 className="mt-6 font-heading text-4xl font-semibold leading-[1.12] tracking-tight sm:text-6xl">
              <span className="block text-foreground">Know where you stand,</span>
              <HeroRollingPhrase />
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
              Deep dives into casino, sports, retention and what players are
              really saying. You versus your competitors, from the market you
              operate in. Scuup (like “scoop”) pinpoints where you lose
              players and how the leaders win them.
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
                render={<a href="#contact" />}
              >
                Contact us
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              No code, no integrations · first report free, no credit card ·
              results in under an hour
            </p>
          </div>

          <HeroVisual />
        </section>

        <MarketsMarquee />

        {/* Four pillars */}
        <section id="pillars" className="mx-auto w-full max-w-7xl px-6 py-20 sm:py-28">
          <LandingReveal className="mx-auto max-w-2xl text-center">
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
          </LandingReveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p, i) => (
              <LandingReveal key={p.title} delay={i * 70}>
                <div className="group flex h-full flex-col gap-4 rounded-xl border bg-card/60 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_20px_50px_-32px_oklch(0.77_0.15_163/0.2)]">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
                    <p.icon className="size-5" />
                  </span>
                  <h3 className="font-heading text-lg font-semibold">{p.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {p.description}
                  </p>
                </div>
              </LandingReveal>
            ))}
          </div>
        </section>

        <ShowcaseCarousel />

        <ScuupScrollHeadline />

        <HowItWorks />
        <WhatWeMeasure />
        <PillarSpotlights />

        <WhyScuupComparison />

        <WhatYouGet />
        <SharedReportReview />

        {/* Pricing */}
        <section id="pricing" className="border-t border-border bg-card/40 py-20 sm:py-28">
          <div className="mx-auto w-full max-w-7xl px-6">
            <LandingReveal className="mx-auto max-w-xl text-center">
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
            </LandingReveal>

            <div className="mx-auto mt-12 grid max-w-6xl gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-3">
              {PRICING.map((plan, i) => (
                <LandingReveal key={plan.name} delay={i * 90}>
                  <div
                    className={cn(
                      "flex h-full flex-col bg-background p-8 transition-colors duration-300",
                      plan.highlight && "bg-primary/[0.05]",
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
                </LandingReveal>
              ))}
            </div>
          </div>
        </section>

        <LandingFaq />

        <LandingContact />

        {/* Final CTA */}
        <section className="landing-hero-glow border-t border-border">
          <LandingReveal className="mx-auto flex w-full max-w-7xl flex-col items-center gap-6 px-6 py-24 text-center sm:py-32">
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
          </LandingReveal>
        </section>
      </main>

      <LandingFooter />
      <CookieConsent />
    </LandingShell>
    </LegalDialogProvider>
    </AboutUsProvider>
  );
}
