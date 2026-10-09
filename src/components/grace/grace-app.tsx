"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  ExternalLink,
  FileDown,
  Loader2,
  PanelLeft,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  COMPETITOR_SETS,
  POKER_KEYWORDS,
  brandTokensFor,
  competitorNarrative,
  copyContradictsCounts,
  headlineOverclaims,
  isCountRestatement,
  isHollowPraise,
  isJargonLine,
  filterReviews,
  granularityFor,
  mergeScrapes,
  reviewsInMonth,
  reportNarrative,
  reviewMatches,
  reviewStats,
  reviewsSinceDays,
  standaloneScore,
  tagCloud,
  timeline,
  topicBreakdown,
  topicGroupRows,
  topicGroupScores,
  type ReviewStats,
  type TopicRow,
} from "@/lib/grace/analysis";
import {
  classifySnippet,
  isAllPokerFilter,
  isPokerLens,
  needsPokerClassify,
  pokerCohort,
  pokerSignal,
} from "@/lib/grace/poker";
import {
  briefingFromDraft,
  comparableReports,
  addWidgetToPages,
  defaultPresentation,
  persistPresentationTemplate,
  presentationForNewReport,
  newPage,
  defaultReportName,
  hasFullCopy,
  loadActiveReportId,
  loadReports,
  newReportId,
  normalizeLayout,
  persistActiveReportId,
  persistReports,
  type PresentPage,
  type ReportSnapshot,
  type SavedReport,
  type SavedReportSummary,
} from "@/lib/grace/reports";
import { trustpilotSlugFromInput } from "@/lib/grace/slug";
import {
  coerceMonth,
  defaultMonth,
  monthBounds,
  monthLabel,
  previousMonthKey,
  recentMonths,
  type GraceScrape,
  type GraceWindow,
} from "@/lib/grace/types";
import {
  BrandIcon,
  CompetitorLines,
  CompetitorSliders,
  KeywordMentionBars,
  MiniStarBar,
  ReviewsMeter,
  SentimentSlider,
  StarDistribution,
  TimelineChart,
  TopicBars,
  type SeriesBrand,
  type SliderBrand,
} from "./grace-charts";
import { AddWidgetMenu, PresentStage } from "./present-stage";
import { ReviewList } from "./grace-reviews";
import { GraceChat } from "./grace-chat";
import { ReviewModal } from "./review-modal";
import { TagCloud } from "./tag-cloud";
import { ScorePair, TpStars } from "./tp-stars";
import type { GraceReview } from "@/lib/grace/types";

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

const CACHE_KEY = "grace:scrapes:v1";
const STATE_KEY = "grace:state:v1";
const MAX_CACHED = 14;

type ScrapeCache = Record<string, GraceScrape>;

/** One 24-month pull per brand — the month slice is client-side. */
function cacheKey(slug: string): string {
  return `${slug}|24m`;
}

function findCacheKey(cache: ScrapeCache, slug: string): string | null {
  const preferred = cacheKey(slug);
  if (cache[preferred]) return preferred;
  const hit = Object.entries(cache).find(([, s]) => s.slug === slug);
  return hit?.[0] ?? null;
}

function loadCache(): ScrapeCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as ScrapeCache) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: ScrapeCache) {
  // Trim oldest first, then retry smaller if the quota bites.
  let entries = Object.entries(cache).sort(
    (a, b) => Date.parse(b[1].fetchedAt) - Date.parse(a[1].fetchedAt),
  );
  entries = entries.slice(0, MAX_CACHED);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
      return;
    } catch {
      entries = entries.slice(0, Math.max(1, Math.floor(entries.length / 2)));
    }
  }
}

interface PersistedState {
  current: string | null;
  window: GraceWindow;
  keywords: string[];
  customKeywords: string[];
  rivals: string[];
  competitorSet: string;
}

const PALETTE = ["#00b67a", "#191919", "#54b8ff", "#ff8622", "#73cf11", "#8b5cf6", "#ffce00"];

