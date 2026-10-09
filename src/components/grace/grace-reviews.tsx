"use client";

import { useState } from "react";
import { highlightSegments } from "@/lib/grace/analysis";
import { hasStars, redditSubreddit, reviewSource, type GraceReview } from "@/lib/grace/types";
import { TpStars } from "./tp-stars";

function sourceLabel(review: GraceReview): string {
  const source = reviewSource(review);
  if (source === "reddit") {
    const sub = redditSubreddit(review);
    return sub ? `r/${sub}` : "Reddit";
  }
  if (source === "twoplustwo") return "2+2";
  if (source === "web") {
    try {
      return review.url ? new URL(review.url).hostname.replace(/^www\./, "") : "Web";
    } catch {
      return "Web";
    }
  }
  return "Trustpilot";
}

export function SourceBadge({ review }: { review: GraceReview }) {
  const source = reviewSource(review);
  const label = sourceLabel(review);
  if (review.url && source !== "trustpilot") {
    return (
      <a href={review.url} target="_blank" rel="noreferrer" className="gr-source" data-source={source}>
        {label}
      </a>
    );
  }
  return (
    <span className="gr-source" data-source={source}>
      {label}
    </span>
  );
}

export function Highlight({ text, keywords }: { text: string; keywords: string[] }) {
  const segs = highlightSegments(text, keywords);
  return (
    <>
      {segs.map((s, i) =>
        s.hit ? (
          <mark key={i} className="gr-hit">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Trustpilot-style review row: name + stars on the left, title and body on the right. */
export function ReviewCard({
  review,
  keywords,
  matched,
  pinned,
  onPin,
  onExclude,
}: {
  review: GraceReview;
  keywords: string[];
  matched?: boolean;
  pinned?: boolean;
  onPin?: (review: GraceReview) => void;
  onExclude?: (review: GraceReview) => void;
}) {
  const [open, setOpen] = useState(false);
  const long = review.text.length > 360;
  const body = open || !long ? review.text : `${review.text.slice(0, 360)}…`;
  return (
    <article className="tp-review">
      {onPin || onExclude ? (
        <div className="tp-review-actions">
          {onPin ? (
            <button type="button" className="tp-review-pin" onClick={() => onPin(review)}>
              {pinned ? "In presentation" : "Add to presentation"}
            </button>
          ) : null}
          {onExclude ? (
            <button type="button" className="tp-review-drop" onClick={() => onExclude(review)}>
              Remove
            </button>
          ) : null}
        </div>
      ) : null}
      <div>
        <div className="tp-review-name">
          {review.author}
          {matched ? <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[#00b67a]">Match</span> : null}
        </div>
        <div className="tp-review-meta">
          <SourceBadge review={review} />
          {review.country ? ` · ${review.country}` : ""}
          {` · ${fmtDate(review.date)}`}
          {review.verified ? " · Verified" : ""}
          {reviewSource(review) === "reddit" && review.likes ? ` · ${review.likes} upvotes` : ""}
        </div>
        {hasStars(review) ? (
          <div className="mt-2.5">
            <TpStars rating={review.rating} size={18} />
          </div>
        ) : null}
      </div>
      <div>
        {review.title ? (
          <h4 className="tp-review-title">
            <Highlight text={review.title} keywords={keywords} />
          </h4>
        ) : null}
        <p className="tp-review-body">
          <Highlight text={body} keywords={keywords} />
          {long ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="ml-1 cursor-pointer text-[13px] font-medium text-[#00b67a]"
            >
              {open ? "See less" : "See more"}
            </button>
          ) : null}
        </p>
        {review.reply && open ? (
          <div className="tp-reply">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6c737a]">
              Reply from the business
            </div>
            {review.reply}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function ReviewList({
  reviews,
  keywords,
  pageSize = 8,
  matchIds,
  pinnedIds,
  onPin,
  onExclude,
}: {
  reviews: GraceReview[];
  keywords: string[];
  pageSize?: number;
  matchIds?: Set<string>;
  pinnedIds?: string[];
  onPin?: (review: GraceReview) => void;
  onExclude?: (review: GraceReview) => void;
}) {
  const [shown, setShown] = useState(pageSize);
  if (reviews.length === 0) {
    return <p className="py-10 text-center text-sm text-[#6c737a]">No reviews match these filters.</p>;
  }
  return (
    <div>
      {reviews.slice(0, shown).map((r) => (
        <ReviewCard
          key={r.id}
          review={r}
          keywords={keywords}
          matched={matchIds?.has(r.id)}
          pinned={pinnedIds?.includes(r.id)}
          onPin={onPin}
          onExclude={onExclude}
        />
      ))}
      {shown < reviews.length ? (
        <button
          type="button"
          onClick={() => setShown((n) => n + pageSize * 2)}
          className="gr-no-print mt-4 cursor-pointer text-[13px] font-medium text-[#00b67a]"
        >
          Show more reviews ({reviews.length - shown} left)
        </button>
      ) : null}
    </div>
  );
}

/** Compact quote used on the Reviews slide — matches the example report. */
export function FeaturedReview({
  review,
  keywords,
  compact = false,
  pinned,
  onPin,
  onExclude,
}: {
  review: GraceReview;
  keywords: string[];
  compact?: boolean;
  pinned?: boolean;
  onPin?: (review: GraceReview) => void;
  onExclude?: (review: GraceReview) => void;
}) {
  const max = compact ? 180 : 280;
  const snippet = review.text.length > max ? `${review.text.slice(0, max - 1)}…` : review.text;
  return (
    <article className={`relative ${compact ? "py-3" : "py-4"}`}>
      {onPin || onExclude ? (
        <div className="tp-review-actions">
          {onPin ? (
            <button type="button" className="tp-review-pin" onClick={() => onPin(review)}>
              {pinned ? "In presentation" : "Add to presentation"}
            </button>
          ) : null}
          {onExclude ? (
            <button type="button" className="tp-review-drop" onClick={() => onExclude(review)}>
              Remove
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="text-[13px] font-semibold text-[#191919]">{review.author}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <SourceBadge review={review} />
        {hasStars(review) ? <TpStars rating={review.rating} size={16} /> : null}
      </div>
      {review.title ? (
        <h4 className="mt-2 text-[14px] font-semibold text-[#191919]">
          <Highlight text={review.title} keywords={keywords} />
        </h4>
      ) : null}
      <p className="mt-1 text-[13.5px] leading-relaxed text-[#3d4349]">
        <Highlight text={snippet} keywords={keywords} />
      </p>
    </article>
  );
}
