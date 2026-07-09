"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toObservation, type JourneyAnalysis, type Observation } from "@/lib/types";

/** Highlight box drawn over a screenshot at the observation's region. */
function RegionBox({
  region,
  thumb = false,
}: {
  region: NonNullable<Observation["region"]>;
  thumb?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "absolute rounded-[2px] ring-brand",
        thumb
          ? "ring-1"
          : "rounded-sm ring-2 shadow-[0_0_0_4px_color-mix(in_oklch,var(--brand)_25%,transparent)]"
      )}
      style={{
        left: `${region.x}%`,
        top: `${region.y}%`,
        width: `${region.w}%`,
        height: `${region.h}%`,
      }}
    />
  );
}

/** Full screenshot with everything but the region dimmed. */
function EvidenceShot({
  src,
  region,
  className,
}: {
  src: string;
  region: Observation["region"];
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg border", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- runtime evidence file */}
      <img src={src} alt="Captured evidence screenshot" className="w-full" />
      {region ? (
        <>
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: "rgba(4, 8, 20, 0.55)",
              clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${region.y}%, ${region.x}% ${region.y}%, ${region.x}% ${region.y + region.h}%, ${region.x + region.w}% ${region.y + region.h}%, ${region.x + region.w}% ${region.y}%, 0 ${region.y}%)`,
            }}
          />
          <RegionBox region={region} />
        </>
      ) : null}
    </div>
  );
}

/**
 * Observation list backed by captured screenshots: every observation shows a
 * thumbnail of its evidence (element highlighted); clicking opens it large.
 */
export function EvidenceObservations({
  analysis,
  brandName,
  limit,
}: {
  analysis: JourneyAnalysis;
  brandName: string;
  limit?: number;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const observations = analysis.observations.map(toObservation);
  const shown = limit ? observations.slice(0, limit) : observations;
  const shots = analysis.screenshots ?? [];

  const srcFor = (o: Observation) => shots[o.shot ?? 0] ?? shots[0] ?? null;
  const open = openIdx !== null ? observations[openIdx] : null;
  const openSrc = open ? srcFor(open) : null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <Lightbulb className="size-4 text-brand" />
        Observations
      </h3>
      <ul className="flex flex-col gap-2">
        {shown.map((o, i) => {
          const src = srcFor(o);
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!src}
                onClick={() => setOpenIdx(i)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg p-1.5 text-left",
                  src &&
                    "cursor-pointer transition-colors hover:bg-accent/50 [&:hover_.evidence-thumb]:border-brand/60"
                )}
              >
                <span className="mt-2 size-1 shrink-0 rounded-full bg-brand/60" />
                <span className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {o.text}
                </span>
                {src ? (
                  // aspect-[8/5] matches the 1440x900 capture viewport, so
                  // the region overlay aligns 1:1 with the image.
                  <span className="evidence-thumb relative mt-0.5 block aspect-[8/5] w-24 shrink-0 overflow-hidden rounded-md border transition-colors">
                    {/* eslint-disable-next-line @next/next/no-img-element -- runtime evidence file */}
                    <img
                      src={src}
                      alt="Evidence thumbnail"
                      className="h-full w-full object-cover object-top"
                    />
                    {o.region ? <RegionBox region={o.region} thumb /> : null}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {shots.length > 0 ? (
        <span className="text-[11px] text-muted-foreground/60">
          Click any observation to see the captured screen with the exact
          element highlighted.
        </span>
      ) : null}

      <Dialog
        open={openIdx !== null}
        onOpenChange={(o) => {
          if (!o) setOpenIdx(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Evidence — {brandName}</DialogTitle>
            <DialogDescription>{open?.text}</DialogDescription>
          </DialogHeader>
          {openSrc ? (
            <EvidenceShot src={openSrc} region={open?.region ?? null} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
