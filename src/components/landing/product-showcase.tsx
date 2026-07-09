"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { LandingShell } from "@/components/landing/landing-shell";
import { ScuupMark } from "@/components/landing/scuup-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { MARKETS } from "@/lib/constants";
import {
  HEURISTIC_COUNT,
  HowItWorks,
  ScoringScale,
  WhatWeMeasure,
  WhatYouGet,
} from "@/components/landing/landing-explainer";

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "",
    description: "Your first market read",
    features: [
      "1 full audit report",
      "You + up to 3 sites",
      "All public journeys",
      "Evidence & scorecard",
    ],
    cta: "Start free audit",
    href: "/projects/new",
    variant: "outline" as const,
  },
  {
    name: "Pro",
    price: "$249",
    period: "/ month",
    description: "Ongoing competitive tracking",
    features: [
      "Unlimited reports",
      "Logged-in journey audits",
      "Action plan synthesis",
      "Priority analysis queue",
    ],
    cta: "Upgrade to Pro",
    href: "/upgrade",
    variant: "default" as const,
    highlight: true,
  },
];

export function LandingShowcase() {
  return (
    <LandingShell>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-8 px-6 py-4">
          <Link href="/">
            <ScuupMark />
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#measure" className="hover:text-foreground">
              What we measure
            </a>
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <a href="#report" className="hover:text-foreground">
              Your report
            </a>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>
              Log in
            </Button>
            <Button nativeButton={false} render={<Link href="/projects/new" />}>
              Start audit
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto w-full max-w-7xl px-6 pb-20 pt-16 sm:pb-28 sm:pt-24">
          <div className="flex max-w-3xl flex-col gap-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Competitor intelligence for iGaming
            </p>
            <h1 className="font-heading text-4xl font-semibold leading-[1.08] tracking-tight text-balance sm:text-5xl lg:text-[3.25rem]">
              Player journey audits — scored, compared, evidenced
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Scuup walks sign-up, casino, rewards, cashier and more on your site
              and up to three others. Every score is 0–100 on the same{" "}
              {HEURISTIC_COUNT} iGaming heuristics, with screenshots attached.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" nativeButton={false} render={<Link href="/projects/new" />}>
                Run your free audit
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={<Link href="#measure" />}
              >
                See what we measure
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              1 full report free · you + up to 3 sites · no credit card
            </p>
            <p className="text-sm tabular-nums text-muted-foreground">
              9 journey areas · {HEURISTIC_COUNT} heuristics · 4 sites · &lt;1hr
              to first results
            </p>
          </div>
        </section>

        <WhatWeMeasure />
        <HowItWorks />
        <WhatYouGet />
        <ScoringScale />

        <section className="mx-auto w-full max-w-7xl border-t border-border px-6 py-20 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Markets
            </p>
            <h2 className="mt-3 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Audit from the market your players are in
            </h2>
            <p className="mt-3 text-muted-foreground">
              Sessions browse from the region you pick — geo-gated offers and
              payment rails match what a local player sees.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {MARKETS.map((m) => (
              <Badge key={m} variant="outline" className="px-3 py-1 font-normal">
                {m}
              </Badge>
            ))}
          </div>
        </section>

        <section id="pricing" className="border-t border-border bg-muted/40 py-20 sm:py-28">
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="max-w-xl">
              <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                Pricing
              </h2>
              <p className="mt-3 text-muted-foreground">
                One full audit on us — then unlimited reports on Pro.
              </p>
            </div>

            <div className="mt-12 grid max-w-4xl gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
              {PRICING.map((plan) => (
                <div
                  key={plan.name}
                  className={cn(
                    "flex flex-col bg-background p-8",
                    plan.highlight && "bg-muted/30"
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-heading text-lg font-semibold">{plan.name}</h3>
                    {plan.highlight ? (
                      <Badge variant="secondary" className="font-normal">
                        Recommended
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                  <p className="mt-6 font-heading text-4xl font-semibold tabular-nums">
                    {plan.price}
                    {plan.period ? (
                      <span className="text-base font-normal text-muted-foreground">
                        {plan.period}
                      </span>
                    ) : null}
                  </p>
                  <ul className="mt-8 flex flex-1 flex-col gap-2.5 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-muted-foreground">
                        <Check className="mt-0.5 size-4 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-8 w-full sm:w-auto"
                    variant={plan.variant}
                    nativeButton={false}
                    render={<Link href={plan.href} />}
                  >
                    {plan.cta}
                    {plan.highlight ? <ArrowUpRight data-icon="inline-end" /> : null}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-6 py-20 sm:flex-row sm:items-center sm:justify-between sm:py-24">
            <div className="max-w-lg">
              <h2 className="font-heading text-2xl font-semibold tracking-tight">
                Know where you stand before your next release.
              </h2>
              <p className="mt-3 text-muted-foreground">
                You vs the rest of your market — in under an hour.
              </p>
            </div>
            <Button size="lg" nativeButton={false} render={<Link href="/projects/new" />}>
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
              Competitor CX intelligence for iGaming operators.
            </p>
          </div>
          <Separator />
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            Compliant market research. Scuup pauses at CAPTCHAs, KYC and payment
            confirmation — no real money moves.
          </p>
        </div>
      </footer>
    </LandingShell>
  );
}
