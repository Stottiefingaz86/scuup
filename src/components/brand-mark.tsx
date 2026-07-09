"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { tierTextClass } from "@/lib/score";
import type { Brand } from "@/lib/types";

/** Brand favicon with initials fallback, used anywhere a brand is named. */
export function BrandMark({
  brand,
  className,
}: {
  brand: Pick<Brand, "name" | "favicon" | "role">;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const own = brand.role === "own_brand";

  if (!brand.favicon || failed) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md font-heading text-[0.55em] font-semibold uppercase",
          own ? "bg-brand/15 text-brand" : "bg-muted text-muted-foreground",
          className
        )}
      >
        {brand.name.slice(0, 2)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external favicon host
    <img
      src={brand.favicon}
      alt=""
      aria-hidden
      onError={() => setFailed(true)}
      className={cn("shrink-0 rounded-md object-contain", className)}
    />
  );
}

/** Tab label for brand selectors: logo + name + tier-coloured score. */
export function BrandTabLabel({
  brand,
  score,
}: {
  brand: Pick<Brand, "name" | "favicon" | "role">;
  score: number | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <BrandMark brand={brand} className="size-4" />
      {brand.role === "own_brand" ? `${brand.name} (you)` : brand.name}
      {score !== null ? (
        <span
          className={cn(
            "font-heading text-xs font-semibold tabular-nums",
            tierTextClass(score)
          )}
        >
          {score}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground/50">–</span>
      )}
    </span>
  );
}
