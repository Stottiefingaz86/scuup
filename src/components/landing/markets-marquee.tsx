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
const ROW_COUNT = 3;
/** Enough circles to cover ultra-wide viewports in one marquee loop half. */
const MIN_FLAGS_PER_ROW = 28;

function splitIntoRows<T>(items: T[], rows: number): T[][] {
  const perRow = Math.ceil(items.length / rows);
  return Array.from({ length: rows }, (_, i) =>
    items.slice(i * perRow, (i + 1) * perRow)
  ).filter((row) => row.length > 0);
}

function repeatToMinLength<T>(items: T[], minLength: number): T[] {
  if (items.length === 0) return [];
  const out: T[] = [];
  while (out.length < minLength) out.push(...items);
  return out;
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
        <CircleMarketFlag market={market} size={80} />
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
  const padded = repeatToMinLength(markets, MIN_FLAGS_PER_ROW);
  const loop = [...padded, ...padded];

  return (
    <div
      className={cn(
        "marquee-edge-fade overflow-hidden py-1.5 transition-all duration-700 ease-out motion-reduce:hidden sm:py-2",
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
            "flex w-max items-center gap-2 px-1 sm:gap-3",
            reverse ? "animate-marquee-reverse" : "animate-marquee",
            "motion-reduce:hidden"
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

export function MarketsMarquee({ compactTop = false }: { compactTop?: boolean }) {
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
  ] as const;

  return (
    <TooltipProvider delay={120}>
      <section
        ref={sectionRef}
        className={cn(
          "relative overflow-hidden border-y border-border",
          compactTop ? "pb-14 pt-8 sm:pb-20 sm:pt-10" : "py-20 sm:py-28"
        )}
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
            <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:mt-3 sm:text-3xl">
              Audit from the market your players are in
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:mt-4 sm:text-base">
              Sessions browse through local residential connections, so
              geo-gated offers, payment rails and licensing walls match exactly
              what a local player sees.
            </p>
            <p className="mt-4 text-sm font-medium tabular-nums text-foreground/80 sm:mt-5">
              {GEO_MARKETS.length} markets
              <span className="mx-2 text-muted-foreground/40">·</span>
              <span className="font-normal text-muted-foreground">
                residential proxy routing
              </span>
            </p>
          </div>
        </div>

        <div className="relative mt-8 flex flex-col gap-0.5 sm:mt-10 sm:gap-1">
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
          <div className="hidden grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-3 px-6 py-4 motion-reduce:grid">
            {GEO_MARKETS.map((market) => (
              <MarketCircle key={market.geo} market={market} />
            ))}
          </div>
        </div>
      </section>
    </TooltipProvider>
  );
}
