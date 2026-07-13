"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** A screenshot thumbnail that opens the full image in a modal instead of
 * navigating away. Used everywhere evidence screenshots appear. */
export function ScreenshotLightbox({
  src,
  alt,
  caption,
  className,
  imgClassName,
}: {
  src: string;
  alt: string;
  /** Shown above the enlarged image, defaults to alt. */
  caption?: string;
  className?: string;
  imgClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);

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
        <DialogContent className="w-auto max-w-[min(96vw,1200px)] gap-2 p-3 sm:max-w-[min(96vw,1200px)]">
          <DialogTitle className="pe-8 text-sm text-muted-foreground">
            {caption ?? alt}
          </DialogTitle>
          <div className="max-h-[82vh] overflow-auto rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element -- runtime evidence file */}
            <img src={src} alt={alt} className="w-full" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
