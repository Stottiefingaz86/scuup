"use client";

import {
  emailTimelineLabel,
  formatEmailReceivedAt,
  sortEmailsForTimeline,
} from "@/lib/research/email-format";
import type { EmailWatchItem } from "@/lib/research/types";
import { ResearchEmailThumb } from "@/components/research-email-card";

/**
 * Oldest → newest, left to right. New mail lands on the end.
 */
export function ResearchEmailTimeline({
  emails,
  brandName,
}: {
  emails: EmailWatchItem[];
  brandName: (brandId: string) => string;
}) {
  const ordered = sortEmailsForTimeline(emails);
  if (!ordered.length) return null;
  return (
    <div className="relative -mx-1 overflow-x-auto pb-2">
      <ol className="flex min-w-min items-start gap-0 px-2 pt-1">
        {ordered.map((e, i) => {
          const time = formatEmailReceivedAt(e.receivedAt);
          const last = i === ordered.length - 1;
          return (
            <li
              key={e.id}
              className="flex w-[168px] shrink-0 flex-col items-center"
            >
              <time
                dateTime={e.receivedAt}
                title={time.absolute}
                className="mb-2 text-center text-[10px] tabular-nums text-[var(--rs-muted)]"
              >
                {time.relative}
              </time>
              <div className="flex w-full items-center">
                <span
                  className={`h-px flex-1 ${i === 0 ? "bg-transparent" : "bg-[var(--rs-border)]"}`}
                />
                <span className="size-2 shrink-0 rounded-full bg-[var(--rs-accent)]" />
                <span
                  className={`h-px flex-1 ${last ? "bg-transparent" : "bg-[var(--rs-border)]"}`}
                />
              </div>
              <div className="mt-3 w-full px-1">
                <ResearchEmailThumb email={e} width={160} height={200} />
                <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--rs-muted)]">
                  {emailTimelineLabel(e)}
                  {brandName(e.brandId) ? ` · ${brandName(e.brandId)}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