function DashRewrite({
  label,
  text,
  field,
  brand,
  facts,
  onSave,
}: {
  label?: string;
  text: string;
  field: string;
  brand: string;
  facts: {
    month: string;
    reviewCount: number;
    avgRating: number;
    sentiment: number;
    filter: string;
  };
  onSave: (next: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/grace/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, field, brand, facts }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Rewrite failed");
      onSave(String(data.text ?? ""));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Rewrite failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
      {label ? <p className="text-[13px] font-semibold text-[#191919]">{label}</p> : <span />}
      <button
        type="button"
        className="gr-chip h-7! px-2! text-[11px]!"
        disabled={busy || !text.trim()}
        onClick={() => void run()}
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
        Rewrite
      </button>
      {err ? <p className="w-full text-[11px] text-[#ff3722]">{err}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

type ReviewTab = "all" | "positive" | "negative";
type MatchTone = "all" | "positive" | "neutral" | "negative";
type MatchStar = 0 | 1 | 2 | 3 | 4 | 5;

export function GraceApp() {
  const [cache, setCache] = useState<ScrapeCache>({});
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [window_, setWindow] = useState<GraceWindow>(defaultMonth);
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [keywords, setKeywords] = useState<string[]>([]);
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [query, setQuery] = useState("");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("all");
  const [matchTone, setMatchTone] = useState<MatchTone>("all");
  const [matchStar, setMatchStar] = useState<MatchStar>(0);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [competitorSet, setCompetitorSet] = useState<string>("bol");
  const [rivals, setRivals] = useState<string[]>(COMPETITOR_SETS[0].rivals);
  const [newRival, setNewRival] = useState("");
  const [rivalSearchOpen, setRivalSearchOpen] = useState(false);
  const rivalSearchRef = useRef<HTMLInputElement>(null);
  const [rivalBusy, setRivalBusy] = useState<string | null>(null);
  const [rivalErrors, setRivalErrors] = useState<Record<string, string>>({});
  const abortRivals = useRef(false);

  const [summary, setSummary] = useState<SavedReportSummary | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [reports, setReports] = useState<SavedReport[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [reportName, setReportName] = useState("");
  const [modal, setModal] = useState<{ title: string; reviews: GraceReview[] } | null>(null);
  const [compareWithId, setCompareWithId] = useState<string | null>(null);
  const [mode, setMode] = useState<"bench" | "report">("bench");
  const [sideOpen, setSideOpen] = useState(true);
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [briefingStale, setBriefingStale] = useState(false);
  const [layout, setLayout] = useState<PresentPage[]>(defaultPresentation);
  const [templateSaved, setTemplateSaved] = useState(false);

  /* ---- hydrate ---- */
  useEffect(() => {
    const c = loadCache();
    setCache(c);
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Partial<PersistedState>;
        if (s.window) setWindow(coerceMonth(s.window));
        if (s.current && c[s.current]) {
          setCurrent(s.current);
          setInput(c[s.current].slug);
        }
        if (Array.isArray(s.keywords)) setKeywords(s.keywords);
        if (Array.isArray(s.customKeywords)) setCustomKeywords(s.customKeywords);
        if (Array.isArray(s.rivals) && s.rivals.length) setRivals(s.rivals);
        if (s.competitorSet) setCompetitorSet(s.competitorSet);
      }
    } catch {
      /* ignore */
    }
    const saved = loadReports();
    setReports(saved);
    const active = loadActiveReportId();
    const found = saved.find((r) => r.id === active);
    if (found) {
      setActiveReportId(found.id);
      setReportName(found.name);
      setWindow(coerceMonth(found.window));
      setKeywords(found.keywords);
      setCustomKeywords(found.customKeywords);
      setQuery(found.query);
      if (found.rivals.length) setRivals(found.rivals);
      setCompetitorSet(found.competitorSet);
      if (found.summary) setSummary(found.summary);
      setCompareWithId(found.compareWithId ?? null);
      setFeaturedIds(found.featuredIds ?? []);
      setExcludedIds(found.excludedIds ?? []);
      setBriefingStale(false);
      setLayout(
        normalizeLayout(found.layout, {
          brand: found.snapshot?.brand,
          filter: found.snapshot?.filterLabel,
          window: monthLabel(coerceMonth(found.window)),
        }),
      );
      setMode("bench");
      const slugFromKey = found.scrapeKey?.split("|")[0] ?? found.snapshot?.slug ?? null;
      const resolved =
        found.scrapeKey && c[found.scrapeKey]
          ? found.scrapeKey
          : slugFromKey
            ? findCacheKey(c, slugFromKey)
            : null;
      if (resolved && c[resolved]) {
        setCurrent(resolved);
        setInput(c[resolved].slug);
      }
    } else {
      setLayout(presentationForNewReport());
    }
    try {
      const nav = localStorage.getItem("grace:nav");
      if (nav === "closed") setSideOpen(false);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const s: PersistedState = {
      current,
      window: window_,
      keywords,
      customKeywords,
      rivals,
      competitorSet,
    };
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
    try {
      localStorage.setItem("grace:nav", sideOpen ? "open" : "closed");
    } catch {
      /* ignore */
    }
  }, [hydrated, current, window_, keywords, customKeywords, rivals, competitorSet, sideOpen]);

  useEffect(() => {
    const done = () => document.documentElement.classList.remove("grace-exporting");
    window.addEventListener("afterprint", done);
    return () => window.removeEventListener("afterprint", done);
  }, []);

  const putScrape = useCallback((scrape: GraceScrape) => {
    setCache((prev) => {
      const next = { ...prev, [cacheKey(scrape.slug)]: scrape };
      saveCache(next);
      return next;
    });
  }, []);

  const [classifyBusy, setClassifyBusy] = useState<string | null>(null);
  const [classifyError, setClassifyError] = useState<string | null>(null);

  const labelScrape = useCallback(
    async (target: GraceScrape) => {
      const pending = needsPokerClassify(target.reviews, target.pokerById);
      if (!pending.length) return target;
      setClassifyBusy(target.slug);
      setClassifyError(null);
      const labels = { ...(target.pokerById ?? {}) };
      try {
        for (let i = 0; i < pending.length; i += 30) {
          const batch = pending.slice(i, i + 30);
          const res = await fetch("/api/grace/classify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reviews: batch.map((r) => ({ id: r.id, snippet: classifySnippet(r) })),
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error ?? "Classify failed");
          for (const row of data.labels ?? []) {
            if (row && typeof row.id === "string") labels[row.id] = Boolean(row.poker);
          }
          for (const r of batch) if (labels[r.id] == null) labels[r.id] = false;
          putScrape({ ...target, pokerById: { ...labels } });
        }
        const next = { ...target, pokerById: labels };
        return next;
      } catch (e) {
        setClassifyError(e instanceof Error ? e.message : "Classify failed");
        return target;
      } finally {
        setClassifyBusy(null);
      }
    },
    [putScrape],
  );

  const dropScrape = useCallback((key: string) => {
    setCache((prev) => {
      const next = { ...prev };
      delete next[key];
      saveCache(next);
      return next;
    });
    setCurrent((c) => (c === key ? null : c));
  }, []);

  /* ---- scraping ---- */
  const scrapeOne = useCallback(
    async (
      url: string,
      win: GraceWindow,
      extra: { budgetMs?: number; searchTerms?: string[] } = {},
    ): Promise<GraceScrape> => {
      const res = await fetch("/api/grace/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, window: win, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Scrape failed (${res.status})`);
      return data.scrape as GraceScrape;
    },
    [],
  );

  const runMain = useCallback(
    async (force = false) => {
      setError(null);
      let slug: string;
      try {
        slug = trustpilotSlugFromInput(input);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Bad URL");
        return;
      }
      const key = findCacheKey(cache, slug);
      if (!force && key) {
        setCurrent(key);
        setSummary(null);
        setMode("bench");
        return;
      }
      setBusy(`Reading Trustpilot for ${slug} · last 24 months`);
      try {
        const scrape = await scrapeOne(slug, window_);
        putScrape(scrape);
        const nextKey = cacheKey(scrape.slug);
        setCurrent(nextKey);
        setSummary(null);
        setMode("bench");
        if (!reportName.trim()) {
          setReportName(
            defaultReportName({
              brand: scrape.displayName,
              window: monthLabel(window_),
            }),
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Scrape failed");
      } finally {
        setBusy(null);
      }
    },
    [input, window_, cache, scrapeOne, putScrape, reportName],
  );

  const runRivals = useCallback(async () => {
    abortRivals.current = false;
    setRivalErrors({});
    for (const rival of rivals) {
      if (abortRivals.current) break;
      let slug: string;
      try {
        slug = trustpilotSlugFromInput(rival);
      } catch {
        setRivalErrors((p) => ({ ...p, [rival]: "Bad domain" }));
        continue;
      }
      if (findCacheKey(cache, slug)) continue;
      setRivalBusy(slug);
      try {
        const scrape = await scrapeOne(slug, window_, { budgetMs: 120_000 });
        putScrape(scrape);
      } catch (e) {
        setRivalErrors((p) => ({ ...p, [rival]: e instanceof Error ? e.message : "Failed" }));
      }
    }
    setRivalBusy(null);
  }, [rivals, cache, window_, scrapeOne, putScrape]);

  /* ---- derived ---- */
  const scrape = current ? cache[current] : null;

  const [deepBusy, setDeepBusy] = useState(false);
  const deepPull = useCallback(async () => {
    if (!scrape || keywords.length === 0) return;
    setDeepBusy(true);
    setError(null);
    try {
      const extra = await scrapeOne(scrape.slug, scrape.window, {
        searchTerms: keywords.slice(0, 12),
        budgetMs: 240_000,
      });
      putScrape(mergeScrapes(scrape, extra));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deep-pull failed");
    } finally {
      setDeepBusy(false);
    }
  }, [scrape, keywords, scrapeOne, putScrape]);
  const activeKeywords = keywords;
  useEffect(() => {
    setMatchTone("all");
    setMatchStar(0);
    setReviewTab("all");
  }, [activeKeywords, query, window_]);
  const allPresetKeywords = useMemo(
    () => [...POKER_KEYWORDS, ...customKeywords.filter((k) => !POKER_KEYWORDS.includes(k))],
    [customKeywords],
  );

  const excluded = useMemo(() => new Set(excludedIds), [excludedIds]);
  const pokerReviews = useMemo(
    () =>
      scrape
        ? pokerCohort(scrape.reviews, scrape.pokerById).filter((r) => !excluded.has(r.id))
        : [],
    [scrape, excluded],
  );
  const pokerLens = isPokerLens(activeKeywords);
  const allPoker = isAllPokerFilter(activeKeywords);
  const pokerIds = useMemo(() => new Set(pokerReviews.map((r) => r.id)), [pokerReviews]);
  const poker12 = useMemo(() => reviewsSinceDays(pokerReviews, 365), [pokerReviews]);
  const pokerScore = standaloneScore(poker12);
  const brandReviews = useMemo(
    () => (scrape ? scrape.reviews.filter((r) => !excluded.has(r.id)) : []),
    [scrape, excluded],
  );
  const pokerDropped = useMemo(() => {
    if (!scrape) return 0;
    return scrape.reviews.filter(
      (r) => pokerSignal(r) === "maybe" && scrape.pokerById?.[r.id] === false,
    ).length;
  }, [scrape]);
  const windowReviews = useMemo(
    () => (scrape ? reviewsInMonth(scrape.reviews, window_).filter((r) => !excluded.has(r.id)) : []),
    [scrape, window_, excluded],
  );
  const filtered = useMemo(
    () =>
      scrape
        ? filterReviews(scrape.reviews, {
            keywords: activeKeywords,
            query,
            month: window_,
            pokerIds: pokerLens ? pokerIds : undefined,
            allPoker: pokerLens && allPoker,
          }).filter((r) => !excluded.has(r.id))
        : [],
    [scrape, activeKeywords, query, window_, excluded, pokerLens, allPoker, pokerIds],
  );
  const baseline: ReviewStats = useMemo(() => reviewStats(windowReviews), [windowReviews]);
  const captured = windowReviews.length;
  const windowTotal = captured;
  const partial = Boolean(scrape && (scrape.truncated || captured < windowTotal));
  const cappedStars = useMemo(
    () => (scrape?.coverage ?? []).filter((c) => c.captured < c.total),
    [scrape],
  );
  const stats: ReviewStats = useMemo(() => reviewStats(filtered), [filtered]);
  const highlightKeys = useMemo(
    () => (query.trim() ? [...activeKeywords, query.trim()] : activeKeywords),
    [activeKeywords, query],
  );

  const topicRows: TopicRow[] = useMemo(() => {
    if (!scrape) return [];
    return activeKeywords.length > 0
      ? topicBreakdown(filtered, activeKeywords)
      : topicGroupRows(filtered);
  }, [scrape, filtered, activeKeywords]);

  const keywordRows: TopicRow[] = useMemo(
    () => (scrape ? topicBreakdown(filtered, allPresetKeywords) : []),
    [scrape, filtered, allPresetKeywords],
  );

  const granularity = granularityFor(window_);
  const range = monthBounds(window_);
  const points = useMemo(
    () => (scrape ? timeline(filtered, granularity, range.start, range.end) : []),
    [scrape, filtered, granularity, range.start, range.end],
  );

  const cloud = useMemo(
    () => (scrape ? tagCloud(filtered, brandTokensFor(scrape.slug, scrape.displayName)) : []),
    [scrape, filtered],
  );

  const tabReviews = useMemo(() => {
    const sorted = [...windowReviews].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    if (reviewTab === "positive") return sorted.filter((r) => r.rating >= 4);
    if (reviewTab === "negative") return sorted.filter((r) => r.rating <= 2);
    return sorted;
  }, [windowReviews, reviewTab]);
  const matchingIds = useMemo(() => new Set(filtered.map((r) => r.id)), [filtered]);
  const matchToneCounts = useMemo(() => {
    const positive = filtered.filter((r) => r.rating >= 4).length;
    const negative = filtered.filter((r) => r.rating <= 2).length;
    return {
      all: filtered.length,
      positive,
      neutral: filtered.length - positive - negative,
      negative,
    };
  }, [filtered]);
  const matchStarCounts = useMemo(() => {
    const stars: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of filtered) {
      const n = Math.round(r.rating);
      if (n >= 1 && n <= 5) stars[n as 1 | 2 | 3 | 4 | 5] += 1;
    }
    return stars;
  }, [filtered]);
  const matchingList = useMemo(() => {
    return [...filtered]
      .filter((r) => {
        if (matchStar && Math.round(r.rating) !== matchStar) return false;
        if (matchTone === "positive") return r.rating >= 4;
        if (matchTone === "negative") return r.rating <= 2;
        if (matchTone === "neutral") return r.rating > 2 && r.rating < 4;
        return true;
      })
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }, [filtered, matchStar, matchTone]);

  const quotes = useMemo(() => {
    const pos = filtered.filter((r) => r.rating >= 4).sort((a, b) => b.likes - a.likes || b.text.length - a.text.length).slice(0, 5);
    const neg = filtered.filter((r) => r.rating <= 2).sort((a, b) => b.likes - a.likes || b.text.length - a.text.length).slice(0, 6);
    return { pos, neg };
  }, [filtered]);

  const featuredReviews = useMemo(() => {
    const byId = new Map(filtered.map((r) => [r.id, r]));
    return featuredIds.map((id) => byId.get(id)).filter((r): r is GraceReview => Boolean(r)).slice(0, 5);
  }, [filtered, featuredIds]);

  const filterLabel = useMemo(() => {
    if (!activeKeywords.length) return "All reviews";
    if (allPoker) return "Poker";
    if (activeKeywords.length === 1) return activeKeywords[0];
    return `${activeKeywords[0]} +${activeKeywords.length - 1}`;
  }, [activeKeywords, allPoker]);

  const narrative = useMemo(() => {
    if (!scrape) return null;
    return reportNarrative({
      brand: scrape.displayName,
      filterLabel,
      windowLabel: monthLabel(window_),
      stats,
      monthTotal: windowTotal,
      topics: topicRows,
      points,
    });
  }, [scrape, filterLabel, stats, topicRows, points, windowTotal]);

  /* competitors */
  const rivalScrapes = useMemo(
    () =>
      rivals
        .map((r) => {
          try {
            const key = findCacheKey(cache, trustpilotSlugFromInput(r));
            return key ? cache[key] : null;
          } catch {
            return null;
          }
        })
        .filter((s): s is GraceScrape => Boolean(s)),
    [rivals, cache, window_],
  );

  useEffect(() => {
    if (classifyBusy || classifyError) return;
    const queue = [scrape, ...rivalScrapes].filter((s): s is GraceScrape => Boolean(s));
    const next = queue.find((s) => needsPokerClassify(s.reviews, s.pokerById).length);
    if (next) void labelScrape(next);
  }, [scrape, rivalScrapes, classifyBusy, classifyError, labelScrape]);

  const compareBrands = useMemo(() => {
    const list: { scrape: GraceScrape; self: boolean; color: string }[] = [];
    if (scrape) list.push({ scrape, self: true, color: PALETTE[0] });
    rivalScrapes.forEach((s, i) => list.push({ scrape: s, self: false, color: PALETTE[(i + 1) % PALETTE.length] }));
    return list.map((b) => {
      const cohort = pokerCohort(b.scrape.reviews, b.scrape.pokerById);
      const cohortIds = new Set(cohort.map((r) => r.id));
      const raw = filterReviews(b.scrape.reviews, {
        keywords: activeKeywords,
        query,
        month: window_,
        pokerIds: pokerLens ? cohortIds : undefined,
        allPoker: pokerLens && allPoker,
      });
      const f = b.self ? raw.filter((r) => !excluded.has(r.id)) : raw;
      const poker = reviewsSinceDays(b.self ? cohort.filter((r) => !excluded.has(r.id)) : cohort, 365);
      const brandAll = b.self ? b.scrape.reviews.filter((r) => !excluded.has(r.id)) : b.scrape.reviews;
      return {
        ...b,
        filtered: f,
        stats: reviewStats(f),
        all: reviewStats(reviewsInMonth(b.scrape.reviews, window_)),
        brandScore: b.scrape.trustScore,
        brandCount: brandAll.length,
        pokerScore: standaloneScore(poker),
        pokerCount: poker.length,
        pokerReviews: poker,
        groups: topicGroupScores(f),
        points: timeline(f, granularity, range.start, range.end),
      };
    });
  }, [scrape, rivalScrapes, activeKeywords, query, granularity, window_, range.start, range.end, excluded, pokerLens, allPoker]);

  const sliderBrands: SliderBrand[] = compareBrands.map((b) => ({
    id: b.scrape.slug,
    name: b.scrape.displayName,
    color: b.color,
    self: b.self,
    scores: b.groups,
  }));
  const seriesBrands: SeriesBrand[] = compareBrands.map((b) => ({
    id: b.scrape.slug,
    name: b.scrape.displayName,
    color: b.color,
    self: b.self,
    points: b.points,
  }));

  /* ---- actions ---- */
  const toggleKeyword = (k: string) =>
    setKeywords((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  const selectAllPoker = () => setKeywords([...POKER_KEYWORDS]);
  const clearKeywords = () => {
    setKeywords([]);
    setQuery("");
  };
  const addCustomKeyword = () => {
    const k = newKeyword.trim();
    if (!k) return;
    setCustomKeywords((p) => (p.includes(k) ? p : [...p, k]));
    setKeywords((p) => (p.includes(k) ? p : [...p, k]));
    setNewKeyword("");
  };
  const removeCustomKeyword = (k: string) => {
    setCustomKeywords((p) => p.filter((x) => x !== k));
    setKeywords((p) => p.filter((x) => x !== k));
  };

  const applyCompetitorSet = (id: string) => {
    setCompetitorSet(id);
    const set = COMPETITOR_SETS.find((s) => s.id === id);
    if (set) setRivals(set.rivals);
  };

  const buildSnapshot = useCallback((): ReportSnapshot | null => {
    if (!scrape) return null;
    return {
      brand: scrape.displayName,
      slug: scrape.slug,
      window: window_,
      filterLabel,
      fetchedAt: scrape.fetchedAt,
      trustScore: scrape.trustScore,
      stats: {
        count: stats.count,
        avgRating: stats.avgRating,
        sentiment: stats.sentiment,
        positivePct: stats.positivePct,
        negativePct: stats.negativePct,
        neutralPct: stats.count ? Math.round((stats.neutral / stats.count) * 1000) / 10 : 0,
      },
      topics: topicRows.slice(0, 20).map((t) => ({
        topic: t.topic,
        total: t.total,
        positive: t.positive,
        negative: t.negative,
      })),
    };
  }, [scrape, filterLabel, stats, topicRows, window_]);

  const priors = useMemo(
    () => comparableReports(reports, { activeId: activeReportId, slug: scrape?.slug }),
    [reports, activeReportId, scrape?.slug],
  );

  const createReport = async () => {
    if (!scrape || stats.count === 0) return;
    setSummaryBusy(true);
    setSummaryError(null);
    const prevMonth = previousMonthKey(window_);
    const monthPrior = reports.find(
      (r) =>
        r.id !== activeReportId &&
        r.snapshot?.slug === scrape.slug &&
        coerceMonth(r.window) === prevMonth,
    );
    const priorId = compareWithId ?? monthPrior?.id ?? priors[0]?.id ?? null;
    if (priorId && priorId !== compareWithId) setCompareWithId(priorId);
    const prior = reports.find((r) => r.id === priorId && r.snapshot);
    const prevFiltered = filterReviews(scrape.reviews, {
      keywords: activeKeywords,
      query,
      month: prevMonth,
      pokerIds: pokerLens ? pokerIds : undefined,
      allPoker: pokerLens && allPoker,
    });
    const prevStats = reviewStats(prevFiltered);
    const fallback = briefingFromDraft({
      period: narrative?.bullets ?? [],
      mix: `Overall: Positive – ${stats.positivePct}%  |  Neutral – ${
        stats.count ? Math.round((stats.neutral / stats.count) * 1000) / 10 : 0
      }%  |  Negative – ${stats.negativePct}%`,
      positive: narrative?.positive ?? "",
      negative: narrative?.negative ?? "",
      competitor: [],
    });
    let nextSummary = fallback;
    try {
      const res = await fetch("/api/grace/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: scrape.displayName,
          window: monthLabel(window_),
          filterLabel,
          keywords: activeKeywords,
          trustScore: scrape.trustScore,
          pokerScore,
          pokerCount: poker12.length,
          monthTotal: windowTotal,
          stats: {
            count: stats.count,
            avgRating: stats.avgRating,
            sentiment: stats.sentiment,
            positivePct: stats.positivePct,
            negativePct: stats.negativePct,
            neutralPct: stats.count ? Math.round((stats.neutral / stats.count) * 1000) / 10 : 0,
          },
          topics: topicRows.slice(0, 20),
          reviews: [...filtered]
            .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
            .slice(0, 160)
            .map((r) => ({ rating: r.rating, title: r.title, text: r.text, date: r.date })),
          competitors: compareBrands.map((b) => ({
            name: b.scrape.displayName,
            trust: b.scrape.trustScore,
            pokerScore: b.pokerScore,
            pokerCount: b.pokerCount,
            count: b.stats.count,
            sentiment: b.stats.sentiment,
          })),
          previous: prior?.snapshot
            ? { name: prior.name, snapshot: prior.snapshot, copy: prior.summary }
            : prevFiltered.length
              ? {
                  name: `VoC · ${shortName} · ${monthLabel(prevMonth)}`,
                  snapshot: {
                    brand: scrape.displayName,
                    slug: scrape.slug,
                    window: prevMonth,
                    filterLabel,
                    fetchedAt: scrape.fetchedAt,
                    trustScore: scrape.trustScore,
                    stats: {
                      count: prevStats.count,
                      avgRating: prevStats.avgRating,
                      sentiment: prevStats.sentiment,
                      positivePct: prevStats.positivePct,
                      negativePct: prevStats.negativePct,
                      neutralPct: prevStats.count
                        ? Math.round((prevStats.neutral / prevStats.count) * 1000) / 10
                        : 0,
                    },
                    topics: [],
                  },
                  copy: null,
                }
              : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Briefing failed");
      nextSummary = data.summary as SavedReportSummary;
    } catch (e) {
      setSummaryError(
        `${e instanceof Error ? e.message : "Briefing failed"} The report still saved with the numbers from this filter.`,
      );
    }
    setSummary(nextSummary);
    const nextLayout =
      activeReportId && layout.some((p) => p.widgets.length)
        ? layout
        : presentationForNewReport({
            brand: shortName,
            filter: filterLabel,
            window: windowLabel,
          });
    setLayout(nextLayout);
    const seedFeatured =
      featuredIds.length > 0
        ? featuredIds
        : [...quotes.pos.slice(0, 3), ...quotes.neg.slice(0, 2)].map((r) => r.id).slice(0, 5);
    setFeaturedIds(seedFeatured);
    const id = activeReportId ?? newReportId();
    const name =
      reportName.trim() ||
      defaultReportName({
        brand: scrape.displayName,
        filter: filterLabel,
        window: monthLabel(window_),
      });
    const nextReport: SavedReport = {
      id,
      name,
      createdAt: reports.find((r) => r.id === id)?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scrapeKey: current,
      window: window_,
      keywords,
      customKeywords,
      query,
      rivals,
      competitorSet,
      compareWithId: priorId,
      featuredIds: seedFeatured,
      excludedIds,
      layout: nextLayout,
      snapshot: buildSnapshot(),
      summary: nextSummary,
    };
    writeReports([nextReport, ...reports.filter((r) => r.id !== id)], id);
    setReportName(name);
    setMode("report");
    setBriefingStale(false);
    setSummaryBusy(false);
  };

  const snapshotReport = useCallback(
    (id: string, name: string, scrapeKey: string | null): SavedReport => ({
      id,
      name,
      createdAt: reports.find((r) => r.id === id)?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scrapeKey,
      window: window_,
      keywords,
      customKeywords,
      query,
      rivals,
      competitorSet,
      compareWithId,
      featuredIds,
      excludedIds,
      layout: layout.length ? layout : defaultPresentation(),
      snapshot: buildSnapshot(),
      summary,
    }),
    [reports, window_, keywords, customKeywords, query, rivals, competitorSet, compareWithId, featuredIds, excludedIds, layout, buildSnapshot, summary],
  );

  const writeReports = useCallback((next: SavedReport[], active: string | null) => {
    setReports(next);
    persistReports(next);
    setActiveReportId(active);
    persistActiveReportId(active);
  }, []);

  const persistPresent = (partial: Partial<SavedReport>) => {
    if (!activeReportId) return;
    const id = activeReportId;
    setReports((prev) => {
      const next = prev.map((r) =>
        r.id === id ? { ...r, ...partial, updatedAt: new Date().toISOString() } : r,
      );
      persistReports(next);
      return next;
    });
  };

  const persistFeatured = (ids: string[]) => {
    setFeaturedIds(ids);
    persistPresent({ featuredIds: ids });
  };

  const persistExcluded = (ids: string[]) => {
    setExcludedIds(ids);
    persistPresent({ excludedIds: ids });
  };

  const excludeReview = (review: GraceReview) => {
    persistExcluded(excludedIds.includes(review.id) ? excludedIds : [...excludedIds, review.id]);
    if (featuredIds.includes(review.id)) {
      persistFeatured(featuredIds.filter((id) => id !== review.id));
    }
    setBriefingStale(true);
  };

  const restoreExcluded = (id?: string) => {
    persistExcluded(id ? excludedIds.filter((x) => x !== id) : []);
    setBriefingStale(true);
  };

  const pinReview = (review: GraceReview) => {
    if (featuredIds.includes(review.id)) {
      persistFeatured(featuredIds.filter((id) => id !== review.id));
      return;
    }
    if (featuredIds.length < 5) {
      persistFeatured([...featuredIds, review.id]);
      return;
    }
    persistFeatured([...featuredIds.slice(0, 4), review.id]);
  };

  const persistLayout = (next: PresentPage[]) => {
    setLayout(next);
    persistPresent({ layout: next });
  };

  const persistSummary = (next: SavedReportSummary) => {
    setSummary(next);
    persistPresent({ summary: next });
  };

  const saveReport = useCallback(
    (nameOverride?: string) => {
      const scrape = current ? cache[current] : null;
      const name =
        nameOverride?.trim() ||
        reportName.trim() ||
        defaultReportName({
          brand: scrape?.displayName,
          filter: keywords.length ? (keywords.length > 3 ? `${keywords[0]} +${keywords.length - 1}` : keywords.join(", ")) : "All reviews",
          window: monthLabel(window_),
        });
      const id = activeReportId ?? newReportId();
      const nextReport = snapshotReport(id, name, current);
      const next = [nextReport, ...reports.filter((r) => r.id !== id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      writeReports(next, id);
      setReportName(name);
    },
    [current, cache, reportName, keywords, window_, activeReportId, snapshotReport, reports, writeReports],
  );

  const newReport = useCallback(() => {
    setActiveReportId(null);
    persistActiveReportId(null);
    setReportName("");
    setCurrent(null);
    setInput("");
    setKeywords([]);
    setCustomKeywords([]);
    setQuery("");
    setSummary(null);
    setError(null);
    setFiltersOpen(true);
    setCompareWithId(null);
    setFeaturedIds([]);
    setExcludedIds([]);
    setBriefingStale(false);
    setLayout(presentationForNewReport());
    setMode("bench");
  }, []);

  const openReport = useCallback(
    (report: SavedReport) => {
      setActiveReportId(report.id);
      persistActiveReportId(report.id);
      setReportName(report.name);
      setWindow(coerceMonth(report.window));
      setKeywords(report.keywords);
      setCustomKeywords(report.customKeywords);
      setQuery(report.query);
      if (report.rivals.length) setRivals(report.rivals);
      setCompetitorSet(report.competitorSet);
      setSummary(report.summary);
      setCompareWithId(report.compareWithId);
      setFeaturedIds(report.featuredIds ?? []);
      setExcludedIds(report.excludedIds ?? []);
      setBriefingStale(false);
      setLayout(
        normalizeLayout(report.layout, {
          brand: report.snapshot?.brand,
          filter: report.snapshot?.filterLabel,
          window: monthLabel(coerceMonth(report.window)),
        }),
      );
      setMode(hasFullCopy(report.summary) ? "report" : "bench");
      setFiltersOpen(true);
      const slugFromKey = report.scrapeKey?.split("|")[0] ?? report.snapshot?.slug ?? null;
      const resolved = report.scrapeKey && cache[report.scrapeKey]
        ? report.scrapeKey
        : slugFromKey
          ? findCacheKey(cache, slugFromKey)
          : null;
      if (resolved && cache[resolved]) {
        setCurrent(resolved);
        setInput(cache[resolved].slug);
      } else {
        setCurrent(null);
      }
    },
    [cache],
  );

  const deleteReport = useCallback(
    (id: string) => {
      const next = reports.filter((r) => r.id !== id);
      const nextActive = activeReportId === id ? null : activeReportId;
      writeReports(next, nextActive);
      if (activeReportId === id) newReport();
    },
    [reports, activeReportId, writeReports, newReport],
  );

  const exportReport = () => {
    document.documentElement.classList.add("grace-exporting");
    const done = () => {
      document.documentElement.classList.remove("grace-exporting");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  };

  const exportCsv = () => {
    if (!scrape) return;
    const esc = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ["date", "rating", "author", "country", "verified", "title", "text", "replied"].join(","),
      ...filtered.map((r) =>
        [r.date, r.rating, esc(r.author), r.country ?? "", r.verified ? "yes" : "no", esc(r.title), esc(r.text), r.reply ? "yes" : "no"].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${scrape.slug}-${scrape.window}-reviews.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const windowLabel = monthLabel(window_);
  const pokerMonthCount = reviewsInMonth(poker12, window_).length;
  const pullMonths = (() => {
    const times = brandReviews.map((r) => Date.parse(r.date)).filter((n) => !Number.isNaN(n));
    if (!times.length) return 0;
    return Math.max(1, Math.round((Date.now() - Math.min(...times)) / (30.44 * 86_400_000)));
  })();
  const pokerCaption =
    pullMonths >= 10
      ? `${poker12.length.toLocaleString()} poker reviews · last 12 months`
      : `${poker12.length.toLocaleString()} poker reviews in this pull · ${pokerMonthCount} in ${windowLabel}`;
  const filterOn = filterLabel !== "All reviews";
  const briefHead = filterOn
    ? `${windowLabel} · ${stats.count} of ${windowTotal} match ${filterLabel}`
    : summary?.headline?.trim() || `${windowLabel} summary`;
  const matchingLine = filterOn
    ? `${stats.count} of ${windowTotal} ${windowLabel} reviews match ${filterLabel}.`
    : `${windowTotal} ${windowLabel} reviews.`;
  const periodLines = (() => {
    const live = narrative?.bullets ?? [];
    const src = hasFullCopy(summary) ? summary.period : live;
    const cleaned = (src.length ? src : live).filter(
      (line) =>
        !isCountRestatement(line, stats.count, windowTotal) &&
        !copyContradictsCounts(line, stats.count, windowTotal) &&
        !isJargonLine(line),
    );
    if (filterOn) return cleaned.slice(0, 4);
    return (cleaned.length ? cleaned : [matchingLine]).slice(0, 5);
  })();
  const headlineCopy = summary?.headline?.trim() ?? "";
  const headlineOk = Boolean(
    headlineCopy &&
      !copyContradictsCounts(headlineCopy, stats.count, windowTotal) &&
      !headlineOverclaims(headlineCopy, windowLabel),
  );
  const rawPos =
    hasFullCopy(summary) && !copyContradictsCounts(summary.positive, stats.count, windowTotal)
      ? summary.positive
      : (narrative?.positive ?? "");
  const rawNeg =
    hasFullCopy(summary) && !copyContradictsCounts(summary.negative, stats.count, windowTotal)
      ? summary.negative
      : (narrative?.negative ?? "");
  const posCopy = isHollowPraise(rawPos) ? "" : rawPos;
  const negCopy = rawNeg.trim();
  const rewriteFacts = {
    month: windowLabel,
    reviewCount: stats.count,
    avgRating: stats.avgRating,
    sentiment: stats.sentiment,
    filter: filterLabel,
  };
  const vocMonths = recentMonths(26);
  const recent = Object.entries(cache)
    .sort((a, b) => Date.parse(b[1].fetchedAt) - Date.parse(a[1].fetchedAt))
    .filter(([, s], i, all) => all.findIndex((x) => x[1].slug === s.slug) === i);
  const vsCopy = useMemo(
    () =>
      competitorNarrative(
        compareBrands.map((b) => ({
          name: b.scrape.displayName,
          self: b.self,
          trust: b.scrape.trustScore,
          sentiment: b.stats.sentiment,
          count: b.stats.count,
        })),
      ),
    [compareBrands],
  );
  const shortName = scrape?.displayName.replace(/\.ag$/i, "").replace(/\s+/g, " ") ?? "";

  const showReviews = (title: string, list: GraceReview[]) => {
    setModal({
      title,
      reviews: [...list].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
    });
  };

  return (
    <div className="gr-shell" data-mode={mode} data-side={sideOpen && mode === "bench" ? "open" : "closed"}>
      {mode === "bench" ? (
      <aside className="gr-no-print gr-side">
        <div className="mb-3 flex items-center justify-between gap-2 px-2">
          <p className="gr-side-title">Grace</p>
          <button type="button" className="gr-icon-btn" onClick={() => setSideOpen(false)} aria-label="Close sidebar">
            <PanelLeftClose className="size-4" />
          </button>
        </div>
        <button type="button" onClick={newReport} className="gr-side-item" data-on={String(!activeReportId && mode === "bench")}>
          <Plus className="size-3.5 shrink-0" /> New report
        </button>
        <p className="gr-side-label">My reports</p>
        {reports.length === 0 ? (
          <p className="px-2 text-[12px] leading-relaxed text-[#8a9198]">Saved presentations land here after you create a report.</p>
        ) : (
          reports.map((r) => (
            <div key={r.id} className="flex items-center gap-0.5">
              <button
                type="button"
                className="gr-side-item min-w-0 flex-1"
                data-on={String(r.id === activeReportId)}
                onClick={() => openReport(r)}
              >
                <span className="truncate">{r.name}</span>
              </button>
              <button
                type="button"
                className="shrink-0 rounded-md p-1.5 text-[#8a9198] hover:bg-[#f4f5f7] hover:text-[#ff3722]"
                onClick={() => deleteReport(r.id)}
                aria-label={`Delete ${r.name}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))
        )}
      </aside>
      ) : null}

      <div className="gr-main">
      <div className="gr-no-print gr-toolbar" data-slim={String(mode === "report")}>
        {mode === "report" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <button type="button" onClick={() => setMode("bench")} className="gr-chip">
                Edit dashboard
              </button>
              <input
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                onBlur={() => reportName.trim() && saveReport(reportName)}
                className="h-8 min-w-[180px] max-w-xs border-0 bg-transparent px-1 text-[13px] font-medium text-[#191919] outline-none"
                placeholder="Report name"
              />
            </div>
            <div className="flex items-center gap-2">
              {priors.length > 0 ? (
                <label className="inline-flex items-center gap-2 text-[12px] text-[#6c737a]">
                  Compare
                  <select
                    value={compareWithId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      setCompareWithId(id);
                      persistPresent({ compareWithId: id });
                    }}
                    className="h-8 rounded-md border border-[#e3e6ea] bg-white px-2 text-[12px] text-[#191919] outline-none"
                  >
                    <option value="">{priors[0] ? `Latest prior · ${priors[0].name}` : "None"}</option>
                    {priors.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <AddWidgetMenu
                layout={layout}
                onAdd={(type) => persistLayout(addWidgetToPages(layout, type))}
                onAddPage={() => persistLayout([...layout, newPage()])}
              />
              <button
                type="button"
                className="gr-chip"
                onClick={() => {
                  persistPresentationTemplate(layout);
                  setTemplateSaved(true);
                  window.setTimeout(() => setTemplateSaved(false), 2000);
                }}
              >
                {templateSaved ? "Template saved" : "Save layout as template"}
              </button>
              <button type="button" onClick={exportReport} className="gr-cta-ghost gr-cta">
                <FileDown className="size-3.5" /> Export PDF
              </button>
            </div>
          </div>
        ) : (
        <div className="flex flex-col gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {!sideOpen ? (
                <button type="button" className="gr-icon-btn" onClick={() => setSideOpen(true)} aria-label="Open sidebar">
                  <PanelLeft className="size-4" />
                </button>
              ) : null}
              <p className="truncate text-[14px] font-semibold tracking-tight text-[#191919]">
                {scrape ? (reportName.trim() || shortName || scrape.displayName) : "New report"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {scrape && priors.length > 0 ? (
                <label className="inline-flex items-center gap-2 text-[12px] text-[#6c737a]">
                  Compare
                  <select
                    value={compareWithId ?? ""}
                    onChange={(e) => setCompareWithId(e.target.value || null)}
                    className="h-8 rounded-md border border-[#e3e6ea] bg-white px-2 text-[12px] text-[#191919] outline-none"
                  >
                    <option value="">Previous month</option>
                    {priors.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {scrape ? (
                <>
                  {hasFullCopy(summary) ? (
                    <button
                      type="button"
                      onClick={() => void createReport()}
                      disabled={summaryBusy || stats.count === 0}
                      className="gr-icon-sq"
                      aria-label="Regenerate briefing"
                      title="Regenerate briefing"
                    >
                      {summaryBusy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (hasFullCopy(summary)) setMode("report");
                      else void createReport();
                    }}
                    disabled={summaryBusy || stats.count === 0}
                    className="gr-cta gr-cta-ghost gr-cta-shimmer"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {summaryBusy ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
                      Create PDF
                    </span>
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              void runMain();
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a9198]" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Brand URL or trustpilot.com/review/…"
                className="gr-input"
                spellCheck={false}
              />
            </div>
            <select
              value={window_}
              aria-label="VoC month"
              className="gr-select"
              onChange={(e) => {
                setWindow(e.target.value);
                setSummary(null);
              }}
            >
              {vocMonths.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
            <button type="submit" disabled={!!busy || !input.trim()} className="gr-btn">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Pull reviews
            </button>
          </form>

          {busy ? (
            <p className="flex items-center gap-2 text-[12px] text-[#6c737a]">
              <Loader2 className="size-3.5 animate-spin" />
              {busy}
            </p>
          ) : null}
          {error ? (
            <p className="flex items-start gap-2 text-[12px] text-[#ff3722]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </p>
          ) : null}

          {recent.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {recent.map(([key, s]) => (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${
                    key === current ? "border-[#00b67a] text-[#191919]" : "border-[#e3e6ea] text-[#6c737a]"
                  }`}
                >
                  <button
                    type="button"
                    className="cursor-pointer"
                    onClick={() => {
                      setCurrent(key);
                      setInput(s.slug);
                      setSummary(null);
                      setMode("bench");
                    }}
                  >
                    {s.displayName}
                  </button>
                  <button type="button" onClick={() => dropScrape(key)} className="cursor-pointer opacity-50 hover:opacity-100">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          {scrape ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="gr-chip" data-on={String(filtersOpen)} onClick={() => setFiltersOpen((v) => !v)}>
                  {filtersOpen ? "Hide keywords" : activeKeywords.length ? `${filterLabel} · ${activeKeywords.length} keywords` : "Keywords"}
                </button>
                <button type="button" onClick={selectAllPoker} className="gr-chip" data-on={String(allPoker)}>
                  <Check className="size-3" /> All poker
                </button>
                <button type="button" onClick={clearKeywords} className="gr-chip">
                  Clear
                </button>
                <button type="button" onClick={exportCsv} className="gr-chip">
                  <Download className="size-3" /> CSV
                </button>
                <button type="button" onClick={() => void runMain(true)} disabled={!!busy} className="gr-chip">
                  <RefreshCw className="size-3" /> Re-pull
                </button>
                <a href={scrape.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-[#00b67a]">
                  Open on Trustpilot <ExternalLink className="size-3" />
                </a>
              </div>
              {filtersOpen ? (
                <div className="flex flex-col gap-2 border-t border-[#f1f3f5] pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a9198]">Keywords</p>
                  <p className="text-[12px] text-[#8a9198]">
                    All poker keeps comments that are actually about poker. Words like turn, login, and promo are not enough on their own.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {allPresetKeywords.map((k) => {
                      const row = keywordRows.find((r) => r.topic === k);
                      const custom = customKeywords.includes(k);
                      return (
                        <span key={k} className="inline-flex items-center">
                          <button
                            type="button"
                            onClick={() => toggleKeyword(k)}
                            className="gr-chip"
                            data-on={String(activeKeywords.includes(k))}
                            data-count={row ? ` ${row.total}` : undefined}
                          >
                            {k}
                          </button>
                          {custom ? (
                            <button type="button" onClick={() => removeCustomKeyword(k)} className="-ml-1 cursor-pointer p-0.5 text-[#8a9198] hover:text-[#ff3722]">
                              <X className="size-3" />
                            </button>
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative">
                      <Plus className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#8a9198]" />
                      <input
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomKeyword();
                          }
                        }}
                        placeholder="Add a keyword"
                        className="gr-input h-9! w-52 text-[12px]!"
                      />
                    </div>
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#8a9198]" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search inside filtered reviews"
                        className="gr-input h-9! text-[12px]!"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-col gap-2.5 border-t border-[#f1f3f5] pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a9198]">Competitors</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {COMPETITOR_SETS.map((s) => (
                      <button key={s.id} type="button" onClick={() => applyCompetitorSet(s.id)} className="gr-chip" data-on={String(competitorSet === s.id)}>
                        {s.label}
                      </button>
                    ))}
                    <button type="button" onClick={() => setCompetitorSet("custom")} className="gr-chip" data-on={String(competitorSet === "custom")}>
                      Custom
                    </button>
                  </div>
                </div>
                {rivals.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {rivals.map((r) => {
                      let slug = r;
                      try {
                        slug = trustpilotSlugFromInput(r);
                      } catch {
                        /* keep */
                      }
                      const have = Boolean(findCacheKey(cache, slug));
                      const err = rivalErrors[r];
                      const loading = rivalBusy === slug;
                      return (
                        <span
                          key={r}
                          className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12px] ${
                            have ? "border-[#00b67a]" : err ? "border-[#ff3722]" : "border-[#e3e6ea]"
                          }`}
                          title={err}
                        >
                          {loading ? <Loader2 className="size-3 animate-spin" /> : have ? <Check className="size-3 text-[#00b67a]" /> : null}
                          <BrandIcon slug={slug} name={r} size={14} />
                          {r}
                          <button
                            type="button"
                            className="cursor-pointer opacity-50 hover:opacity-100"
                            onClick={() => {
                              setRivals((p) => p.filter((x) => x !== r));
                              setCompetitorSet("custom");
                            }}
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  {rivalSearchOpen ? (
                    <div className="gr-rival-field">
                      <Search className="size-3.5 shrink-0 text-[#8a9198]" />
                      <input
                        ref={rivalSearchRef}
                        value={newRival}
                        onChange={(e) => setNewRival(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setNewRival("");
                            setRivalSearchOpen(false);
                          }
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const v = newRival.trim();
                            if (!v) return;
                            setRivals((p) => (p.includes(v) ? p : [...p, v]));
                            setCompetitorSet("custom");
                            setNewRival("");
                          }
                        }}
                        placeholder="competitor.com"
                      />
                      <button
                        type="button"
                        className="text-[#8a9198] hover:text-[#191919]"
                        aria-label="Close"
                        onClick={() => {
                          setNewRival("");
                          setRivalSearchOpen(false);
                        }}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="gr-chip h-10! px-3! text-[12px]!"
                      onClick={() => {
                        setRivalSearchOpen(true);
                        window.setTimeout(() => rivalSearchRef.current?.focus(), 20);
                      }}
                    >
                      <Plus className="size-3.5" />
                      Add competitors
                    </button>
                  )}
                  {rivalBusy ? (
                    <button type="button" onClick={() => { abortRivals.current = true; }} className="gr-chip">
                      Stop
                    </button>
                  ) : rivals.length ? (
                    <button type="button" onClick={() => void runRivals()} disabled={!!busy} className="gr-btn">
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                      Pull competitors
                    </button>
                  ) : null}
                </div>
              </div>
              {partial ? (
                <div className="flex flex-col gap-2 rounded-lg bg-[#fff8e8] px-3 py-2 text-[12px] text-[#6b5b2a] sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Trustpilot caps listings at 200 per filter
                    {cappedStars.length
                      ? ` — ${cappedStars.map((c) => `${c.star}★ ${c.captured}/${c.total}`).join(", ")}`
                      : ""}
                    . Window totals stay exact.
                  </span>
                  <button
                    type="button"
                    onClick={() => void deepPull()}
                    disabled={deepBusy || keywords.length === 0}
                    className="gr-chip shrink-0"
                  >
                    {deepBusy ? <Loader2 className="size-3 animate-spin" /> : <Search className="size-3" />}
                    Deep-pull keywords
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        )}
      </div>

      {!scrape ? (
        <div className="mx-auto max-w-[720px] px-6 py-24 text-center">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#00b67a]">Grace</p>
          <h1 className="gr-title mt-3">Trustpilot review intelligence</h1>
          <div className="gr-title-rule mx-auto" />
          <p className="mx-auto mt-6 max-w-md text-[15px] leading-relaxed text-[#6c737a]">
            Pick a calendar month, pull up to two years of reviews, then slice
            August or July. Each VoC report is one month, compared to the month
            before. Present Mode builds the slides from this dashboard.
          </p>
        </div>
      ) : mode === "report" ? (
        <>
          {summaryError ? <p className="mb-3 text-[12px] text-[#ff3722]">{summaryError}</p> : null}
          <PresentStage
            scrape={scrape}
            shortName={shortName}
            filterLabel={filterLabel}
            windowLabel={windowLabel}
            windowTotal={windowTotal}
            filtered={filtered}
            stats={stats}
            topicRows={topicRows}
            keywordRows={keywordRows}
            points={points}
            cloud={cloud}
            featured={featuredReviews}
            highlightKeys={highlightKeys}
            summary={summary}
            vsCopy={vsCopy}
            compareBrands={compareBrands}
            sliderBrands={sliderBrands}
            seriesBrands={seriesBrands}
            pokerScore={pokerScore}
            pokerCount={poker12.length}
            pokerCaption={pokerCaption}
            layout={layout}
            onLayout={persistLayout}
            onSummary={persistSummary}
            onFeatured={persistFeatured}
            onExclude={excludeReview}
            priors={priors}
            compareWithId={compareWithId}
            onCompare={(id) => {
              setCompareWithId(id);
              persistPresent({ compareWithId: id });
            }}
          />
        </>
      ) : (
        <div className="mx-auto max-w-[1180px]">
          {summaryError && mode === "bench" ? (
            <p className="mb-3 text-[12px] text-[#ff3722]">{summaryError}</p>
          ) : null}
          <section className="gr-slide">
            <h1 className="gr-title">
              Trustpilot — {shortName} {filterLabel === "All reviews" ? "" : filterLabel}
            </h1>
            <div className="gr-title-rule" />

            <div className="mt-8">
              <ScorePair
                officialScore={scrape.trustScore}
                officialCount={scrape.totalReviews}
                pokerScore={pokerScore}
                pokerCount={poker12.length}
                pokerCaption={pokerCaption}
                size={20}
                onOfficial={() => showReviews(`${shortName} · all captured`, brandReviews)}
                onPoker={() => showReviews(`${shortName} · poker · last 12 months`, poker12)}
              />
            </div>
            <p className="mt-3 text-[13px] text-[#6c737a]">
              {windowLabel} ·{" "}
              <button type="button" className="gr-count font-normal" onClick={() => showReviews(`${shortName} · ${windowLabel}`, windowReviews)}>
                {windowTotal.toLocaleString()} reviews
              </button>
              {partial ? ` · ${captured.toLocaleString()} captured` : ""}
              {stats.count !== windowTotal ? (
                <>
                  {" · "}
                  <button type="button" className="gr-count font-normal" onClick={() => showReviews(`${shortName} · ${filterLabel}`, filtered)}>
                    {stats.count.toLocaleString()} match this filter
                  </button>
                </>
              ) : null}
              {excludedIds.length ? ` · ${excludedIds.length} removed` : ""}
              {classifyBusy ? " · Checking which comments are actually poker" : pokerDropped ? ` · Dropped ${pokerDropped} casino / main-site comments` : ""}
            </p>
            {classifyError ? <p className="mt-2 text-[12px] text-[#ff3722]">{classifyError}</p> : null}

            <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
              <div>
                {excludedIds.length || briefingStale ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#fff8e8] px-3 py-2 text-[12px] text-[#6b5b2a]">
                    <span>
                      {excludedIds.length
                        ? `${excludedIds.length} comment${excludedIds.length === 1 ? "" : "s"} removed from this report.`
                        : "Briefing is out of date."}{" "}
                      Refresh so charts and AI use the cleaned set.
                    </span>
                    {excludedIds.length ? (
                      <button type="button" className="gr-chip" onClick={() => restoreExcluded()}>
                        Undo all
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="gr-cta"
                      disabled={summaryBusy || stats.count === 0}
                      onClick={() => void createReport()}
                    >
                      {summaryBusy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                      Refresh briefing
                    </button>
                  </div>
                ) : null}
                <div className="mt-6">
                  <DashRewrite
                    label="Summary"
                    text={headlineOk ? headlineCopy : `${windowLabel} summary`}
                    field="headline"
                    brand={scrape.displayName}
                    facts={rewriteFacts}
                    onSave={(t) =>
                      persistSummary({
                        ...(summary ??
                          briefingFromDraft({
                            period: narrative?.bullets ?? [],
                            mix: "",
                            positive: narrative?.positive ?? "",
                            negative: narrative?.negative ?? "",
                            competitor: [],
                          })),
                        headline: t,
                      })
                    }
                  />
                  <h2 className="gr-brief-head">{briefHead}</h2>
                  {filterOn && headlineOk ? (
                    <p className="mb-3 text-[15px] font-medium leading-snug text-[#191919]">{headlineCopy}</p>
                  ) : null}
                  <DashRewrite
                    text={periodLines.join("\n")}
                    field="period lines"
                    brand={scrape.displayName}
                    facts={rewriteFacts}
                    onSave={(t) =>
                      persistSummary({
                        ...(summary ??
                          briefingFromDraft({
                            period: narrative?.bullets ?? [],
                            mix: "",
                            positive: narrative?.positive ?? "",
                            negative: narrative?.negative ?? "",
                            competitor: [],
                          })),
                        period: t
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                  <div className="gr-copy space-y-3">
                    {periodLines.map((b) => (
                      <p key={b}>{b}</p>
                    ))}
                  </div>
                </div>
                {posCopy || negCopy ? (
                <div className="mt-6 space-y-3">
                  {posCopy ? (
                    <>
                  <DashRewrite
                    label="Positive reviews"
                    text={posCopy}
                    field="positive"
                    brand={scrape.displayName}
                    facts={rewriteFacts}
                    onSave={(t) =>
                      persistSummary({
                        ...(summary ??
                          briefingFromDraft({
                            period: periodLines,
                            mix: "",
                            positive: t,
                            negative: negCopy,
                            competitor: [],
                          })),
                        positive: t,
                      })
                    }
                  />
                  <p className="gr-copy">{posCopy}</p>
                    </>
                  ) : null}
                  {negCopy ? (
                    <>
                  <DashRewrite
                    label="Negative reviews"
                    text={negCopy}
                    field="negative"
                    brand={scrape.displayName}
                    facts={rewriteFacts}
                    onSave={(t) =>
                      persistSummary({
                        ...(summary ??
                          briefingFromDraft({
                            period: periodLines,
                            mix: "",
                            positive: posCopy,
                            negative: t,
                            competitor: [],
                          })),
                        negative: t,
                      })
                    }
                  />
                  <p className="gr-copy">{negCopy}</p>
                    </>
                  ) : null}
                </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="gr-panel">
                    <h3>Positive reviews by topic</h3>
                    <TopicBars
                      rows={topicRows}
                      mode="positive"
                      onPick={(topic) =>
                        showReviews(`${topic} · positive`, filtered.filter((r) => reviewMatches(r, [topic]) && r.rating >= 4))
                      }
                    />
                  </div>
                  <div className="gr-panel">
                    <h3>Negative reviews by topic</h3>
                    <TopicBars
                      rows={topicRows}
                      mode="negative"
                      onPick={(topic) =>
                        showReviews(`${topic} · negative`, filtered.filter((r) => reviewMatches(r, [topic]) && r.rating <= 2))
                      }
                    />
                  </div>
                </div>
                <div className="gr-panel grid gap-6 sm:grid-cols-2">
                  <SentimentSlider value={stats.sentiment} />
                  <ReviewsMeter count={stats.count} max={Math.max(stats.count, windowTotal, 1)} />
                </div>
                <div className="gr-panel">
                  <h3>Topic performance</h3>
                  <TimelineChart points={points} />
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div className="gr-panel">
                <h3>Keywords mentioned</h3>
                <KeywordMentionBars
                  rows={keywordRows}
                  onPick={(topic) => showReviews(topic, filtered.filter((r) => reviewMatches(r, [topic])))}
                />
              </div>
              <div className="gr-panel">
                <h3>Star distribution</h3>
                <StarDistribution
                  stars={stats.stars}
                  total={stats.count}
                  onPick={(star) => showReviews(`${star}-star`, filtered.filter((r) => Math.round(r.rating) === star))}
                />
                {scrape.windowStars ? (
                  <div className="mt-6">
                    <h3>Last 12 months on Trustpilot</h3>
                    <StarDistribution
                      stars={scrape.windowStars}
                      total={baseline.count}
                      onPick={(star) => showReviews(`${star}-star · window`, windowReviews.filter((r) => Math.round(r.rating) === star))}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="gr-panel mt-5">
              <h3>Tag cloud</h3>
              <TagCloud
                words={cloud}
                active={query.trim().toLowerCase() || undefined}
                onPick={(w) => setQuery((q) => (q.trim().toLowerCase() === w ? "" : w))}
              />
            </div>
          </section>

          <section className="gr-slide">
            {filterOn ? (
              <>
                <h1 className="gr-title">Matching {filterLabel}</h1>
                <p className="mt-3 text-[13px] text-[#6c737a]">
                  {stats.count} of {windowTotal} {windowLabel} reviews match {filterLabel}.
                  This list is only those {stats.count} — not every {shortName} review.
                </p>
                <div className="gr-title-rule" />
                <div className="mt-8 mb-4 flex flex-wrap items-end justify-between gap-3">
                  <h2 className="text-[22px] font-medium tracking-tight">
                    Matching reviews
                    <span className="ml-2 text-[14px] font-normal text-[#8a9198]">
                      {matchingList.length}
                      {matchTone !== "all" || matchStar ? ` of ${stats.count}` : ""}
                    </span>
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <div className="gr-window">
                      {(
                        [
                          ["all", `All ${matchToneCounts.all}`],
                          ["positive", `Positive ${matchToneCounts.positive}`],
                          ["neutral", `Neutral ${matchToneCounts.neutral}`],
                          ["negative", `Negative ${matchToneCounts.negative}`],
                        ] as [MatchTone, string][]
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          data-on={String(matchTone === id)}
                          onClick={() => setMatchTone(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="gr-window">
                      <button type="button" data-on={String(matchStar === 0)} onClick={() => setMatchStar(0)}>
                        All
                      </button>
                      {([1, 2, 3, 4, 5] as const).map((n) => (
                        <button
                          key={n}
                          type="button"
                          data-on={String(matchStar === n)}
                          onClick={() => setMatchStar(n)}
                        >
                          {n}★ {matchStarCounts[n]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <ReviewList
                  key={`${current}|match|${activeKeywords.join(",")}|${query}|${matchTone}|${matchStar}`}
                  reviews={matchingList}
                  keywords={highlightKeys}
                  pinnedIds={featuredIds}
                  onPin={pinReview}
                  onExclude={excludeReview}
                />
              </>
            ) : (
              <>
                <h1 className="gr-title">Trustpilot — {shortName} Reviews</h1>
                <p className="mt-3 text-[13px] text-[#6c737a]">
                  {windowTotal} {windowLabel} reviews.
                </p>
                <div className="gr-title-rule" />
              </>
            )}

            <div className={filterOn ? "mt-16" : "mt-8"}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[22px] font-medium tracking-tight">
                    {filterOn ? `All ${shortName} reviews` : `${windowLabel} reviews`}
                  </h2>
                  <p className="mt-1 text-[13px] text-[#6c737a]">
                    {filterOn
                      ? `Every ${shortName} review in ${windowLabel} — poker or not. ${windowTotal} in the month. Matching ${filterLabel} rows are marked.`
                      : `${windowTotal} ${windowLabel} reviews.`}
                  </p>
                </div>
                <div className="gr-window">
                  {(
                    [
                      ["all", `All ${baseline.count}`],
                      ["positive", `Positive ${baseline.positive}`],
                      ["negative", `Negative ${baseline.negative}`],
                    ] as [ReviewTab, string][]
                  ).map(([id, label]) => (
                    <button key={id} type="button" data-on={String(reviewTab === id)} onClick={() => setReviewTab(id)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <ReviewList
                key={`${current}|${reviewTab}|${activeKeywords.join(",")}|${query}`}
                reviews={tabReviews}
                keywords={highlightKeys}
                matchIds={filterOn ? matchingIds : undefined}
                pinnedIds={featuredIds}
                onPin={pinReview}
                onExclude={excludeReview}
              />
            </div>
          </section>

          <section className="gr-slide">
            <h1 className="gr-title">Trustpilot — {shortName} vs Competitors</h1>
            <div className="gr-title-rule" />
            <div className="gr-copy mt-8 space-y-3">
              {vsCopy.length
                ? vsCopy.map((l) => <p key={l}>{l}</p>)
                : (
                  <p>Pull at least one competitor to fill this page. Same window, same keyword filter.</p>
                )}
            </div>
            <div className="mt-8 grid gap-5">
              <div className="flex flex-col gap-5">
                {compareBrands.length > 0 ? (
                  <div className="gr-panel overflow-x-auto p-0!">
                    <table className="w-full text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-[#eef0f2] text-[11px] uppercase tracking-wide text-[#8a9198]">
                          <th className="px-4 py-3 font-medium">Company</th>
                          <th className="px-4 py-3 font-medium">TrustScore</th>
                          <th className="px-4 py-3 font-medium">Poker · 12m</th>
                          <th className="px-4 py-3 font-medium">Reviews</th>
                          <th className="px-4 py-3 font-medium">Matching</th>
                          <th className="px-4 py-3 font-medium">Star mix</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compareBrands.map((b) => (
                          <tr key={b.scrape.slug} className="border-b border-[#f4f5f6] last:border-0">
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-2">
                                <span className="size-2.5 shrink-0 rounded-full" style={{ background: b.color }} />
                                <BrandIcon slug={b.scrape.slug} name={b.scrape.displayName} size={18} />
                                {b.scrape.displayName}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-2">
                                <span className="tabular-nums font-semibold">
                                  {b.scrape.trustScore != null ? b.scrape.trustScore.toFixed(1) : "—"}
                                </span>
                                {b.scrape.trustScore != null ? <TpStars rating={b.scrape.trustScore} size={14} /> : null}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                className="inline-flex items-center gap-2"
                                onClick={() => showReviews(`${b.scrape.displayName} · all poker`, b.pokerReviews)}
                              >
                                <span className="tabular-nums font-semibold">
                                  {b.pokerScore != null ? b.pokerScore.toFixed(1) : "—"}
                                </span>
                                {b.pokerScore != null ? <TpStars rating={b.pokerScore} size={14} /> : null}
                                <span className="text-[11px] text-[#8a9198]">{b.pokerCount.toLocaleString()}</span>
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                className="gr-count"
                                onClick={() => showReviews(b.scrape.displayName, b.scrape.reviews)}
                              >
                                {(b.scrape.totalReviews ?? b.all.count).toLocaleString()}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                className="gr-count"
                                onClick={() => showReviews(`${b.scrape.displayName} · ${filterLabel}`, b.filtered)}
                              >
                                {b.stats.count.toLocaleString()}
                              </button>
                            </td>
                            <td className="px-4 py-3 min-w-[140px]">
                              <MiniStarBar stars={b.all.stars} total={b.all.count} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {compareBrands.length > 1 ? (
                  <div className="gr-panel">
                    <h3>Sentiment over time</h3>
                    <CompetitorLines brands={seriesBrands} />
                    <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[#6c737a]">
                      {seriesBrands.map((b) => (
                        <span key={b.id} className="inline-flex items-center gap-1.5">
                          <span className="h-0.5 w-4 rounded-full" style={{ background: b.color }} />
                          {b.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {compareBrands.length > 1 ? (
              <div className="gr-panel mt-8">
                <h3>Topic sentiment by competitor</h3>
                <CompetitorSliders brands={sliderBrands} />
                <div className="mt-6 flex flex-wrap gap-4 text-[11px] text-[#6c737a]">
                  {sliderBrands.map((b) => (
                    <span key={b.id} className="inline-flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full" style={{ background: b.color }} />
                      {b.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-10 flex items-center justify-between border-t border-[#eef0f2] pt-4 text-[11px] text-[#8a9198]">
              <span>Public Trustpilot reviews · {windowLabel} · sentiment = positive share − negative share</span>
              <button type="button" onClick={() => dropScrape(current!)} className="gr-no-print inline-flex items-center gap-1 hover:text-[#ff3722]">
                <Trash2 className="size-3" /> Forget this pull
              </button>
            </div>
          </section>
        </div>
      )}
      {modal ? (
        <ReviewModal
          title={modal.title}
          reviews={modal.reviews.filter((r) => !excluded.has(r.id))}
          keywords={highlightKeys}
          pinnedIds={featuredIds}
          onPin={pinReview}
          onExclude={excludeReview}
          onClose={() => setModal(null)}
        />
      ) : null}
      {scrape ? (
        <GraceChat
          brand={scrape.displayName}
          facts={{
            month: windowLabel,
            filter: filterLabel,
            matchingCount: stats.count,
            monthTotal: windowTotal,
            avgRating: stats.avgRating,
            sentiment: stats.sentiment,
            officialScore: scrape.trustScore,
            pokerScore,
            pokerCount: poker12.length,
            topics: topicRows.slice(0, 8).map(
              (t) => `${t.topic}: ${t.total} (${t.positive}+ / ${t.negative}-)`,
            ),
            current: {
              headline: headlineOk ? headlineCopy : briefHead,
              period: periodLines,
              positive: posCopy,
              negative: negCopy,
              mix: summary?.mix ?? "",
            },
          }}
          onApply={(patch) => {
            persistSummary({
              ...(summary ??
                briefingFromDraft({
                  period: periodLines,
                  mix: "",
                  positive: posCopy,
                  negative: negCopy,
                  competitor: [],
                })),
              ...patch,
            });
          }}
        />
      ) : null}
      </div>
    </div>
  );
}
