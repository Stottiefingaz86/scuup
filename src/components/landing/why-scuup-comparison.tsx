"use client";

import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Check,
  Clock,
  Globe2,
  LogIn,
  MessagesSquare,
  X,
} from "lucide-react";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { cn } from "@/lib/utils";

const ROWS: {
  capability: string;
  icon: LucideIcon;
  old: string;
  scuup: string;
}[] = [
  {
    capability: "Evidence",
    icon: Camera,
    old: "Opinion decks and screenshots someone remembered to take",
    scuup: "A screenshot behind every number. Nothing is estimated.",
  },
  {
    capability: "Market view",
    icon: Globe2,
    old: "One market, audited once, stale in a quarter",
    scuup: "Any of 40 markets through local residential browsing, re-runnable on demand",
  },
  {
    capability: "Logged-in coverage",
    icon: LogIn,
    old: "Rarely. Nobody wants to register 5 accounts by hand.",
    scuup: "Agents register real test accounts and walk deposit, rewards and account flows",
  },
  {
    capability: "Player voice",
    icon: MessagesSquare,
    old: "Surveys and panels, weeks later",
    scuup: "Live public reviews cross-checked against what the audit measured",
  },
  {
    capability: "Time to first read",
    icon: Clock,
    old: "6–8 weeks and a workshop",
    scuup: "Under an hour, then a living workspace",
  },
];

function ComparisonRow({
  row,
  index,
}: {
  row: (typeof ROWS)[number];
  index: number;
}) {
  const Icon = row.icon;

  return (
    <li className="group overflow-hidden rounded-xl border border-border/80 bg-background/50 transition-colors hover:border-primary/25 hover:bg-background/80">
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5 sm:px-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-brand">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-semibold sm:text-base">
            {row.capability}
          </p>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground/50">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <div className="grid md:grid-cols-2">
        <div className="border-b border-border/60 px-4 py-4 sm:px-5 md:border-b-0 md:border-r">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Agency audit / DIY
          </p>
          <p className="mt-2 flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
            <X
              className="mt-0.5 size-4 shrink-0 text-tier-1/80"
              aria-hidden
            />
            <span>{row.old}</span>
          </p>
        </div>

        <div className="relative bg-brand/[0.04] px-4 py-4 sm:px-5">
          <div
            aria-hidden
            className="absolute inset-y-0 start-0 hidden w-0.5 bg-brand/50 md:block"
          />
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-brand">
            Scuup
          </p>
          <p className="mt-2 flex items-start gap-2.5 text-sm leading-relaxed text-foreground/90">
            <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            <span>{row.scuup}</span>
          </p>
        </div>
      </div>
    </li>
  );
}

export function WhyScuupComparison() {
  return (
    <section id="compare" className="border-y border-border bg-card/40 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start lg:gap-16 xl:grid-cols-[minmax(0,26rem)_1fr]">
          <LandingReveal className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brand">
              Why Scuup
            </p>
            <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Built for how iGaming actually competes
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Agency CX audits are slow, expensive and opinion-shaped. Generic
              analytics tools don&apos;t know what a betslip or a rakeback loop
              is. Scuup is purpose-built for operator benchmarking.
            </p>

            <div className="mt-8 hidden rounded-xl border border-border/80 bg-background/40 p-4 lg:block">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Typical audit
                  </p>
                  <p className="mt-1.5 font-heading text-lg font-semibold text-muted-foreground">
                    6–8 weeks
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Workshop deck, then stale
                  </p>
                </div>
                <div className="border-s border-border/60 ps-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-brand">
                    With Scuup
                  </p>
                  <p className="mt-1.5 font-heading text-lg font-semibold text-brand">
                    Under an hour
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Live workspace, re-runnable
                  </p>
                </div>
              </div>
            </div>
          </LandingReveal>

          <LandingReveal delay={100}>
            <ul className="flex flex-col gap-3 sm:gap-3.5">
              {ROWS.map((row, index) => (
                <ComparisonRow key={row.capability} row={row} index={index} />
              ))}
            </ul>

            <p
              className={cn(
                "mt-6 rounded-xl border border-dashed border-border/80 bg-muted/10 px-4 py-3.5 text-center text-sm leading-relaxed text-muted-foreground lg:hidden"
              )}
            >
              Typical agency audit:{" "}
              <span className="font-medium text-foreground/80">6–8 weeks</span>
              {" · "}
              Scuup first read:{" "}
              <span className="font-medium text-brand">under an hour</span>
            </p>
          </LandingReveal>
        </div>
      </div>
    </section>
  );
}
