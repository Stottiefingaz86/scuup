"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  RotateCcw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { CircleMarketFlag } from "@/components/circle-market-flag";
import { MarketTag } from "@/components/market-tag";
import { PillarRow } from "@/components/brand-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { ScoreGauge } from "@/components/score-gauge";
import { marketOptionForLabel } from "@/lib/constants";
import { brandSiteOutboundUrl } from "@/lib/brand-outbound";
import { cn } from "@/lib/utils";
import {
  formatMonthLabel,
  pillarsFromShowcaseEntry,
  type ShowcaseEntry,
  type ShowcaseSort,
} from "@/lib/showcase";

const SORT_OPTIONS: { value: ShowcaseSort; label: string }[] = [
  { value: "score", label: "Highest score" },
  { value: "trending_up", label: "Trending up" },
  { value: "trending_down", label: "Trending down" },
  { value: "big_movers", label: "Big movers" },
];

function MarketFilterLabel({ market }: { market: string }) {
  if (market === "all") {
    return (
      <>
        <Globe className="size-4 shrink-0 text-muted-foreground sm:size-3.5" />
        <span className="truncate">All markets</span>
      </>
    );
  }
  const opt = marketOptionForLabel(market);
  return (
    <>
      <CircleMarketFlag
        market={opt}
        size={16}
        className="shrink-0 ring-1 ring-black/10"
      />
      <span className="truncate">{market}</span>
    </>
  );
}

