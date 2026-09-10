"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { cn } from "@/lib/utils";
import type { JourneyStageResult } from "@/lib/research/types";

export type JourneyFrame = {
  src: string;
  stageId: string;
  stageLabel: string;
  /** 1-based position within the stage. */
  index: number;
  total: number;
  evidence?: string | null;
};

type Ctx = {
  frames: JourneyFrame[];
  open: (src: string) => void;
};

const FrameViewerCtx = createContext<Ctx | null>(null);

/** Every frame of the run in journey order — stage order, then capture order. */
export function journeyFrames(stages: JourneyStageResult[]): JourneyFrame[] {
  const seen = new Set<string>();
  const out: JourneyFrame[] = [];
  for (const s of stages) {
    const shots = (s.screenshotUrls ?? []).filter((u) => {
      if (!u || seen.has(u)) return false;
      seen.add(u);
      return true;
    });
    shots.forEach((src, i) =>
      out.push({
        src,
        stageId: s.stageId,
        stageLabel: s.label,
        index: i + 1,
        total: shots.length,
        evidence: s.evidence,
      }),
    );
  }
  return out;
}

/**
 * Wrap a journey view in this and every <FrameThumb> inside opens one shared
 * viewer you can step through with ‹ › or the arrow keys — no close/reopen.
 */
export function JourneyFrameViewer({
  stages,
  children,
}: {
  stages: JourneyStageResult[];
  children: React.ReactNode;
}) {
  const frames = useMemo(() => journeyFrames(stages), [stages]);
  const [idx, setIdx] = useState<number | null>(null);

  const open = useCallback(
    (src: string) => {
      const i = frames.findIndex((f) => f.src === src);
      if (i >= 0) setIdx(i);
    },
    [frames],
  );

  const step = useCallback(
    (d: number) => {
      setIdx((cur) => {
        if (cur == null) return cur;
        const next = cur + d;
        return next < 0 || next >= frames.length ? cur : next;
      });
    },
    [frames.length],
  );

  useEffect(() => {
    if (idx == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, step]);

  const cur = idx != null ? frames[idx] : null;
  const ctx = useMemo(() => ({ frames, open }), [frames, open]);

  return (
    <FrameViewerCtx.Provider value={ctx}>
      {children}
      <Dialog open={cur != null} onOpenChange={(o) => !o && setIdx(null)}>
        <DialogContent className="w-auto max-w-[min(96vw,1200px)] gap-2 p-3 sm:max-w-[min(96vw,1200px)]">
          <DialogTitle className="flex items-baseline gap-2 pe-8 text-sm text-muted-foreground">
            {cur ? (
              <>
                <span className="font-medium text-foreground">
                  {cur.stageLabel}
                </span>
                <span>
                  {cur.index}/{cur.total}
                </span>
                {cur.evidence ? (
                  <span className="truncate">— {cur.evidence}</span>
                ) : null}
                <span className="ml-auto tabular-nums">
                  {idx! + 1} of {frames.length}
                </span>
              </>
            ) : (
              "Frame"
            )}
          </DialogTitle>
          <div className="relative">
            <div className="max-h-[78vh] overflow-auto rounded-lg border">
              {cur ? (
                /* eslint-disable-next-line @next/next/no-img-element -- runtime evidence file */
                <img
                  src={cur.src}
                  alt={`${cur.stageLabel} ${cur.index}`}
                  className="w-full"
                />
              ) : null}
            </div>
            <NavButton
              side="left"
              disabled={idx === 0}
              onClick={() => step(-1)}
            />
            <NavButton
              side="right"
              disabled={idx == null || idx >= frames.length - 1}
              onClick={() => step(1)}
            />
          </div>
          {/* Filmstrip of the whole journey — jump anywhere. */}
          <div className="flex gap-1 overflow-x-auto pb-1 pt-1">
            {frames.map((f, i) => (
              <button
                key={f.src}
                type="button"
                onClick={() => setIdx(i)}
                title={`${f.stageLabel} ${f.index}/${f.total}`}
                className={cn(
                  "h-10 w-10 shrink-0 overflow-hidden rounded border",
                  i === idx
                    ? "border-primary"
                    : "border-border opacity-70 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- runtime evidence file */}
                <img
                  src={f.src}
                  alt=""
                  className="h-full w-full object-cover object-top"
                />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </FrameViewerCtx.Provider>
  );
}

function NavButton({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={side === "left" ? "Previous frame" : "Next frame"}
      className={cn(
        "absolute top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border bg-background/85 text-foreground shadow-sm backdrop-blur transition-opacity hover:bg-background disabled:opacity-25",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}

/**
 * Thumbnail that opens the shared journey viewer when one is mounted above it,
 * otherwise falls back to the standalone lightbox.
 */
export function FrameThumb(props: {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
  imgClassName?: string;
  style?: React.CSSProperties;
}) {
  const ctx = useContext(FrameViewerCtx);
  const inJourney = ctx?.frames.some((f) => f.src === props.src);
  if (!ctx || !inJourney) return <ScreenshotLightbox {...props} />;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        ctx.open(props.src);
      }}
      title="Open — use ‹ › to step through the journey"
      className={cn(
        "group relative block cursor-zoom-in overflow-hidden rounded-md border transition-opacity hover:opacity-90",
        props.className,
      )}
      style={props.style}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- runtime evidence file */}
      <img
        src={props.src}
        alt={props.alt}
        loading="lazy"
        className={cn(
          "h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]",
          props.imgClassName,
        )}
      />
    </button>
  );
}
