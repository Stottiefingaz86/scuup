"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { CloudWord, ReviewStats, TimelinePoint, TopicRow } from "@/lib/grace/analysis";
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
  type SavedReportSummary,
  hasFullCopy,
} from "@/lib/grace/reports";
import type { GraceReview, GraceScrape } from "@/lib/grace/types";
import {
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
import { Highlight } from "./grace-reviews";
import { TagCloud } from "./tag-cloud";
import { TpScore, TpStars } from "./tp-stars";

function EditableCopy({
  text,
  field,
  brand,
  multiline = false,
  onSave,
}: {
  text: string;
  field: string;
  brand: string;
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
        body: JSON.stringify({ text: draft || text, field, brand }),
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
  onReplace,
}: {
  review: GraceReview;
  keywords: string[];
  pool: GraceReview[];
  onRemove: () => void;
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
          Remove
        </button>
      </div>
      <div className="text-[12px] font-semibold text-[#191919]">{review.author}</div>
      <div className="mt-0.5">
        <TpStars rating={review.rating} size={13} />
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
  layout,
  onLayout,
  onSummary,
  onFeatured,
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
  layout: PresentPage[];
  onLayout: (next: PresentPage[]) => void;
  onSummary: (next: SavedReportSummary) => void;
  onFeatured: (ids: string[]) => void;
}) {
  const [drag, setDrag] = useState<{ pageId: string; widgetId: string } | null>(null);
  const brand = scrape.displayName;
  const period = hasFullCopy(summary) ? summary.period : [];
  const mix = hasFullCopy(summary) ? summary.mix : "";
  const positive = hasFullCopy(summary) ? summary.positive : "";
  const negative = hasFullCopy(summary) ? summary.negative : "";
  const watch = hasFullCopy(summary) ? summary.watch : [];
  const changed = hasFullCopy(summary) ? summary.changed : [];
  const competitor = hasFullCopy(summary) && summary.competitor.length ? summary.competitor : vsCopy;
  const titleFallback = ["Trustpilot —", shortName, filterLabel === "All reviews" ? "" : filterLabel]
    .filter(Boolean)
    .join(" ");
  const featuredIds = featured.map((r) => r.id);
  const usedTypes = new Set(layout.flatMap((p) => p.widgets.map((w) => w.type)));

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
    };
    onSummary({ ...base, ...partial });
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
            <th className="px-3 py-2 font-medium">TrustScore</th>
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
                  <span className="size-2 rounded-full" style={{ background: b.color }} />
                  {b.scrape.displayName}
                </span>
              </td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-semibold tabular-nums">
                    {b.scrape.trustScore != null ? b.scrape.trustScore.toFixed(1) : "—"}
                  </span>
                  {b.scrape.trustScore != null ? <TpStars rating={b.scrape.trustScore} size={12} /> : null}
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
          <div className="flex items-center gap-2">
            <TpScore score={scrape.trustScore} size={15} />
            <span className="text-[11px] text-[#6c737a]">
              {windowLabel} · {stats.count.toLocaleString()} matching · {windowTotal.toLocaleString()} in window
            </span>
          </div>
          <div className="mt-1.5 space-y-1">
            <EditableCopy
              text={period.join("\n")}
              field="period lines"
              brand={brand}
              multiline
              onSave={(t) =>
                patch({
                  period: t
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
            <EditableCopy text={mix} field="mix line" brand={brand} onSave={(t) => patch({ mix: t })} />
          </div>
          <p className="mt-1.5 text-[11px] font-semibold text-[#191919]">Positive reviews</p>
          <EditableCopy text={positive} field="positive" brand={brand} onSave={(t) => patch({ positive: t })} />
          <p className="mt-1 text-[11px] font-semibold text-[#191919]">Negative reviews</p>
          <EditableCopy text={negative} field="negative" brand={brand} onSave={(t) => patch({ negative: t })} />
          {span !== "quarter" ? (
            <>
              <p className="mt-1 text-[11px] font-semibold text-[#191919]">What changed</p>
              <EditableCopy
                text={changed.join("\n")}
                field="what changed"
                brand={brand}
                multiline
                onSave={(t) =>
                  patch({
                    changed: t
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
              <p className="mt-1 text-[11px] font-semibold text-[#191919]">Issues to watch</p>
              <EditableCopy
                text={watch.join("\n")}
                field="issues to watch"
                brand={brand}
                multiline
                onSave={(t) =>
                  patch({
                    watch: t
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </>
          ) : null}
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