function ShowcaseFilters({
  markets,
  months,
  market,
  month,
  sort,
  onMarketChange,
  onMonthChange,
  onSortChange,
  onReset,
  hasActiveFilters,
  onScrollLeft,
  onScrollRight,
}: {
  markets: string[];
  months: string[];
  market: string;
  month: string;
  sort: ShowcaseSort;
  onMarketChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onSortChange: (value: ShowcaseSort) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  onScrollLeft: () => void;
  onScrollRight: () => void;
}) {
  const sortLabel =
    SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort";
  const monthLabel = month ? formatMonthLabel(month) : "Latest month";
  const latestMonth = months[0] ?? "";
  const marketActive = market !== "all";
  const monthActive = month !== "" && month !== latestMonth;
  const sortActive = sort !== "score";

  const desktopTriggerClass =
    "h-8 w-auto min-w-[148px] justify-start gap-2 bg-background/80 px-2.5 max-sm:size-9 max-sm:min-w-0 max-sm:shrink-0 max-sm:justify-center max-sm:gap-0 max-sm:px-0 max-sm:[&>svg:last-child]:hidden";
  const mobileActiveClass = "max-sm:bg-primary/10 max-sm:ring-1 max-sm:ring-primary/35";

  const marketMobileIcon =
    market === "all" ? (
      <Globe className="size-4 text-muted-foreground" />
    ) : (
      <CircleMarketFlag
        market={marketOptionForLabel(market)}
        size={18}
        className="ring-1 ring-black/10"
      />
    );

  return (
    <div className="flex items-center gap-1.5 sm:flex-wrap sm:rounded-xl sm:border sm:border-border/80 sm:bg-muted/15 sm:p-2.5 sm:gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:flex-wrap sm:gap-2">
        <Select value={market} onValueChange={(v) => onMarketChange(v ?? "all")}>
          <SelectTrigger
            className={cn(
              desktopTriggerClass,
              marketActive && mobileActiveClass
            )}
            aria-label={
              market === "all"
                ? "Filter by market: all markets"
                : `Filter by market: ${market}`
            }
          >
            <span className="sm:hidden">{marketMobileIcon}</span>
            <span className="hidden sm:contents">
              <MarketFilterLabel market={market} />
            </span>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="all">
              <Globe className="size-3.5 text-muted-foreground" />
              All markets
            </SelectItem>
            {markets.map((m) => {
              const opt = marketOptionForLabel(m);
              return (
                <SelectItem key={m} value={m}>
                  <CircleMarketFlag
                    market={opt}
                    size={16}
                    className="ring-1 ring-black/10"
                  />
                  {m}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Select
          value={month || months[0] || ""}
          onValueChange={(v) => v && onMonthChange(v)}
        >
          <SelectTrigger
            className={cn(
              desktopTriggerClass,
              monthActive && mobileActiveClass
            )}
            aria-label={`Filter by month: ${monthLabel}`}
          >
            <Calendar className="size-4 shrink-0 text-muted-foreground sm:size-3.5" />
            <span className="hidden truncate sm:inline">{monthLabel}</span>
          </SelectTrigger>
          <SelectContent align="start">
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {formatMonthLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sort}
          onValueChange={(v) => v && onSortChange(v as ShowcaseSort)}
        >
          <SelectTrigger
            className={cn(
              desktopTriggerClass,
              sortActive && mobileActiveClass
            )}
            aria-label={`Sort benchmarks: ${sortLabel}`}
          >
            <ArrowUpDown className="size-4 shrink-0 text-muted-foreground sm:size-3.5" />
            <span className="hidden truncate sm:inline">{sortLabel}</span>
          </SelectTrigger>
          <SelectContent align="start">
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-9 shrink-0 text-muted-foreground sm:size-8 sm:w-auto sm:px-2"
            aria-label="Reset filters"
            onClick={onReset}
          >
            <RotateCcw className="size-4" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="size-9 sm:size-8"
          aria-label="Scroll left"
          onClick={onScrollLeft}
        >
          <ChevronLeft />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="size-9 sm:size-8"
          aria-label="Scroll right"
          onClick={onScrollRight}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

function TrendBadge({ entry }: { entry: ShowcaseEntry }) {
  if (entry.scoreDelta === null) {
    return (
      <p className="text-center text-[10px] text-muted-foreground">
        New this month
      </p>
    );
  }
  if (entry.scoreDelta === 0) {
    return (
      <p className="text-center text-[10px] text-muted-foreground">
        No change vs last month
      </p>
    );
  }
  const up = entry.scoreDelta > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <p
      className={cn(
        "flex items-center justify-center gap-1 text-[11px] font-medium tabular-nums",
        up ? "text-brand" : "text-tier-1"
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {up ? "+" : ""}
      {entry.scoreDelta} since last month
    </p>
  );
}

function ShowcaseCard({
  entry,
  rank,
  onViewJourneys,
}: {
  entry: ShowcaseEntry;
  rank: number;
  onViewJourneys: (entry: ShowcaseEntry) => void;
}) {
  const brand = {
    id: String(entry.id),
    name: entry.brandName,
    url: entry.brandUrl,
    favicon: entry.favicon,
    role: "competitor" as const,
    analyses: {},
  };

  const pillars = pillarsFromShowcaseEntry(entry);
  const scoredPillars = pillars.filter((p) => p.score !== null);
  const pendingPillars = pillars.filter((p) => p.score === null);
  const siteUrl = brandSiteOutboundUrl(entry.brandUrl, entry.brandSlug);

  return (
    <Card
      data-showcase-card
      className="group/score flex w-[calc(100vw-3rem)] shrink-0 snap-center flex-col gap-4 overflow-hidden py-4 sm:w-[300px] sm:snap-start"
    >
      <CardHeader className="px-4">
        <div className="flex items-center gap-2.5">
          <BrandMark brand={brand} className="size-8 text-sm" />
          <div className="flex min-w-0 flex-col">
            <CardTitle className="truncate font-heading text-sm">
              {entry.brandName}
            </CardTitle>
            <span className="truncate text-[11px] text-muted-foreground">
              {entry.brandUrl.replace(/^https?:\/\//, "")}
            </span>
          </div>
          <Badge variant="outline" className="ms-auto shrink-0 tabular-nums">
            #{rank}
          </Badge>
        </div>
        <MarketTag market={entry.market} className="mt-2.5 w-fit" />
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 px-4">
        {entry.cxScore !== null ? (
          <ScoreGauge
            score={entry.cxScore}
            size={116}
            caption="Player CX Score"
            muted
            className="mx-auto"
          />
        ) : (
          <div className="mx-auto flex h-[80px] flex-col items-center justify-center gap-1">
            <span className="font-heading text-2xl font-semibold text-muted-foreground/40">
              N/A
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              No successful analysis yet
            </span>
          </div>
        )}

        <TrendBadge entry={entry} />

        <div className="flex flex-col gap-2.5 border-t pt-3.5">
          {pillars.map((p) => (
            <PillarRow key={p.key} pillar={p} muted />
          ))}
          <span className="text-[10px] leading-snug text-muted-foreground/70">
            {entry.cxScore !== null
              ? pendingPillars.length > 0
                ? `Player CX Score = average of ${scoredPillars.length} scored pillar${scoredPillars.length === 1 ? "" : "s"}. ${pendingPillars.map((p) => p.label).join(", ")} pending.`
                : `Player CX Score = average of ${scoredPillars.length} scored pillar${scoredPillars.length === 1 ? "" : "s"}.`
              : "Scores appear as the agent completes its first visits."}
          </span>
        </div>
      </CardContent>

      <CardFooter className="px-4 py-3">
        <div className="flex w-full overflow-hidden rounded-lg border border-border/60 bg-muted/15">
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            title={`Visit ${entry.brandName}`}
            className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap px-2 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
          >
            Site
            <ExternalLink className="size-3 shrink-0 opacity-50" aria-hidden />
          </a>
          <span aria-hidden className="w-px shrink-0 self-stretch bg-border/70" />
          <button
            type="button"
            onClick={() => onViewJourneys(entry)}
            className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap px-2 py-2 text-[11px] font-medium text-foreground transition-colors hover:bg-background/80"
          >
            View Report
            <ArrowRight className="size-3 shrink-0 opacity-50" aria-hidden />
          </button>
        </div>
      </CardFooter>
    </Card>
  );
}

export function ShowcaseCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<ShowcaseEntry[]>([]);
  const [markets, setMarkets] = useState<string[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [market, setMarket] = useState<string>("all");
  const [month, setMonth] = useState<string>("");
  const [sort, setSort] = useState<ShowcaseSort>("score");
  const [loading, setLoading] = useState(true);
  const [gateBrand, setGateBrand] = useState<ShowcaseEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort });
      if (market !== "all") params.set("market", market);
      if (month) params.set("month", month);
      const res = await fetch(`/api/showcase?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setEntries(data.entries ?? []);
      setMarkets(data.markets ?? []);
      setMonths(data.months ?? []);
      if (!month && data.months?.[0]) setMonth(data.months[0]);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [market, month, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const scroll = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-showcase-card]");
    const gap = 16;
    const step = card ? card.offsetWidth + gap : 316;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const latestMonth = months[0] ?? "";
  const hasActiveFilters =
    market !== "all" || sort !== "score" || (month !== "" && month !== latestMonth);

  const resetFilters = () => {
    setMarket("all");
    setSort("score");
    if (latestMonth) setMonth(latestMonth);
  };

  return (
    <section id="showcase" className="border-t border-border bg-background py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brand">
            Live benchmarks
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Every brand we&apos;ve scored
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Real Player CX scores from markets we audit — updated monthly.
            Filter by country, see who&apos;s moving up or down since last
            month, then sign up to walk the full journey evidence yourself.
          </p>
        </div>

        <div className="mt-8 sm:mt-10">
          <ShowcaseFilters
            markets={markets}
            months={months}
            market={market}
            month={month}
            sort={sort}
            onMarketChange={setMarket}
            onMonthChange={setMonth}
            onSortChange={setSort}
            onReset={resetFilters}
            hasActiveFilters={hasActiveFilters}
            onScrollLeft={() => scroll(-1)}
            onScrollRight={() => scroll(1)}
          />
        </div>
      </div>

      <div className="relative mt-6 sm:mt-8">
        {loading ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            Loading benchmarks…
          </p>
        ) : entries.length === 0 ? (
          <div className="mx-6 rounded-xl border border-dashed py-16 text-center sm:mx-auto sm:max-w-7xl">
            <p className="text-muted-foreground">
              No scores for this filter yet — run an audit and it&apos;ll
              appear here.
            </p>
            <Button
              className="mt-4 glow-primary"
              nativeButton={false}
              render={<Link href="/projects/new" />}
            >
              Run your free audit
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-ps-6 scroll-pe-6 px-6 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-auto sm:max-w-7xl sm:scroll-ps-0 sm:scroll-pe-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {entries.map((entry, index) => (
              <ShowcaseCard
                key={`${entry.brandSlug}-${entry.market}-${entry.month}`}
                entry={entry}
                rank={index + 1}
                onViewJourneys={setGateBrand}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={gateBrand !== null} onOpenChange={() => setGateBrand(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              See {gateBrand?.brandName}&apos;s full journey evidence
            </DialogTitle>
            <DialogDescription>
              Screenshots, heuristics and scores for every journey — casino,
              sports, retention, reviews and design. Create a free account to
              open the full report for {gateBrand?.brandName} in{" "}
              {gateBrand?.market}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setGateBrand(null)}>
              Keep browsing
            </Button>
            <Button
              className="glow-primary"
              nativeButton={false}
              render={
                <Link
                  href={`/login?from=showcase&brand=${encodeURIComponent(gateBrand?.brandName ?? "")}`}
                />
              }
            >
              Sign up free
              <ArrowRight data-icon="inline-end" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
