"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  headlineOverclaims,
  isCountRestatement,
  isHollowPraise,
  isJargonLine,
  type CloudWord,
  type ReviewStats,
  type TimelinePoint,
  type TopicRow,
} from "@/lib/grace/analysis";
import {
  PRESENT_WIDGETS,
  addWidgetToPage,
  emptySpan,
  movePage,
  setWidgetSize,
  sizeUnits,
  unitsLeft,
  widgetSpans,
  type PresentPage,
  type PresentSize,
  type PresentSpan,
  type PresentWidget,
  type PresentWidgetType,
  type SavedReport,
  type SavedReportSummary,
  EMPTY_COMMENTARY,
  hasFullCopy,
} from "@/lib/grace/reports";
import { monthLabel, type GraceReview, type GraceScrape } from "@/lib/grace/types";
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
import type { ReportBrand } from "./grace-report";
import { Highlight, SourceBadge } from "./grace-reviews";
import { hasStars } from "@/lib/grace/types";
import { TagCloud } from "./tag-cloud";
import { ScorePair, TpStars } from "./tp-stars";

export type RewriteFacts = {
  month?: string;
  reviewCount?: number;
  avgRating?: number;
  sentiment?: number;
  filter?: string;
};

function EditableCopy({
  text,
  field,
  brand,
  facts,
  multiline = false,
  onSave,
}: {
  text: string;
  field: string;
  brand: string;
  facts?: RewriteFacts;
  multiline?: boolean;
  onSave: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(text);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const start = () => {
    setDraft(text);
    setErr(null);
    setOpen(true);
  };

  const rewrite = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/grace/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft || text, field, brand, facts }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Rewrite failed");
      setDraft(String(data.text ?? ""));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Rewrite failed");
    } finally {
      setBusy(false);
    }
  };

  const lines = (text || "").split("\n").filter(Boolean);

  return (
    <div>
      <button type="button" onClick={start} className="gr-edit-copy">
        {lines.length ? (
          lines.map((line) => <span key={line}>{line.replace(/^[-•]\s*/, "")}</span>)
        ) : (
          <span className="text-[#8a9198]">Click to write or rewrite</span>
        )}
      </button>
      {open ? (
        <div className="gr-no-print mt-1.5 rounded-lg border border-[#d0d7de] bg-[#f7f8fa] p-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={multiline ? 5 : 3}
            className="w-full resize-y rounded-md border border-[#e3e6ea] bg-white px-2 py-1.5 text-[13px] leading-relaxed text-[#191919] outline-none focus:border-[#1877f2]"
          />
          {err ? <p className="mt-1 text-[11px] text-[#ff3722]">{err}</p> : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" className="gr-cta" disabled={busy} onClick={() => void rewrite()}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Rewrite
            </button>
            <button
              type="button"
              className="gr-chip"
              onClick={() => {
                onSave(draft);
                setOpen(false);
              }}
            >
              Save
            </button>
            <button type="button" className="gr-chip" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CommentCard({
  review,
  keywords,
  pool,
  onRemove,
  onExclude,
  onReplace,
}: {
  review: GraceReview;
  keywords: string[];
  pool: GraceReview[];
  onRemove: () => void;
  onExclude?: () => void;
  onReplace: (id: string) => void;
}) {
  const [swap, setSwap] = useState(false);
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pool
      .filter((r) => r.id !== review.id)
      .filter((r) => !needle || `${r.author} ${r.title} ${r.text}`.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [pool, q, review.id]);
  const snippet = review.text.length > 140 ? `${review.text.slice(0, 139)}…` : review.text;

  return (
    <article className="gr-comment">
      <div className="gr-comment-actions">
        <button type="button" onClick={() => setSwap((v) => !v)}>
          Change
        </button>
        <button type="button" onClick={onRemove}>
          Off slide
        </button>
        {onExclude ? (
          <button type="button" onClick={onExclude}>
            Remove
          </button>
        ) : null}
      </div>
      <div className="text-[12px] font-semibold text-[#191919]">{review.author}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
        <SourceBadge review={review} />
        {hasStars(review) ? <TpStars rating={review.rating} size={13} /> : null}
      </div>
      {review.title ? (
        <h4 className="mt-1 text-[12.5px] font-semibold text-[#191919]">
          <Highlight text={review.title} keywords={keywords} />
        </h4>
      ) : null}
      <p className="mt-0.5 text-[12px] leading-snug text-[#3d4349]">
        <Highlight text={snippet} keywords={keywords} />
      </p>
      {swap ? (
        <div className="gr-no-print mt-2 rounded-md border border-[#e3e6ea] bg-white p-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a replacement"
            className="gr-input h-8! px-2! text-[12px]!"
          />
          <div className="mt-1 max-h-36 overflow-auto">
            {hits.map((r) => (
              <button
                key={r.id}
                type="button"
                className="block w-full truncate px-1 py-1 text-left text-[12px] hover:bg-[#f4f5f7]"
                onClick={() => {
                  onReplace(r.id);
                  setSwap(false);
                }}
              >
                {r.author} · {r.title || r.text.slice(0, 60)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function AddComment({
  pool,
  taken,
  onAdd,
}: {
  pool: GraceReview[];
  taken: Set<string>;
  onAdd: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pool
      .filter((r) => !taken.has(r.id))
      .filter((r) => !needle || `${r.author} ${r.title} ${r.text}`.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [pool, q, taken]);

  return (
    <div className="gr-no-print rounded-lg border border-dashed border-[#d0d7de] p-2">
      <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#8a9198]">
        <Plus className="size-3" /> Add comment
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search reviews"
        className="gr-input h-8! px-2! text-[12px]!"
      />
      <div className="mt-1 max-h-24 overflow-auto">
        {hits.map((r) => (
          <button
            key={r.id}
            type="button"
            className="block w-full truncate px-1 py-1 text-left text-[12px] hover:bg-[#f4f5f7]"
            onClick={() => onAdd(r.id)}
          >
            {r.author} · {r.title || r.text.slice(0, 60)}
          </button>
        ))}
      </div>
    </div>
  );
}

function SlotAdd({
  used,
  onAdd,
}: {
  used: Set<PresentWidgetType>;
  onAdd: (type: PresentWidgetType) => void;
}) {
  return (
    <label className="gr-slot-add">
      <Plus className="size-3.5" />
      <span>Add widget</span>
      <select
        value=""
        onChange={(e) => {
          const type = e.target.value as PresentWidgetType;
          if (type) onAdd(type);
          e.target.value = "";
        }}
      >
        <option value="">Choose…</option>
        {PRESENT_WIDGETS.map((o) => (
          <option key={o.type} value={o.type} disabled={used.has(o.type)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function widgetLabel(type: PresentWidgetType): string {
  return PRESENT_WIDGETS.find((w) => w.type === type)?.label ?? type;
}

function SlideNote({
  page,
  headline,
  period,
  positive,
  negative,
  changed,
  explainWidget,
  compareWidget,
  priors,
  deckCompareId,
  onCompareDeck,
  onPageCompare,
  onNote,
  brand,
  facts,
}: {
  page: PresentPage;
  headline: string;
  period: string[];
  positive: string;
  negative: string;
  changed: string[];
  explainWidget: (type: PresentWidgetType) => string;
  compareWidget: (type: PresentWidgetType, prior: SavedReport) => string;
  priors: SavedReport[];
  deckCompareId: string | null;
  onCompareDeck: (id: string | null) => void;
  onPageCompare: (id: string | null) => void;
  onNote: (note: string) => void;
  brand: string;
  facts: RewriteFacts;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const compareId = page.compareId !== undefined ? page.compareId : deckCompareId;
  const prior = priors.find((r) => r.id === compareId) ?? (compareId ? null : priors[0] ?? null);
  const types = page.widgets.map((w) => w.type);
  const hasBriefing = types.includes("briefing");

  const writeCompare = async () => {
    if (!prior) return;
    const draft = types
      .map((type) => `${widgetLabel(type)}: ${compareWidget(type, prior)}`)
      .filter((line) => !line.endsWith(": "))
      .join("\n");
    if (!draft.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/grace/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: draft,
          field: `slide compare vs ${prior.name}`,
          brand,
          facts,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Compare failed");
      onNote(String(data.text ?? draft));
    } catch (e) {
      onNote(draft);
      setErr(e instanceof Error ? e.message : "Compare failed — kept the live text.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gr-copy space-y-3">
      <div>
        <p className="gr-slide-kicker">What this shows</p>
        {hasBriefing ? (
          <div className="space-y-2">
            <p className="gr-brief-head">{headline}</p>
            {(period.length ? period : [explainWidget("briefing")]).map((line) => (
              <p key={line}>{line}</p>
            ))}
            {positive ? (
              <p>
                <strong>Positive. </strong>
                {positive}
              </p>
            ) : null}
            {negative ? (
              <p>
                <strong>Negative. </strong>
                {negative}
              </p>
            ) : null}
            {changed.length ? (
              <p>
                <strong>What moved. </strong>
                {changed[0]}
              </p>
            ) : null}
          </div>
        ) : null}
        {types
          .filter((type) => !hasBriefing || type !== "briefing")
          .map((type) => (
            <div key={type} className="mt-3">
              <p className="gr-slide-kicker">{widgetLabel(type)}</p>
              <p>{explainWidget(type)}</p>
            </div>
          ))}
      </div>

      <div className="gr-no-print">
        <p className="gr-slide-kicker">Compare to</p>
        {priors.length ? (
          <select
            value={compareId ?? ""}
            onChange={(e) => {
              const id = e.target.value || null;
              onPageCompare(id);
              if (page.compareId === undefined) onCompareDeck(id);
            }}
            className="mt-1 h-8 w-full rounded-md border border-[#e3e6ea] bg-white px-2 text-[12px] text-[#191919] outline-none"
          >
            <option value="">{priors[0] ? `Latest prior · ${priors[0].name}` : "None"}</option>
            {priors.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-[12px] text-[#8a9198]">Save last month’s report to compare this slide against it.</p>
        )}
      </div>

      {prior?.snapshot ? (
        <div>
          <p className="gr-slide-kicker">Vs {prior.name}</p>
          {types.map((type) => {
            const line = compareWidget(type, prior);
            return line ? (
              <p key={type} className="mt-1">
                {line}
              </p>
            ) : null;
          })}
          <button
            type="button"
            className="gr-no-print gr-chip mt-2"
            disabled={busy}
            onClick={() => void writeCompare()}
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
            Write this compare
          </button>
          {err ? <p className="mt-1 text-[11px] text-[#ff3722]">{err}</p> : null}
        </div>
      ) : null}

      {page.note ? (
        <div>
          <p className="gr-slide-kicker">Analyst note</p>
          {page.note.split("\n").map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function deltaPhrase(now: number, then: number, noun: string): string {
  const d = now - then;
  if (d === 0) return `Same ${noun} as the compared report (${then}).`;
  return `${Math.abs(d)} ${noun} ${d > 0 ? "more" : "fewer"} than the compared report (${then}).`;
}

export function PresentStage({
  scrape,
  shortName,
  filterLabel,
  windowLabel,
  windowTotal,
  filtered,
  stats,
  topicRows,
  keywordRows,
  points,
  cloud,
  featured,
  highlightKeys,
  summary,
  vsCopy,
  compareBrands,
  sliderBrands,
  seriesBrands,
  pokerScore,
  pokerCount,
  pokerCaption,
  layout,
  onLayout,
  onSummary,
  onFeatured,
  onExclude,
  priors,
  compareWithId,
  onCompare,
}: {
  scrape: GraceScrape;
  shortName: string;
  filterLabel: string;
  windowLabel: string;
  windowTotal: number;
  filtered: GraceReview[];
  stats: ReviewStats;
  topicRows: TopicRow[];
  keywordRows: TopicRow[];
  points: TimelinePoint[];
  cloud: CloudWord[];
  featured: GraceReview[];
  highlightKeys: string[];
  summary: SavedReportSummary | null;
  vsCopy: string[];
  compareBrands: ReportBrand[];
  sliderBrands: SliderBrand[];
  seriesBrands: SeriesBrand[];
  pokerScore: number | null;
  pokerCount: number;
  pokerCaption?: string;
  layout: PresentPage[];
  onLayout: (next: PresentPage[]) => void;
  onSummary: (next: SavedReportSummary) => void;
  onFeatured: (ids: string[]) => void;
  onExclude?: (review: GraceReview) => void;
  priors: SavedReport[];
  compareWithId: string | null;
  onCompare: (id: string | null) => void;
}) {
  const [drag, setDrag] = useState<{ pageId: string; widgetId: string } | null>(null);
  const brand = scrape.displayName;
  const filterOn = filterLabel !== "All reviews";
  const matchingLine = filterOn
    ? `${stats.count} of ${windowTotal} ${windowLabel} reviews match ${filterLabel}.`
    : `${windowTotal} ${windowLabel} reviews.`;
  const period = (() => {
    const src = hasFullCopy(summary) ? summary.period : [];
    const cleaned = src.filter(
      (line) => !isCountRestatement(line, stats.count, windowTotal) && !isJargonLine(line),
    );
    if (filterOn) return cleaned.slice(0, 4);
    return (cleaned.length ? cleaned : [matchingLine]).slice(0, 5);
  })();
  const mix = hasFullCopy(summary) ? summary.mix : "";
  const positive = hasFullCopy(summary) && !isHollowPraise(summary.positive) ? summary.positive : "";
  const negative = hasFullCopy(summary) ? summary.negative : "";
  const watch = hasFullCopy(summary) ? summary.watch : [];
  const changed = hasFullCopy(summary) ? summary.changed : [];
  const competitor = hasFullCopy(summary) && summary.competitor.length ? summary.competitor : vsCopy;
  const titleFallback = ["Trustpilot —", shortName, filterLabel === "All reviews" ? "" : filterLabel]
    .filter(Boolean)
    .join(" ");
  const featuredIds = featured.map((r) => r.id);
  const usedTypes = new Set(layout.flatMap((p) => p.widgets.map((w) => w.type)));
  const facts: RewriteFacts = {
    month: windowLabel,
    reviewCount: stats.count,
    avgRating: stats.avgRating,
    sentiment: stats.sentiment,
    filter: filterLabel,
  };

  const patch = (partial: Partial<SavedReportSummary>) => {
    const base: SavedReportSummary = summary ?? {
      headline: "",
      period: [],
      mix: "",
      positive: "",
      negative: "",
      watch: [],
      changed: [],
      competitor: [],
      wins: [],
      pains: [],
      actions: [],
      commentary: { ...EMPTY_COMMENTARY },
    };
    onSummary({ ...base, ...partial });
  };

  const commentary = summary?.commentary ?? EMPTY_COMMENTARY;
  const topPos = [...topicRows].sort((a, b) => b.positive - a.positive)[0];
  const topNeg = [...topicRows].sort((a, b) => b.negative - a.negative)[0];
  const spikes = [...topicRows]
    .filter((t) => t.negative >= 2 && t.negative >= t.positive)
    .sort((a, b) => b.negative - a.negative)
    .slice(0, 3);
  const setLabel = filterOn
    ? `the ${stats.count} ${windowLabel} reviews matching ${filterLabel}`
    : `the ${stats.count} ${windowLabel} reviews`;
  const live = points.filter((p) => p.count > 0);
  const lastPt = live.at(-1);
  const prevPt = live.at(-2);
  const explainWidget = (type: PresentWidgetType): string => {
    if (type === "briefing") {
      return (
        commentary.charts ||
        `${matchingLine} Average ${stats.avgRating}/5. Sentiment ${stats.sentiment > 0 ? "+" : ""}${stats.sentiment}.`
      );
    }
    if (type === "topics") {
      return (
        commentary.topics ||
        `These bars count praise and complaints by theme in ${setLabel}.${
          topNeg ? ` ${topNeg.topic} leads complaints (${topNeg.negative}).` : ""
        }${topPos?.positive ? ` ${topPos.topic} leads praise (${topPos.positive}).` : ""}`
      );
    }
    if (type === "comments") {
      return (
        commentary.comments ||
        (filterOn
          ? `Quotes on this slide are only from ${setLabel}, not the full ${windowTotal} ${windowLabel} set.`
          : `Quotes on this slide are from ${setLabel}.`)
      );
    }
    if (type === "competitors") {
      return (
        commentary.competitors ||
        vsCopy[0] ||
        `Official TrustScore vs poker score for each pulled brand. Matching is this month’s ${filterLabel} slice.`
      );
    }
    if (type === "keywords") {
      return commentary.keywords || `Words that show up most often in ${setLabel}.`;
    }
    if (type === "stars") {
      return `Star mix for ${setLabel}. ${stats.negative} are 1–2 star, ${stats.positive} are 4–5 star.`;
    }
    if (type === "tagcloud") {
      return commentary.keywords || `The loudest words in ${setLabel}. Bigger means more mentions.`;
    }
    if (type === "actions") {
      return (
        commentary.actions ||
        (spikes[0]
          ? `Biggest topic concern in ${setLabel} is ${spikes[0].topic} (${spikes[0].negative} negative). Start there.`
          : `No topic has a clear negative spike in ${setLabel}.`)
      );
    }
    if (type === "timeline") {
      const week =
        lastPt && prevPt
          ? ` Latest week (${lastPt.label}) is ${lastPt.count} reviews, sentiment ${lastPt.sentiment > 0 ? "+" : ""}${lastPt.sentiment}, vs ${prevPt.label} (${prevPt.count}, ${prevPt.sentiment > 0 ? "+" : ""}${prevPt.sentiment}).`
          : lastPt
            ? ` Latest week (${lastPt.label}) is ${lastPt.count} reviews, sentiment ${lastPt.sentiment > 0 ? "+" : ""}${lastPt.sentiment}.`
            : "";
      return (
        commentary.charts ||
        `Bars are review volume. The line is sentiment. Both are ${setLabel}.${week}`
      );
    }
    if (type === "lines") {
      const names = seriesBrands.map((b) => b.name).join(", ");
      return `Competitor sentiment over the month for ${names || "the pulled brands"}. A week only plots if that brand had reviews.`;
    }
    if (type === "sliders") {
      return `Each scale is one topic. A brand only appears if someone mentioned that topic in ${setLabel}. Left is negative, right is positive.`;
    }
    if (type === "trends") {
      return `Sentiment over time plus topic scales for the same ${setLabel}. Brands with no mentions on a topic are omitted so an empty topic does not look like a bad score.`;
    }
    if (type === "sentiment") {
      return `Overall sentiment for ${setLabel} is ${stats.sentiment > 0 ? "+" : ""}${stats.sentiment}. The meter is matching volume versus the ${windowTotal} ${windowLabel} reviews.`;
    }
    return "";
  };

  const compareWidget = (type: PresentWidgetType, prior: SavedReport): string => {
    const snap = prior.snapshot;
    if (!snap) return "";
    const priorLabel = monthLabel(snap.window);
    const then = snap.stats;
    if (type === "topics" || type === "keywords" || type === "tagcloud") {
      const nowNeg = topNeg;
      const thenNeg = [...(snap.topics ?? [])].sort((a, b) => b.negative - a.negative)[0];
      const parts = [deltaPhrase(stats.count, then.count, "reviews")];
      if (nowNeg && thenNeg && nowNeg.topic === thenNeg.topic) {
        parts.push(
          `${nowNeg.topic} is still the loudest complaint (${nowNeg.negative} now, ${thenNeg.negative} in ${priorLabel}).`,
        );
      } else if (nowNeg) {
        parts.push(
          `${nowNeg.topic} is the loudest complaint now${thenNeg ? `; ${priorLabel} was ${thenNeg.topic}` : ""}.`,
        );
      }
      return parts.join(" ");
    }
    if (type === "stars" || type === "sentiment" || type === "briefing" || type === "timeline") {
      return `${deltaPhrase(stats.count, then.count, "reviews")} Sentiment ${stats.sentiment} now vs ${then.sentiment} in ${priorLabel}. Average ${stats.avgRating}/5 vs ${then.avgRating}/5.`;
    }
    if (type === "lines" || type === "sliders" || type === "trends" || type === "competitors") {
      return `${deltaPhrase(stats.count, then.count, "matching reviews")} Sentiment ${stats.sentiment} now vs ${then.sentiment} in ${priorLabel}.`;
    }
    if (type === "actions" || type === "comments") {
      return `${deltaPhrase(stats.count, then.count, "reviews")} ${
        stats.sentiment === then.sentiment
          ? "Sentiment is unchanged."
          : `Sentiment moved from ${then.sentiment} to ${stats.sentiment}.`
      }`;
    }
    return `${deltaPhrase(stats.count, then.count, "reviews")} vs ${priorLabel}.`;
  };

  const setTitle = (pageId: string, title: string) =>
    onLayout(layout.map((p) => (p.id === pageId ? { ...p, title } : p)));

  const removeWidget = (pageId: string, widgetId: string) => {
    const next = layout
      .map((p) => (p.id === pageId ? { ...p, widgets: p.widgets.filter((w) => w.id !== widgetId) } : p))
      .filter((p) => p.widgets.length > 0 || layout.length === 1);
    onLayout(next.length ? next : layout);
  };

  const moveWidget = (fromPageId: string, widgetId: string, toPageId: string, beforeId?: string) => {
    if (fromPageId === toPageId && widgetId === beforeId) return;
    const from = layout.find((p) => p.id === fromPageId);
    let widget = from?.widgets.find((w) => w.id === widgetId);
    if (!widget) return;
    const stripped = layout.map((p) =>
      p.id === fromPageId ? { ...p, widgets: p.widgets.filter((w) => w.id !== widgetId) } : p,
    );
    const dest = stripped.find((p) => p.id === toPageId);
    if (dest && fromPageId !== toPageId && unitsLeft(dest) < sizeUnits(widget.size)) {
      const left = unitsLeft(dest);
      if (left < 1) return;
      widget = { ...widget, size: left >= 2 ? "m" : "s" };
    }
    const next = stripped.map((p) => {
      if (p.id !== toPageId) return p;
      const list = [...p.widgets];
      const at = beforeId ? list.findIndex((w) => w.id === beforeId) : list.length;
      list.splice(at < 0 ? list.length : at, 0, widget);
      return { ...p, widgets: list };
    });
    onLayout(next.filter((p) => p.widgets.length > 0 || p.id === toPageId));
  };

  const topicLimit = (span: PresentSpan) => (span === "full" ? 14 : span === "tall" ? 12 : span === "wide" ? 8 : 5);

  const competitorTable = (wide = false) => (
    <div className="gr-sheet overflow-hidden">
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="border-b border-[#eef0f2] text-[10px] uppercase tracking-wide text-[#8a9198]">
            <th className="px-3 py-2 font-medium">Company</th>
            {wide ? <th className="px-3 py-2 font-medium">TrustScore</th> : null}
            <th className="px-3 py-2 font-medium">Poker</th>
            {wide ? <th className="px-3 py-2 font-medium">Reviews</th> : null}
            <th className="px-3 py-2 font-medium">Matching</th>
            <th className="px-3 py-2 font-medium">Stars</th>
          </tr>
        </thead>
        <tbody>
          {compareBrands.map((b) => (
            <tr key={b.scrape.slug} className="border-b border-[#f4f5f6] last:border-0">
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: b.color }} />
                  <BrandIcon slug={b.scrape.slug} name={b.scrape.displayName} size={16} />
                  {b.scrape.displayName}
                </span>
              </td>
              {wide ? (
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-semibold tabular-nums">
                    {b.scrape.trustScore != null ? b.scrape.trustScore.toFixed(1) : "—"}
                  </span>
                  {b.scrape.trustScore != null ? <TpStars rating={b.scrape.trustScore} size={12} /> : null}
                </span>
              </td>
              ) : null}
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-semibold tabular-nums">
                    {b.pokerScore != null ? b.pokerScore.toFixed(1) : "—"}
                  </span>
                  {b.pokerScore != null ? <TpStars rating={b.pokerScore} size={12} /> : null}
                </span>
              </td>
              {wide ? (
                <td className="px-3 py-2 tabular-nums">{(b.scrape.totalReviews ?? b.all.count).toLocaleString()}</td>
              ) : null}
              <td className="px-3 py-2 tabular-nums">{b.stats.count.toLocaleString()}</td>
              <td className="px-3 py-2 min-w-[110px]">
                <MiniStarBar stars={b.all.stars} total={b.all.count} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const chartLegend = (
    <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-[#6c737a]">
      {seriesBrands.map((b) => (
        <span key={b.id} className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: b.color }} />
          {b.name}
        </span>
      ))}
    </div>
  );

  const chartH = (span: PresentSpan) => (span === "full" ? 188 : span === "wide" || span === "tall" ? 156 : 112);

  const renderWidget = (w: PresentWidget, span: PresentSpan) => {
    if (w.type === "briefing") {
      return (
        <div className="gr-stage-col">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ScorePair
              officialScore={scrape.trustScore}
              officialCount={scrape.totalReviews}
              pokerScore={pokerScore}
              pokerCount={pokerCount}
              pokerCaption={pokerCaption}
              size={14}
              compact
            />
            <span className="text-[11px] text-[#6c737a]">
              {windowLabel} · {stats.count.toLocaleString()} matching this month
            </span>
          </div>
          {mix ? <p className="mt-3 text-[12px] text-[#3d4349]">{mix}</p> : null}
          <div className="mt-auto grid grid-cols-2 gap-4 pt-3">
            <SentimentSlider value={stats.sentiment} />
            <ReviewsMeter count={stats.count} max={Math.max(stats.count, windowTotal, 1)} />
          </div>
        </div>
      );
    }
    if (w.type === "topics") {
      const limit = topicLimit(span);
      return (
        <div className="gr-stage-col">
          <div className={`grid min-h-0 flex-1 gap-5 ${span === "quarter" ? "grid-cols-1" : "grid-cols-2"}`}>
            <div className="min-h-0">
              <h3 className="mb-2 text-[12px] font-semibold">Positive by topic</h3>
              <TopicBars rows={topicRows} mode="positive" limit={limit} />
            </div>
            {span !== "quarter" ? (
              <div className="min-h-0">
                <h3 className="mb-2 text-[12px] font-semibold">Negative by topic</h3>
                <TopicBars rows={topicRows} mode="negative" limit={limit} />
              </div>
            ) : null}
          </div>
        </div>
      );
    }
    if (w.type === "sentiment") {
      return (
        <div className="gr-stage-col justify-center gap-4">
          <SentimentSlider value={stats.sentiment} />
          <ReviewsMeter count={stats.count} max={Math.max(stats.count, windowTotal, 1)} />
        </div>
      );
    }
    if (w.type === "comments") {
      return (
        <div className="gr-stage-col">
          <div className={`grid flex-1 content-start gap-x-6 gap-y-0 ${span === "quarter" ? "grid-cols-1" : "grid-cols-2"}`}>
            {featured.map((r) => (
              <CommentCard
                key={r.id}
                review={r}
                keywords={highlightKeys}
                pool={filtered}
                onRemove={() => onFeatured(featuredIds.filter((id) => id !== r.id))}
                onExclude={onExclude ? () => onExclude(r) : undefined}
                onReplace={(id) => {
                  const next = featuredIds.map((x) => (x === r.id ? id : x));
                  onFeatured(Array.from(new Set(next)).slice(0, 5));
                }}
              />
            ))}
            {featured.length < 5 ? (
              <AddComment
                pool={filtered}
                taken={new Set(featuredIds)}
                onAdd={(id) => onFeatured([...featuredIds, id].slice(0, 5))}
              />
            ) : null}
          </div>
        </div>
      );
    }
    if (w.type === "competitors") {
      return (
        <div className="gr-stage-col gap-2">
          {span !== "quarter" ? (
            <EditableCopy
              text={competitor.join("\n")}
              field="competitor briefing"
              brand={brand}
              facts={facts}
              multiline
              onSave={(t) =>
                patch({
                  competitor: t
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          ) : null}
          <div className="min-h-0 flex-1 overflow-auto">
            {competitorTable(span === "full" || span === "wide")}
            {sliderBrands.length > 1 && span !== "quarter" ? (
              <div className="mt-3">
                <h3 className="mb-2 text-[12px] font-semibold">Topic sentiment</h3>
                <CompetitorSliders brands={sliderBrands} compact />
              </div>
            ) : null}
          </div>
        </div>
      );
    }
    if (w.type === "lines") {
      return (
        <div className="gr-stage-col">
          <h3 className="mb-1 text-[12px] font-semibold">Sentiment over time</h3>
          <div className="gr-stage-chart" style={{ height: chartH(span) }}>
            <CompetitorLines brands={seriesBrands} />
          </div>
          {chartLegend}
        </div>
      );
    }
    if (w.type === "sliders") {
      return (
        <div className="gr-stage-col">
          <h3 className="mb-2 text-[12px] font-semibold">Topic sentiment by competitor</h3>
          <div className="min-h-0 flex-1 overflow-hidden">
            <CompetitorSliders brands={sliderBrands} compact />
          </div>
        </div>
      );
    }
    if (w.type === "trends") {
      return (
        <div className="gr-stage-col gap-2">
          <div>
            <h3 className="mb-1 text-[12px] font-semibold">Sentiment over time</h3>
            <div className="gr-stage-chart" style={{ height: Math.min(chartH(span), 140) }}>
              <CompetitorLines brands={seriesBrands} />
            </div>
            {chartLegend}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <h3 className="mb-1 text-[12px] font-semibold">Topic sentiment</h3>
            <CompetitorSliders brands={sliderBrands} compact />
          </div>
        </div>
      );
    }
    if (w.type === "keywords") {
      return (
        <div className="gr-stage-col">
          <h3 className="mb-2 text-[12px] font-semibold">Keywords mentioned</h3>
          <div className="min-h-0 flex-1 overflow-hidden">
            <KeywordMentionBars rows={keywordRows} limit={span === "quarter" ? 6 : 12} />
          </div>
        </div>
      );
    }
    if (w.type === "stars") {
      return (
        <div className="gr-stage-col">
          <h3 className="mb-2 text-[12px] font-semibold">Star distribution</h3>
          <StarDistribution stars={stats.stars} total={stats.count} />
        </div>
      );
    }
    if (w.type === "timeline") {
      return (
        <div className="gr-stage-col">
          <h3 className="mb-1 text-[12px] font-semibold">Topic performance</h3>
          <div className="gr-stage-chart" style={{ height: chartH(span) }}>
            <TimelineChart points={points} />
          </div>
        </div>
      );
    }
    if (w.type === "actions") {
      return (
        <div className="gr-stage-col gap-4 overflow-auto">
          <div>
            <h3 className="mb-1.5 text-[12px] font-semibold">Topic spikes</h3>
            {spikes.length ? (
              <ul className="gr-copy list-disc space-y-1 pl-4">
                {spikes.map((t) => (
                  <li key={t.topic}>
                    {t.topic} — {t.negative} negative / {t.positive} positive
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-[#8a9198]">No topic has a clear negative spike in this matching set.</p>
            )}
          </div>
          <div>
            <h3 className="mb-1.5 text-[12px] font-semibold">Threats and watch</h3>
            {watch.length ? (
              <ul className="gr-copy list-disc space-y-1 pl-4">
                {watch.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-[#8a9198]">Refresh the briefing to fill threats.</p>
            )}
          </div>
          <div>
            <h3 className="mb-1.5 text-[12px] font-semibold">How to improve</h3>
            {(summary?.actions ?? []).length ? (
              <ul className="gr-copy list-disc space-y-1 pl-4">
                {(summary?.actions ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-[#8a9198]">Refresh the briefing for concrete next steps.</p>
            )}
          </div>
          {(summary?.pains ?? []).length ? (
            <div>
              <h3 className="mb-1.5 text-[12px] font-semibold">Biggest pains</h3>
              <ul className="gr-copy list-disc space-y-1 pl-4">
                {(summary?.pains ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      );
    }
    return (
      <div className="gr-stage-col">
        <h3 className="mb-1 text-[12px] font-semibold">Tag cloud</h3>
        <div className="min-h-0 flex-1 overflow-hidden">
          <TagCloud words={cloud} />
        </div>
      </div>
    );
  };

  return (
    <div className="gr-deck">
      {layout.map((page, i) => {
        const spans = widgetSpans(page.widgets, page.stack ?? "row");
        const twoMedium =
          page.widgets.length === 2 && page.widgets.every((w) => w.size === "m");
        const vacant = emptySpan(page);
        return (
          <section key={page.id} className="gr-stage">
            <div className="gr-stage-head">
              <div className="flex items-center gap-2">
                <input
                  value={page.title}
                  onChange={(e) => setTitle(page.id, e.target.value)}
                  placeholder={titleFallback}
                  className="gr-page-title"
                />
                {twoMedium ? (
                  <button
                    type="button"
                    className="gr-no-print gr-chip shrink-0"
                    onClick={() =>
                      onLayout(
                        layout.map((p) =>
                          p.id === page.id ? { ...p, stack: (p.stack ?? "row") === "row" ? "col" : "row" } : p,
                        ),
                      )
                    }
                  >
                    {(page.stack ?? "row") === "row" ? "Stack" : "Side by side"}
                  </button>
                ) : null}
                <div className="gr-no-print shrink-0">
                  <SlotAdd used={usedTypes} onAdd={(type) => onLayout(addWidgetToPage(layout, page.id, type))} />
                </div>
              </div>
              <div className="gr-title-rule" />
            </div>
            <div className="gr-stage-split">
              <aside className="gr-slide-note">
                <SlideNote
                  page={page}
                  headline={
                    summary?.headline?.trim() &&
                    !headlineOverclaims(summary.headline, windowLabel)
                      ? summary.headline.trim()
                      : filterOn
                        ? `${windowLabel} · ${stats.count} of ${windowTotal} match ${filterLabel}`
                        : `${windowLabel} summary`
                  }
                  period={period}
                  positive={positive}
                  negative={negative}
                  changed={changed}
                  explainWidget={explainWidget}
                  compareWidget={compareWidget}
                  priors={priors}
                  deckCompareId={compareWithId}
                  onCompareDeck={onCompare}
                  onPageCompare={(id) =>
                    onLayout(layout.map((p) => (p.id === page.id ? { ...p, compareId: id } : p)))
                  }
                  onNote={(note) =>
                    onLayout(layout.map((p) => (p.id === page.id ? { ...p, note } : p)))
                  }
                  brand={brand}
                  facts={facts}
                />
              </aside>
            <div className="gr-stage-body">
              {page.widgets.map((w, wi) => (
                <div
                  key={w.id}
                  className="gr-widget"
                  data-span={spans[wi]}
                  data-size={w.size}
                  draggable
                  onDragStart={() => setDrag({ pageId: page.id, widgetId: w.id })}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (drag) moveWidget(drag.pageId, drag.widgetId, page.id, w.id);
                    setDrag(null);
                  }}
                >
                  <div className="gr-widget-bar">
                    <GripVertical className="size-3.5" />
                    <span>{w.type}</span>
                    <div className="gr-size">
                      {(["s", "m", "l"] as PresentSize[]).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          data-on={String(w.size === sz)}
                          onClick={() => onLayout(setWidgetSize(layout, page.id, w.id, sz))}
                        >
                          {sz.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => removeWidget(page.id, w.id)} aria-label={`Remove ${w.type}`}>
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                  {renderWidget(w, spans[wi])}
                </div>
              ))}
              {vacant ? (
                <div
                  className="gr-slot-empty"
                  data-span={vacant}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (drag) moveWidget(drag.pageId, drag.widgetId, page.id);
                    setDrag(null);
                  }}
                >
                  <SlotAdd used={usedTypes} onAdd={(type) => onLayout(addWidgetToPage(layout, page.id, type))} />
                </div>
              ) : null}
            </div>
            </div>
            <div className="gr-stage-foot">
              <div className="gr-no-print flex items-center gap-1">
                <button
                  type="button"
                  className="gr-icon-btn"
                  disabled={i === 0}
                  onClick={() => onLayout(movePage(layout, i, -1))}
                  aria-label="Move page up"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="gr-icon-btn"
                  disabled={i === layout.length - 1}
                  onClick={() => onLayout(movePage(layout, i, 1))}
                  aria-label="Move page down"
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
              <span>
                {i + 1} / {layout.length}
              </span>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function AddWidgetMenu({
  layout,
  onAdd,
  onAddPage,
}: {
  layout: PresentPage[];
  onAdd: (type: PresentWidgetType) => void;
  onAddPage: () => void;
}) {
  const have = new Set(layout.flatMap((p) => p.widgets.map((w) => w.type)));
  return (
    <div className="flex items-center gap-2">
      <select
        value=""
        onChange={(e) => {
          const type = e.target.value as PresentWidgetType;
          if (type) onAdd(type);
          e.target.value = "";
        }}
        className="h-8 rounded-md border border-[#e3e6ea] bg-white px-2 text-[12px] text-[#191919] outline-none"
      >
        <option value="">Add widget</option>
        {PRESENT_WIDGETS.map((o) => (
          <option key={o.type} value={o.type} disabled={have.has(o.type)}>
            {o.label}
          </option>
        ))}
      </select>
      <button type="button" className="gr-chip" onClick={onAddPage}>
        <Plus className="size-3" /> Page
      </button>
    </div>
  );
}
