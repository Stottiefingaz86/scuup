"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarketFlag } from "@/components/circle-market-flag";
import { MARKET_OPTIONS } from "@/lib/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const GEO_MARKETS = MARKET_OPTIONS.filter((m) => m.geo);
const ROW_COUNT = 4;

function splitIntoRows<T>(items: T[], rows: number): T[][] {
  const buckets = Array.from({ length: rows }, () => [] as T[]);
  items.forEach((item, i) => buckets[i % rows].push(item));
  return buckets;
}

function MarketCircle({
  market,
}: {
  market: (typeof GEO_MARKETS)[number];
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        className="block shrink-0 overflow-hidden rounded-full shadow-[0_2px_12px_-4px_rgba(0,0,0,0.55)] ring-1 ring-white/10 transition-[transform,box-shadow] duration-300 hover:scale-110 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.65)] hover:ring-white/25 sm:hover:scale-[1.08]"
      >
        <CircleMarketFlag market={market} size={56} />
        <span className="sr-only">{market.label}</span>
      </TooltipTrigger>
      <TooltipContent side="top">{market.label}</TooltipContent>
    </Tooltip>
  );
}

function MarqueeRow({
  markets,
  reverse,
  duration,
  parallax,
  visible,
  rowIndex,
}: {
  markets: (typeof GEO_MARKETS)[number][];
  reverse: boolean;
  duration: number;
  parallax: number;
  visible: boolean;
  rowIndex: number;
}) {
  const loop = [...markets, ...markets];

  return (
    <div
      className={cn(
        "marquee-edge-fade overflow-hidden py-2 transition-all duration-700 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      )}
      style={{ transitionDelay: `${rowIndex * 100}ms` }}
    >
      <div
        className="will-change-transform"
        style={{ transform: `translateX(${parallax}px)` }}
      >
        <div
          className={cn(
            "flex w-max items-center gap-3 px-1 sm:gap-4",
            reverse ? "animate-marquee-reverse" : "animate-marquee",
            "motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-2"
          )}
          style={
            {
              "--marquee-duration": `${duration}s`,
            } as React.CSSProperties
          }
        >
          {loop.map((market, i) => (
            <MarketCircle key={`${market.geo}-${i}`} market={market} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function MarketsMarquee() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [scrollShift, setScrollShift] = useState(0);

  const rows = useMemo(() => splitIntoRows(GEO_MARKETS, ROW_COUNT), []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(el);

    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh;
      const end = -rect.height;
      const raw = (start - rect.top) / (start - end);
      setScrollShift(Math.max(0, Math.min(1, raw)));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const rowConfigs = [
    { reverse: false, duration: 52, parallaxMult: -48 },
    { reverse: true, duration: 62, parallaxMult: 64 },
    { reverse: false, duration: 46, parallaxMult: -72 },
    { reverse: true, duration: 58, parallaxMult: 56 },
  ] as const;

  return (
    <TooltipProvider delay={120}>
      <section
        ref={sectionRef}
        className="relative overflow-hidden border-t border-border py-20 sm:py-28"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_100%,oklch(0.77_0.15_163_/_8%),transparent)]"
        />

        <div className="relative mx-auto w-full max-w-7xl px-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brand">
              Markets
            </p>
            <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              Audit from the market your players are in
            </h2>
            <p className="mt-4 text-muted-foreground">
              Sessions browse through local residential connections — so
              geo-gated offers, payment rails and licensing walls match exactly
              what a local player sees.
            </p>
            <p className="mt-6 text-sm font-medium tabular-nums text-foreground/80">
              {GEO_MARKETS.length} markets
              <span className="mx-2 text-muted-foreground/40">·</span>
              <span className="font-normal text-muted-foreground">
                residential proxy routing
              </span>
            </p>
          </div>
        </div>

        <div className="relative mt-12 flex flex-col gap-1 sm:mt-14 sm:gap-2">
          {rows.map((rowMarkets, i) => {
            const cfg = rowConfigs[i];
            const parallax = (scrollShift - 0.5) * cfg.parallaxMult;
            return (
              <MarqueeRow
                key={i}
                markets={rowMarkets}
                reverse={cfg.reverse}
                duration={cfg.duration}
                parallax={parallax}
                visible={visible}
                rowIndex={i}
              />
            );
          })}
        </div>
      </section>
    </TooltipProvider>
  );
}
