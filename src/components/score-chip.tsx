import { cn } from "@/lib/utils";
import {
  TIERS,
  TIER_BG,
  TIER_CHIP_HOVER,
  tierChipClass,
  tierOf,
} from "@/lib/score";

/**
 * Score pill for matrices and tables.
 * `muted` renders a neutral pill (competitor cells) that reveals its tier
 * colour on hover, colour at rest is reserved for the reader's own brand.
 * `null` renders an N/A pill: the agent was blocked before it could score.
 */
export function ScoreChip({
  score,
  muted = false,
  className,
}: {
  score: number | null;
  muted?: boolean;
  className?: string;
}) {
  if (score === null) {
    return (
      <span
        className={cn(
          "inline-flex min-w-9 items-center justify-center rounded-md border border-dashed border-border px-1.5 py-0.5 font-heading text-xs font-medium text-muted-foreground/60",
          className
        )}
        title="A bot wall blocked the agent from completing this flow, other journeys use saved account credentials"
      >
        N/A
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex min-w-9 items-center justify-center rounded-md px-1.5 py-0.5 font-heading text-xs font-semibold tabular-nums ring-1 ring-inset",
        muted
          ? cn(
              "bg-muted/40 text-muted-foreground ring-border/60 transition-colors duration-200",
              TIER_CHIP_HOVER[tierOf(score)]
            )
          : tierChipClass(score),
        className
      )}
    >
      {score}
    </span>
  );
}

/** Horizontal legend explaining the five score tiers. */
export function TierLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {TIERS.map((t) => (
        <span
          key={t.tier}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span className={cn("size-2 rounded-full", TIER_BG[t.tier])} />
          {t.label} {t.range}
        </span>
      ))}
    </div>
  );
}
