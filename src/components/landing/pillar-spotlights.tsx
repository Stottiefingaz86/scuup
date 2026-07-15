"use client";

import { MessagesSquare, Palette, Star } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { faviconUrl } from "@/lib/constants";
import type { BrandRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const SPOTLIGHT_BRANDS = {
  rainbet: {
    name: "Rainbet",
    favicon: faviconUrl("https://rainbet.com", 64),
    role: "competitor" as BrandRole,
  },
  stake: {
    name: "Stake",
    favicon: faviconUrl("https://stake.com", 64),
    role: "competitor" as BrandRole,
  },
};

/* ------------------------------------------------------------------ */
/* Landing spotlights for the two pillars nobody else audits: voice of */
/* customer and the design review. Each block pairs the pitch with a   */
/* faithful mock of the real report card so buyers see the deliverable.*/
/* ------------------------------------------------------------------ */

const VOC_PRAISE = [
  { theme: "Fast crypto withdrawals", mentions: 41 },
  { theme: "Generous rakeback loop", mentions: 28 },
  { theme: "24/7 live chat actually answers", mentions: 19 },
];

const VOC_COMPLAINTS = [
  { theme: "KYC delays on big wins", mentions: 23 },
  { theme: "Bonus wagering terms unclear", mentions: 17 },
  { theme: "Sports market depth", mentions: 9 },
];

const VOC_ALIGNMENT = [
  {
    verdict: "confirms" as const,
    note: "Cashier scored 82 in the audit, and players echo the fast payouts in reviews.",
  },
  {
    verdict: "contradicts" as const,
    note: "Rewards hub scored well on visibility, but players call the wagering terms confusing.",
  },
];

const DESIGN_PALETTE = [
  "#0f212e",
  "#1a2c38",
  "#213743",
  "#2f4553",
  "#00e701",
  "#ffffff",
];

const DESIGN_IMPROVEMENTS = [
  "Muted body text fails AA contrast on the lobby: 3.8:1 against the card surface.",
  "Betslip and casino use different button radii and focus states. One system, two dialects.",
];

function SpotlightCopy({
  icon: Icon,
  kicker,
  title,
  description,
  delay = 0,
}: {
  icon: typeof MessagesSquare;
  kicker: string;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <LandingReveal delay={delay} className="flex flex-col gap-4">
      <span className="flex size-10 items-center justify-center rounded-lg border border-border/80 bg-card/50 text-brand">
        <Icon className="size-5" />
      </span>
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brand">
        {kicker}
      </p>
      <h3 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {title}
      </h3>
      <p className="text-base leading-relaxed text-muted-foreground">
        {description}
      </p>
    </LandingReveal>
  );
}

function FloatingSpotlightCard({
  children,
  delayed = false,
}: {
  children: React.ReactNode;
  delayed?: boolean;
}) {
  return (
    <LandingReveal delay={delayed ? 120 : 0} className="relative isolate">
      <div
        aria-hidden
        className={cn(
          "landing-orb absolute -inset-6 -z-10 sm:-inset-10",
          delayed && "landing-orb-delayed",
        )}
      />
      <div
        className={cn(
          "landing-float-card transition-shadow duration-500 hover:shadow-[0_28px_70px_-36px_oklch(0.77_0.15_163/0.35)]",
          delayed && "landing-float-card-delayed",
        )}
      >
        {children}
      </div>
    </LandingReveal>
  );
}

function VocCard() {
  const split = { positive: 78, neutral: 9, negative: 13 };
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/50 p-6 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-3">
        <BrandMark brand={SPOTLIGHT_BRANDS.rainbet} className="size-6" />
        <span className="font-medium">Rainbet</span>
        <span className="inline-flex items-center gap-1 font-heading text-base font-semibold text-foreground">
          <Star className="size-4 fill-brand/80 text-brand" />
          4.3
        </span>
        <span className="text-xs text-muted-foreground">
          180 recent of 5,214 reviews
        </span>
      </div>

      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted/30"
        aria-hidden
      >
        <div className="bg-brand/90" style={{ width: `${split.positive}%` }} />
        <div className="bg-brand/35" style={{ width: `${split.neutral}%` }} />
        <div
          className="bg-muted-foreground/25"
          style={{ width: `${split.negative}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {split.positive}% positive · {split.neutral}% neutral ·{" "}
        {split.negative}% negative
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand/90">
            Customers praise
          </span>
          <ul className="flex flex-col gap-1">
            {VOC_PRAISE.map((t) => (
              <li key={t.theme} className="text-xs leading-relaxed text-muted-foreground">
                {t.theme}{" "}
                <span className="text-muted-foreground/50">({t.mentions})</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Needs attention
          </span>
          <ul className="flex flex-col gap-1">
            {VOC_COMPLAINTS.map((t) => (
              <li key={t.theme} className="text-xs leading-relaxed text-muted-foreground">
                {t.theme}{" "}
                <span className="text-muted-foreground/50">({t.mentions})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5 border-t border-border/70 pt-3">
        {VOC_ALIGNMENT.map((a) => (
          <li
            key={a.note}
            className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
          >
            <span
              className={cn(
                "mt-1.5 size-1 shrink-0 rounded-full",
                a.verdict === "confirms" ? "bg-brand" : "bg-muted-foreground/45",
              )}
            />
            <span>
              <span
                className={cn(
                  "font-medium",
                  a.verdict === "confirms"
                    ? "text-brand"
                    : "text-foreground/75",
                )}
              >
                {a.verdict === "confirms" ? "Confirms" : "Contradicts"}
              </span>
              : {a.note}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DesignCard() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/50 p-6 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-3">
        <BrandMark brand={SPOTLIGHT_BRANDS.stake} className="size-6" />
        <span className="font-medium">Stake</span>
        <span className="font-heading text-base font-semibold tabular-nums">
          74/100
        </span>
        <span className="text-xs text-muted-foreground">
          Dark mode · Next.js · Tailwind
        </span>
      </div>

      <div
        className="flex h-8 w-full overflow-hidden rounded-md border border-border/70 opacity-90"
        aria-hidden
      >
        {DESIGN_PALETTE.map((hex) => (
          <div
            key={hex}
            className="min-w-0 flex-1"
            style={{ backgroundColor: hex }}
            title={hex}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Real palette sampled from the rendered page, biggest coverage first.
      </p>

      <div className="grid gap-x-6 gap-y-1 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2">
        <span>
          Accessibility{" "}
          <span className="font-medium text-foreground">68/100</span> · 2 measured
          contrast failures
        </span>
        <span>
          Consistency{" "}
          <span className="font-medium text-foreground">81/100</span> · branding
          holds across journeys
        </span>
      </div>

      <ul className="flex flex-col gap-1.5 border-t border-border/70 pt-3">
        {DESIGN_IMPROVEMENTS.map((s) => (
          <li
            key={s}
            className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
          >
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand/50" />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PillarSpotlights() {
  return (
    <section id="beyond" className="mx-auto w-full max-w-7xl px-6 py-20 sm:py-28">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <SpotlightCopy
          icon={MessagesSquare}
          kicker="Voice of customer"
          title="What players say, checked against what we measured"
          description="Recent public reviews, scraped and themed. Every complaint and every bit of praise is cross-checked against the audit: does it confirm the score or contradict it?"
        />
        <FloatingSpotlightCard>
          <VocCard />
        </FloatingSpotlightCard>
      </div>

      <div className="mt-20 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="lg:order-2">
          <SpotlightCopy
            icon={Palette}
            kicker="Design review"
            title="A design audit taken from the live code"
            description="Stack fingerprinted from the rendered code, palette sampled from real pixels, accessibility measured in contrast ratios, and a design-director critique of every screen."
            delay={80}
          />
        </div>
        <div className="lg:order-1">
          <FloatingSpotlightCard delayed>
            <DesignCard />
          </FloatingSpotlightCard>
        </div>
      </div>
    </section>
  );
}
