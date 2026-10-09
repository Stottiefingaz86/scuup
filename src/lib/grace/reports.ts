import type { KeywordGroup } from "./keywords";
import { coerceMonth, monthLabel, type GraceWindow } from "./types";

export interface ReportSnapshot {
  brand: string;
  slug: string;
  window: GraceWindow;
  filterLabel: string;
  fetchedAt: string;
  trustScore: number | null;
  stats: {
    count: number;
    avgRating: number;
    sentiment: number;
    positivePct: number;
    negativePct: number;
    neutralPct: number;
  };
  topics: { topic: string; total: number; positive: number; negative: number }[];
}

export interface SlideCommentary {
  topics: string;
  comments: string;
  competitors: string;
  charts: string;
  keywords: string;
  actions: string;
}

export const EMPTY_COMMENTARY: SlideCommentary = {
  topics: "",
  comments: "",
  competitors: "",
  charts: "",
  keywords: "",
  actions: "",
};

export interface SavedReportSummary {
  headline: string;
  /** Left-column period lines (reviews, sentiment, vs last period). */
  period: string[];
  mix: string;
  positive: string;
  negative: string;
  /** Issues to watch. */
  watch: string[];
  /** What changed vs the compared report. Empty if none. */
  changed: string[];
  competitor: string[];
  wins: string[];
  pains: string[];
  actions: string[];
  commentary?: SlideCommentary;
  /** Older shape — still render if a saved report only has this. */
  summary?: string;
}

export type PresentWidgetType =
  | "briefing"
  | "topics"
  | "comments"
  | "competitors"
  | "lines"
  | "sliders"
  | "trends"
  | "tagcloud"
  | "keywords"
  | "stars"
  | "timeline"
  | "sentiment"
  | "actions";

export type PresentSize = "s" | "m" | "l";
export type PresentSpan = "full" | "wide" | "tall" | "quarter";

export interface PresentWidget {
  id: string;
  type: PresentWidgetType;
  size: PresentSize;
}

export interface PresentPage {
  id: string;
  title: string;
  /** Two medium widgets: row = side by side, col = stacked. */
  stack?: "row" | "col";
  widgets: PresentWidget[];
  /** Optional prior report to compare this slide against. */
  compareId?: string | null;
  /** Analyst note for the left rail. */
  note?: string;
}

export const PRESENT_WIDGETS: { type: PresentWidgetType; label: string }[] = [
  { type: "briefing", label: "Briefing" },
  { type: "topics", label: "Topics" },
  { type: "comments", label: "Comments" },
  { type: "competitors", label: "Competitors" },
  { type: "lines", label: "Sentiment chart" },
  { type: "sliders", label: "Topic sliders" },
  { type: "trends", label: "Trends" },
  { type: "tagcloud", label: "Tag cloud" },
  { type: "keywords", label: "Keywords" },
  { type: "stars", label: "Star mix" },
  { type: "timeline", label: "Timeline" },
  { type: "sentiment", label: "Sentiment score" },
  { type: "actions", label: "Actions" },
];

const LARGE_TYPES = new Set<PresentWidgetType>(["comments", "competitors", "actions", "briefing"]);
const LEGACY_TYPES = new Set<PresentWidgetType>([
  "briefing",
  "topics",
  "comments",
  "competitors",
  "trends",
  "tagcloud",
]);

export function defaultSizeFor(type: PresentWidgetType): PresentSize {
  return LARGE_TYPES.has(type) ? "l" : "m";
}

export function sizeUnits(size: PresentSize): number {
  return size === "l" ? 4 : size === "m" ? 2 : 1;
}

export function pageUnits(page: PresentPage): number {
  return page.widgets.reduce((n, w) => n + sizeUnits(w.size), 0);
}

export function unitsLeft(page: PresentPage): number {
  return Math.max(0, 4 - pageUnits(page));
}

export function newPageId(): string {
  return `p_${Math.random().toString(36).slice(2, 8)}`;
}

export function newPage(
  widgets: PresentWidget[] = [],
  title = "",
  stack?: "row" | "col",
): PresentPage {
  return { id: newPageId(), title, stack, widgets };
}

