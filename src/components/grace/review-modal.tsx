"use client";

import { X } from "lucide-react";
import type { GraceReview } from "@/lib/grace/types";
import { ReviewList } from "./grace-reviews";

export function ReviewModal({
  title,
  reviews,
  keywords,
  pinnedIds,
  onPin,
  onClose,
}: {
  title: string;
  reviews: GraceReview[];
  keywords: string[];
  pinnedIds?: string[];
  onPin?: (review: GraceReview) => void;
  onClose: () => void;
}) {
  return (
    <div className="gr-no-print fixed inset-0 z-50 flex items-start justify-center bg-[#191919]/35 p-4 pt-[6vh] sm:p-8" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(25,25,25,0.18)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-label={title}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#eef0f2] px-6 py-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-[#191919]">{title}</h2>
            <p className="mt-0.5 text-[12px] text-[#6c737a]">{reviews.length.toLocaleString()} reviews</p>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-full p-1.5 text-[#6c737a] hover:bg-[#f4f5f6] hover:text-[#191919]" aria-label="Close">
            <X className="size-4" />
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-2">
          <ReviewList
            reviews={reviews}
            keywords={keywords}
            pageSize={16}
            pinnedIds={pinnedIds}
            onPin={onPin}
          />
        </div>
      </div>
    </div>
  );
}
