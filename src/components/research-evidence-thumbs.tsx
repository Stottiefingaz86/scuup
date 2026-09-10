"use client";

import {
  FrameThumb,
  JourneyFrameViewer,
} from "@/components/research-frame-viewer";
import type { JourneyStageResult } from "@/lib/research/types";
import { cn } from "@/lib/utils";

export type EvidenceFrame = { src: string; label: string };

/** Frames for the given stages of a run, in journey order. */
export function stageFrames(
  stages: JourneyStageResult[] | null | undefined,
  stageIds: string[],
): EvidenceFrame[] {
  if (!stages) return [];
  const out: EvidenceFrame[] = [];
  const seen = new Set<string>();
  for (const id of stageIds) {
    const s = stages.find((x) => x.stageId === id);
    for (const src of s?.screenshotUrls ?? []) {
      if (!src || seen.has(src)) continue;
      seen.add(src);
      out.push({ src, label: s!.label });
    }
  }
  return out;
}

/** Slot width every cell reserves so numbers line up whether or not a row
 * has evidence. Keep small — the number is the hero, not the thumb. */
const SLOT = 20;
const SIZE = 14;

/**
 * Tiny circular thumbnail + count beside a metric. Hover fans a few frames
 * out; click opens the step-through viewer for exactly these frames.
 */
export function EvidenceThumbs({
  frames,
  max = 4,
  className,
}: {
  frames: EvidenceFrame[];
  max?: number;
  className?: string;
}) {
  if (frames.length === 0) {
    return (
      <span
        aria-hidden
        className={cn("inline-block shrink-0", className)}
        style={{ width: SLOT, height: SIZE }}
      />
    );
  }
  const stages: JourneyStageResult[] = [];
  for (const f of frames) {
    let st = stages.find((s) => s.label === f.label);
    if (!st) {
      st = {
        stageId: f.label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        label: f.label,
        userGoal: "",
        userAction: "",
        screen: "",
        steps: null,
        timeSec: null,
        waitSec: null,
        screenshotUrls: [],
      };
      stages.push(st);
    }
    st.screenshotUrls!.push(f.src);
  }
  const first = frames[0]!;
  const fan = frames.slice(0, max);
  const rest = frames.length - fan.length;
  return (
    <JourneyFrameViewer stages={stages}>
      <span
        className={cn(
          "group/ev relative inline-flex shrink-0 items-center justify-end align-middle",
          className,
        )}
        style={{ width: SLOT, height: SIZE }}
      >
        <span className="relative block" style={{ width: SIZE, height: SIZE }}>
          <FrameThumb
            src={first.src}
            alt={`${first.label} · ${frames.length} frames`}
            caption={first.label}
            className="block rounded-full bg-[var(--rs-bg)] ring-1 ring-white/25"
            style={{ width: SIZE, height: SIZE }}
          />
        </span>

        <span className="pointer-events-none absolute right-0 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1 rounded-full border border-[var(--rs-border)] bg-[var(--rs-card)] py-1 pl-2 pr-1 opacity-0 shadow-lg transition-opacity duration-150 group-hover/ev:pointer-events-auto group-hover/ev:opacity-100">
          <span className="mr-1 whitespace-nowrap text-[10px] text-[var(--rs-muted)]">
            {frames.length} frame{frames.length === 1 ? "" : "s"}
            {rest > 0 ? ` · +${rest} more` : ""}
          </span>
          {fan.map((f, i) => (
            <FrameThumb
              key={f.src}
              src={f.src}
              alt={`${f.label} ${i + 1}`}
              caption={f.label}
              className="block rounded-full bg-[var(--rs-bg)] ring-1 ring-white/25 transition-transform hover:scale-110"
              style={{ width: 18, height: 18 }}
            />
          ))}
        </span>
      </span>
    </JourneyFrameViewer>
  );
}
