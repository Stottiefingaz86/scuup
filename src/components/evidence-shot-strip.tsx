"use client";

import { Monitor, Smartphone } from "lucide-react";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { splitScreenshots } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One evidence thumbnail with a small device badge in the corner. */
function DeviceShot({
  src,
  alt,
  caption,
  mobile,
  className,
}: {
  src: string;
  alt: string;
  caption: string;
  mobile: boolean;
  className?: string;
}) {
  const Icon = mobile ? Smartphone : Monitor;
  return (
    <span className="relative block shrink-0">
      <ScreenshotLightbox
        src={src}
        alt={alt}
        caption={caption}
        className={className}
      />
      <span className="pointer-events-none absolute bottom-1 right-1 rounded-sm border bg-background/85 p-0.5">
        <Icon className="size-3 text-muted-foreground" />
      </span>
    </span>
  );
}

/**
 * Horizontal strip of captured evidence screens. When the analysis includes
 * a mobile-viewport pass, desktop and mobile frames are shown as pairs
 * (desktop frame + the phone capture at roughly the same scroll depth).
 * Legacy desktop-only analyses render the classic flat strip.
 */
export function EvidenceShotStrip({
  analysis,
  label,
  className,
}: {
  analysis: {
    screenshots?: string[];
    mobileFrom?: number | null;
    analysedAt: string;
  };
  /** Prefix for alt/caption text, e.g. "Stake: Casino lobby". */
  label: string;
  className?: string;
}) {
  const { desktop, mobile } = splitScreenshots(analysis);
  if (desktop.length === 0 && mobile.length === 0) return null;
  const captured = new Date(analysis.analysedAt).toLocaleDateString(
    undefined,
    { dateStyle: "medium" }
  );

  if (mobile.length === 0) {
    return (
      <div
        className={cn(
          "flex w-full min-w-0 gap-2 overflow-x-auto pb-1",
          className
        )}
      >
        {desktop.map((src, i) => (
          <ScreenshotLightbox
            key={`${src}-${i}`}
            src={src}
            alt={`${label}, captured screen ${i + 1} of ${desktop.length}`}
            caption={`${label} · screen ${i + 1} of ${desktop.length}, captured ${captured}`}
            className="aspect-[8/5] h-20 shrink-0"
          />
        ))}
      </div>
    );
  }

  const pairs = Array.from(
    { length: Math.max(desktop.length, mobile.length) },
    (_, i) => ({ d: desktop[i], m: mobile[i] })
  );

  return (
    <div
      className={cn(
        "flex w-full min-w-0 gap-2 overflow-x-auto pb-1",
        className
      )}
    >
      {pairs.map((pair, i) => (
        <div
          key={i}
          className="flex shrink-0 items-stretch gap-1.5 rounded-lg border bg-card/40 p-1.5"
        >
          {pair.d ? (
            <DeviceShot
              src={pair.d}
              mobile={false}
              alt={`${label}, desktop screen ${i + 1} of ${desktop.length}`}
              caption={`${label} · desktop screen ${i + 1} of ${desktop.length}, captured ${captured}`}
              className="aspect-[8/5] h-24"
            />
          ) : null}
          {pair.m ? (
            <DeviceShot
              src={pair.m}
              mobile
              alt={`${label}, mobile screen ${i + 1} of ${mobile.length}`}
              caption={`${label} · mobile screen ${i + 1} of ${mobile.length}, captured ${captured}`}
              className="aspect-[390/844] h-24"
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