export function defaultPresentation(opts?: {
  brand?: string;
  filter?: string;
  window?: string;
}): PresentPage[] {
  const brand = (opts?.brand ?? "").replace(/\.ag$/i, "").trim();
  const filter = opts?.filter && opts.filter !== "All reviews" ? opts.filter : "";
  const win = (opts?.window ?? "").replace(/^Last /, "");
  const who = [brand, filter].filter(Boolean).join(" ");
  const how = who ? `How ${who} is doing${win ? ` · ${win}` : ""}` : "How we're doing";
  return [
    newPage(
      [
        { id: "w_briefing", type: "briefing", size: "m" },
        { id: "w_keywords", type: "keywords", size: "m" },
      ],
      how,
      "col",
    ),
    newPage(
      [
        { id: "w_stars", type: "stars", size: "m" },
        { id: "w_topics", type: "topics", size: "m" },
      ],
      who ? `What they talk about · ${who}` : "What they talk about",
      "col",
    ),
    newPage(
      [
        { id: "w_timeline", type: "timeline", size: "m" },
        { id: "w_trends", type: "trends", size: "m" },
      ],
      win ? `How the month moved · ${win}` : "How the month moved",
      "col",
    ),
    newPage(
      [{ id: "w_comments", type: "comments", size: "l" }],
      who ? `What customers said · ${who}` : "Customer comments",
    ),
    newPage(
      [{ id: "w_competitors", type: "competitors", size: "l" }],
      brand ? `${brand} vs competitors · ${win || "this month"}` : "Vs competitors",
    ),
    newPage(
      [{ id: "w_actions", type: "actions", size: "l" }],
      who ? `What to do next · ${who}` : "What to do next",
    ),
  ];
}

export function movePage(pages: PresentPage[], index: number, dir: -1 | 1): PresentPage[] {
  const next = index + dir;
  if (next < 0 || next >= pages.length) return pages;
  const copy = [...pages];
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  return copy;
}

