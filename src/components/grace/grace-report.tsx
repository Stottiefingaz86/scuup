"use client";

import { reviewMatches, type ReviewStats, type TopicRow } from "@/lib/grace/analysis";
import { hasFullCopy, type SavedReportSummary } from "@/lib/grace/reports";
import type { GraceReview, GraceScrape } from "@/lib/grace/types";
import {
  CompetitorLines,
  CompetitorSliders,
  MiniStarBar,
  ReviewsMeter,
  SentimentSlider,
  TopicBars,
  type SeriesBrand,
  type SliderBrand,
} from "./grace-charts";
import { FeaturedReview } from "./grace-reviews";
import { TpScore, TpStars } from "./tp-stars";

export interface ReportBrand {
  scrape: GraceScrape;
  self: boolean;
  color: string;
  filtered: GraceReview[];
  stats: ReviewStats;
  all: ReviewStats;
}

export function GraceReport({
  scrape,
  shortName,
  filterLabel,
  windowLabel,
  windowReviews,
  windowTotal,
  captured,
  partial,
  filtered,
  stats,
  topicRows,
  featured,
  highlightKeys,
  summary,
  vsCopy,
  compareBrands,
  sliderBrands,
  seriesBrands,
  onShowReviews,
}: {
  scrape: GraceScrape;
  shortName: string;
  filterLabel: string;
  windowLabel: string;
  windowReviews: GraceReview[];
  windowTotal: number;
  captured: number;
  partial: boolean;
  filtered: GraceReview[];
  stats: ReviewStats;
  topicRows: TopicRow[];
  featured: GraceReview[];
  highlightKeys: string[];
  summary: SavedReportSummary | null;
  vsCopy: string[];
  compareBrands: ReportBrand[];
  sliderBrands: SliderBrand[];
  seriesBrands: SeriesBrand[];
  onShowReviews: (title: string, list: GraceReview[]) => void;
}) {
  const period = hasFullCopy(summary) ? summary.period : [];
  const mix = hasFullCopy(summary) ? summary.mix : "";
  const positive = hasFullCopy(summary) ? summary.positive : "";
  const negative = hasFullCopy(summary) ? summary.negative : "";
  const changed = hasFullCopy(summary) ? summary.changed : [];
  const watch = hasFullCopy(summary) ? summary.watch : [];
  const competitor = hasFullCopy(summary) && summary.competitor.length ? summary.competitor : vsCopy;
  const titleFilter = filterLabel === "All reviews" ? "" : filterLabel;
  const pos = featured.filter((r) => r.rating >= 4);
  const neg = featured.filter((r) => r.rating <= 2);
  const mid = featured.filter((r) => r.rating === 3);

  return (
    <div className="mx-auto w-full max-w-[1122px]">
      <section className="gr-slide">
        <h1 className="gr-title">
          Trustpilot — {shortName} {titleFilter}
        </h1>
        <div className="gr-title-rule" />

        <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <div className="flex items-center gap-3">
              <TpScore score={scrape.trustScore} size={18} />
              <button
                type="button"
                className="gr-count text-[13px] font-normal"
                onClick={() => onShowReviews(`${shortName} · all captured`, windowReviews)}
              >
                {scrape.totalReviews?.toLocaleString() ?? windowReviews.length} reviews on Trustpilot
              </button>
            </div>
            <p className="mt-2 text-[13px] text-[#8a9198]">
              {windowLabel} ·{" "}
              <button
                type="button"
                className="gr-count font-normal"
                onClick={() => onShowReviews(`${shortName} · ${windowLabel}`, windowReviews)}
              >
                {windowTotal.toLocaleString()} reviews
              </button>
              {partial ? ` · ${captured.toLocaleString()} captured` : ""}
              {stats.count !== windowTotal ? (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="gr-count font-normal"
                    onClick={() => onShowReviews(`${shortName} · ${filterLabel}`, filtered)}
                  >
                    {stats.count.toLocaleString()} match this filter
                  </button>
                </>
              ) : null}
            </p>
            <div className="gr-copy mt-5 space-y-2.5">
              {period.map((b) => (
                <p key={b}>{b}</p>
              ))}
              {mix ? <p>{mix}</p> : null}
            </div>
            <div className="mt-5 space-y-2.5">
              <p className="text-[13px] font-semibold text-[#191919]">Positive reviews:</p>
              <p className="gr-copy">{positive}</p>
              <p className="text-[13px] font-semibold text-[#191919]">Negative reviews:</p>
              <p className="gr-copy">{negative}</p>
            </div>
            {changed.length > 0 ? (
              <div className="mt-5">
                <p className="text-[13px] font-semibold text-[#191919]">What changed</p>
                <ul className="gr-copy mt-1.5 list-disc space-y-1 pl-4">
                  {changed.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {watch.length > 0 ? (
              <div className="mt-5">
                <p className="text-[13px] font-semibold text-[#191919]">Issues to watch</p>
                <ul className="gr-copy mt-1.5 list-disc space-y-1 pl-4">
                  {watch.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="gr-panel">
                <h3>Positive reviews by topic</h3>
                <TopicBars
                  rows={topicRows.slice(0, 8)}
                  mode="positive"
                  onPick={(topic) =>
                    onShowReviews(`${topic} · positive`, filtered.filter((r) => reviewMatches(r, [topic]) && r.rating >= 4))
                  }
                />
              </div>
              <div className="gr-panel">
                <h3>Negative reviews by topic</h3>
                <TopicBars
                  rows={topicRows.slice(0, 8)}
                  mode="negative"
                  onPick={(topic) =>
                    onShowReviews(`${topic} · negative`, filtered.filter((r) => reviewMatches(r, [topic]) && r.rating <= 2))
                  }
                />
              </div>
            </div>
            <div className="gr-panel grid gap-6 sm:grid-cols-2">
              <SentimentSlider value={stats.sentiment} />
              <ReviewsMeter count={stats.count} max={Math.max(stats.count, windowTotal, 1)} />
            </div>
          </div>
        </div>
      </section>

      <section className="gr-slide">
        <h1 className="gr-title">Trustpilot — {shortName} Reviews</h1>
        <div className="gr-title-rule" />
        {featured.length === 0 ? (
          <p className="mt-10 text-[14px] text-[#6c737a]">
            No comments selected. Edit the dashboard, search comments, and pick up to five.
          </p>
        ) : (
          <div className="mt-8 grid gap-x-12 gap-y-2 md:grid-cols-2">
            {(pos.length || neg.length || mid.length
              ? [...pos, ...mid, ...neg]
              : featured
            ).map((r) => (
              <FeaturedReview key={r.id} review={r} keywords={highlightKeys} compact />
            ))}
          </div>
        )}
      </section>

      <section className="gr-slide">
        <h1 className="gr-title">Trustpilot — {shortName} vs Competitors</h1>
        <div className="gr-title-rule" />

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="gr-copy space-y-2.5">
            {competitor.length ? (
              competitor.map((l) => <p key={l}>{l}</p>)
            ) : (
              <p>No competitor data in this report.</p>
            )}
          </div>
          {compareBrands.length > 0 ? (
            <div className="gr-panel overflow-x-auto p-0!">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#eef0f2] text-[11px] uppercase tracking-wide text-[#8a9198]">
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">TrustScore</th>
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
                          <span className="size-2 rounded-full" style={{ background: b.color }} />
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
                      <td className="px-4 py-3 tabular-nums">
                        {(b.scrape.totalReviews ?? b.all.count).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{b.stats.count.toLocaleString()}</td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <MiniStarBar stars={b.all.stars} total={b.all.count} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      {compareBrands.length > 1 ? (
        <section className="gr-slide">
          <h1 className="gr-title">Trustpilot — {shortName} trends</h1>
          <div className="gr-title-rule" />
          <div className="mt-8 grid gap-5">
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
            <div className="gr-panel">
              <h3>Topic sentiment by competitor</h3>
              <CompetitorSliders brands={sliderBrands} />
              <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-[#6c737a]">
                {sliderBrands.map((b) => (
                  <span key={b.id} className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ background: b.color }} />
                    {b.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
