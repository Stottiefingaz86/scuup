"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** iPhone CSS viewport — matches research mobile capture (390×844). */
export const IPHONE_VIEW_W = 390;
export const IPHONE_VIEW_H = 844;

/**
 * Show a captured frame at phone size, as the player saw it. Do not stretch
 * a 390px shot across a 1200px modal.
 */
export function PhoneShotFrame({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto overflow-hidden rounded-[2rem] border bg-neutral-950 shadow-sm",
        className,
      )}
      style={{ width: IPHONE_VIEW_W, maxWidth: "100%" }}
    >
      <div
        className="overflow-y-auto overflow-x-hidden"
        style={{ maxHeight: `min(${IPHONE_VIEW_H}px, 68vh)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- runtime evidence file */}
        <img src={src} alt={alt} className="block h-auto w-full" />
      </div>
    </div>
  );
}

/** A screenshot thumbnail that opens the full image in a modal instead of
 * navigating away. Used everywhere evidence screenshots appear. */
export function ScreenshotLightbox({
  src,
  alt,
  caption,
  className,
  imgClassName,
  style,
  frame = "full",
}: {
  src: string;
  alt: string;
  /** Shown above the enlarged image, defaults to alt. */
  caption?: string;
  className?: string;
  imgClassName?: string;
  style?: React.CSSProperties;
  /** `phone` = iPhone viewport. Research captures are 390px. */
  frame?: "phone" | "full";
}) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const phone = frame === "phone";

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!broken) setOpen(true);
        }}
        disabled={broken}
        className={cn(
          "group relative block overflow-hidden rounded-md border transition-opacity",
          broken
            ? "flex cursor-default items-center justify-center bg-muted/30 text-xs text-muted-foreground"
            : "cursor-zoom-in hover:opacity-90",
          className
        )}
        title={broken ? undefined : "Click to enlarge"}
        style={style}
      >
        {broken ? (
          "Screenshot unavailable"
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- runtime evidence file */
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setBroken(true)}
            className={cn(
              "h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]",
              imgClassName
            )}
          />
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={
            phone
              ? "w-auto max-w-[min(96vw,28rem)] gap-2 p-3 sm:max-w-[min(96vw,28rem)]"
              : "w-auto max-w-[min(96vw,1200px)] gap-2 p-3 sm:max-w-[min(96vw,1200px)]"
          }
        >
          <DialogTitle className="pe-8 text-sm text-muted-foreground">
            {caption ?? alt}
          </DialogTitle>
          {phone ? (
            <PhoneShotFrame src={src} alt={alt} />
          ) : (
            <div className="max-h-[82vh] overflow-auto rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element -- runtime evidence file */}
              <img src={src} alt={alt} className="w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