export function newWidget(type: PresentWidgetType, size?: PresentSize): PresentWidget {
  return {
    id: `w_${type}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    size: size ?? defaultSizeFor(type),
  };
}

export function widgetSpans(widgets: PresentWidget[], stack: "row" | "col" = "row"): PresentSpan[] {
  const sizes = widgets.map((w) => w.size);
  const n = widgets.length;
  if (n === 0) return [];
  if (n === 1) {
    if (sizes[0] === "l") return ["full"];
    if (sizes[0] === "m") return ["wide"];
    return ["quarter"];
  }
  if (n === 2) {
    if (sizes[0] === "m" && sizes[1] === "m") {
      return stack === "col" ? ["wide", "wide"] : ["tall", "tall"];
    }
    if (sizes[0] === "m") return ["wide", "quarter"];
    if (sizes[1] === "m") return ["quarter", "wide"];
    return ["quarter", "quarter"];
  }
  if (n === 3) {
    if (sizes[0] === "m") return ["tall", "quarter", "quarter"];
    if (sizes[1] === "m") return ["quarter", "tall", "quarter"];
    if (sizes[2] === "m") return ["quarter", "quarter", "tall"];
    return ["quarter", "quarter", "quarter"];
  }
  return ["quarter", "quarter", "quarter", "quarter"];
}

export function emptySpan(page: PresentPage): PresentSpan | null {
  const left = unitsLeft(page);
  if (left <= 0) return null;
  if (left >= 4) return "full";
  if (left >= 2) {
    if (page.widgets.length === 1 && page.widgets[0].size === "m") return "wide";
    if (page.widgets.length === 2 && page.widgets.every((w) => w.size === "s")) return "wide";
    return "wide";
  }
  return "quarter";
}

export function addWidgetToPages(pages: PresentPage[], type: PresentWidgetType): PresentPage[] {
  const left = pages[pages.length - 1];
  const wanted = defaultSizeFor(type);
  const size: PresentSize =
    left && unitsLeft(left) >= sizeUnits(wanted)
      ? wanted
      : left && unitsLeft(left) >= 2
        ? "m"
        : left && unitsLeft(left) >= 1
          ? "s"
          : wanted;
  const widget = newWidget(type, size);
  if (left && unitsLeft(left) >= sizeUnits(size)) {
    return pages.map((p, i) => (i === pages.length - 1 ? { ...p, widgets: [...p.widgets, widget] } : p));
  }
  return [...pages, newPage([widget])];
}

export function addWidgetToPage(pages: PresentPage[], pageId: string, type: PresentWidgetType): PresentPage[] {
  return pages.map((p) => {
    if (p.id !== pageId) return p;
    let page = p;
    if (unitsLeft(page) < 1) {
      const big = [...page.widgets].reverse().find((w) => w.size === "l" || w.size === "m");
      if (big) {
        page = {
          ...page,
          widgets: page.widgets.map((w) =>
            w.id === big.id ? { ...w, size: big.size === "l" ? "m" : "s" } : w,
          ),
        };
      }
    }
    const wanted = defaultSizeFor(type);
    const size: PresentSize =
      unitsLeft(page) >= sizeUnits(wanted) ? wanted : unitsLeft(page) >= 2 ? "m" : "s";
    if (unitsLeft(page) < 1) return page;
    const stack =
      page.widgets.length === 1 && page.widgets[0].size === "m" && size === "m" ? "col" : page.stack;
    return { ...page, stack, widgets: [...page.widgets, newWidget(type, size)] };
  });
}

export function setWidgetSize(pages: PresentPage[], pageId: string, widgetId: string, size: PresentSize): PresentPage[] {
  const page = pages.find((p) => p.id === pageId);
  if (!page) return pages;
  const current = page.widgets.find((w) => w.id === widgetId);
  if (!current || current.size === size) return pages;
  const others = page.widgets.filter((w) => w.id !== widgetId);
  const grown = { ...current, size };
  const overflow: PresentWidget[] = [];
  const kept: PresentWidget[] = [grown];
  let used = sizeUnits(size);
  for (const w of others) {
    if (used + sizeUnits(w.size) <= 4) {
      kept.push(w);
      used += sizeUnits(w.size);
    } else {
      overflow.push(w);
    }
  }
  const next = pages.map((p) => (p.id === pageId ? { ...p, widgets: kept } : p));
  if (!overflow.length) return next;
  const idx = next.findIndex((p) => p.id === pageId);
  return [...next.slice(0, idx + 1), newPage(overflow), ...next.slice(idx + 1)];
}

function asWidget(raw: Partial<PresentWidget> & { type: PresentWidgetType }): PresentWidget {
  return {
    id: raw.id || `w_${raw.type}_${Math.random().toString(36).slice(2, 7)}`,
    type: raw.type,
    size: raw.size === "s" || raw.size === "m" || raw.size === "l" ? raw.size : defaultSizeFor(raw.type),
  };
}

function isLegacyLayout(pages: PresentPage[]): boolean {
  if (!pages.length) return true;
  if (pages.every((p) => !String(p.title ?? "").trim())) return true;
  if (pages.some((p) => /30 days|Last \d|6 months|1 year/i.test(p.title))) return true;
  const types = pages.flatMap((p) => p.widgets.map((w) => w.type));
  if (types.length > 0 && types.every((t) => LEGACY_TYPES.has(t))) return true;
  return !types.includes("actions");
}

/** Accepts the current page layout or the older flat widget list. */
export function normalizeLayout(
  raw: unknown,
  titles?: { brand?: string; filter?: string; window?: string },
): PresentPage[] {
  const fresh = defaultPresentation(titles);
  if (!Array.isArray(raw) || raw.length === 0) return fresh;
  const first = raw[0] as { widgets?: unknown; type?: string };
  if (first && Array.isArray(first.widgets)) {
    const pages = (raw as PresentPage[]).map((p) => ({
      id: p.id || newPageId(),
      title: typeof p.title === "string" ? p.title : "",
      stack: p.stack === "col" || p.stack === "row" ? p.stack : undefined,
      compareId: typeof p.compareId === "string" || p.compareId === null ? p.compareId : undefined,
      note: typeof p.note === "string" ? p.note : undefined,
      widgets: (p.widgets ?? [])
        .filter((w): w is PresentWidget => Boolean(w && (w as PresentWidget).type))
        .map((w) => asWidget(w)),
    }));
    if (!pages.length || isLegacyLayout(pages)) return fresh;
    return pages;
  }
  return fresh;
}

export interface SavedReport {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  scrapeKey: string | null;
  window: GraceWindow;
  keywords: string[];
  customKeywords: string[];
  keywordGroups?: KeywordGroup[];
  activeGroupId?: string;
  query: string;
  rivals: string[];
  competitorSet: string;
  compareWithId: string | null;
  featuredIds: string[];
  /** Reviews dropped from this report (false keyword hits, off-topic). */
  excludedIds: string[];
  layout: PresentPage[];
  snapshot: ReportSnapshot | null;
  summary: SavedReportSummary | null;
}

const REPORTS_KEY = "grace:reports:v1";
const ACTIVE_KEY = "grace:active-report";

export function loadReports(): SavedReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    const list = raw ? (JSON.parse(raw) as SavedReport[]) : [];
    return list.map((r) => ({
      ...r,
      compareWithId: r.compareWithId ?? null,
      featuredIds: Array.isArray(r.featuredIds) ? r.featuredIds.slice(0, 5) : [],
      excludedIds: Array.isArray(r.excludedIds) ? r.excludedIds : [],
      layout: normalizeLayout(r.layout, {
        brand: r.snapshot?.brand,
        filter: r.snapshot?.filterLabel,
        window: monthLabel(coerceMonth(r.window || r.snapshot?.window)),
      }),
      snapshot: r.snapshot ?? null,
    }));
  } catch {
    return [];
  }
}

export function persistReports(reports: SavedReport[]) {
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  } catch {
    const trimmed = [...reports]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 12);
    try {
      localStorage.setItem(REPORTS_KEY, JSON.stringify(trimmed));
    } catch {
      /* quota */
    }
  }
}

export function loadActiveReportId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function persistActiveReportId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

export function newReportId(): string {
  return `gr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultReportName(opts: {
  brand?: string;
  filter?: string;
  window?: string;
}): string {
  const brand = opts.brand?.replace(/\.ag$/i, "") ?? "Untitled";
  const filter = opts.filter && opts.filter !== "All reviews" ? opts.filter : null;
  const win = opts.window ?? "";
  return ["VoC", brand, filter, win].filter(Boolean).join(" · ");
}

/** Prior reports for the same brand, newest first, excluding the open one. */
export function comparableReports(
  reports: SavedReport[],
  opts: { activeId: string | null; slug?: string | null },
): SavedReport[] {
  const slug = opts.slug ?? null;
  return reports
    .filter((r) => r.id !== opts.activeId && r.snapshot)
    .filter((r) => !slug || r.snapshot?.slug === slug)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function hasFullCopy(
  s: SavedReportSummary | null | undefined,
): s is SavedReportSummary & { period: [string, ...string[]] } {
  return Boolean(s && Array.isArray(s.period) && s.period.length > 0);
}

const TEMPLATE_KEY = "grace:template:v1";

export interface PresentationTemplate {
  pages: {
    title: string;
    stack?: "row" | "col";
    widgets: { type: PresentWidgetType; size: PresentSize }[];
  }[];
}

const MONTH_IN_TITLE =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/g;

function stampTitle(title: string, windowLabel?: string): string {
  if (!windowLabel || !title) return title;
  return title.replace(MONTH_IN_TITLE, windowLabel);
}

export function persistPresentationTemplate(pages: PresentPage[]) {
  const tpl: PresentationTemplate = {
    pages: pages
      .filter((p) => p.widgets.length)
      .map((p) => ({
        title: p.title,
        stack: p.stack,
        widgets: p.widgets.map((w) => ({ type: w.type, size: w.size })),
      })),
  };
  try {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(tpl));
  } catch {
    /* quota */
  }
}

export function loadPresentationTemplate(): PresentationTemplate | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PresentationTemplate;
    if (!Array.isArray(parsed?.pages) || !parsed.pages.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function applyPresentationTemplate(
  tpl: PresentationTemplate,
  opts?: { brand?: string; filter?: string; window?: string },
): PresentPage[] {
  return tpl.pages.map((p) =>
    newPage(
      p.widgets.map((w) => newWidget(w.type, w.size)),
      stampTitle(p.title, opts?.window),
      p.stack,
    ),
  );
}

export function presentationForNewReport(opts?: {
  brand?: string;
  filter?: string;
  window?: string;
}): PresentPage[] {
  const tpl = loadPresentationTemplate();
  if (tpl) return applyPresentationTemplate(tpl, opts);
  return defaultPresentation(opts);
}

export function briefingFromDraft(opts: {
  period: string[];
  mix: string;
  positive: string;
  negative: string;
  competitor: string[];
}): SavedReportSummary {
  return {
    headline: "",
    period: opts.period,
    mix: opts.mix,
    positive: opts.positive,
    negative: opts.negative,
    watch: [],
    changed: [],
    competitor: opts.competitor,
    wins: [],
    pains: [],
    actions: [],
    commentary: { ...EMPTY_COMMENTARY },
  };
}
