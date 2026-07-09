import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TIER_BG_GROUP_HOVER,
  TIER_TEXT_GROUP_HOVER,
  tierBgClass,
  tierOf,
  tierTextClass,
} from "@/lib/score";

export function ScoreBar({
  label,
  score,
  rank,
  highlight = false,
  muted = false,
  partial = false,
  icon,
  className,
}: {
  label: string;
  score: number;
  rank?: number;
  highlight?: boolean;
  /** Neutral fill for competitor rows — tier color is reserved for own brand. */
  muted?: boolean;
  /** Score computed from incomplete data — flags that it may be skewed. */
  partial?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("group/score flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2">
        {rank !== undefined ? (
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
              rank === 1
                ? highlight
                  ? "bg-brand/20 text-brand"
                  : "bg-muted text-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {rank}
          </span>
        ) : null}
        {icon}
        <span
          className={cn(
            "text-sm",
            highlight ? "font-medium text-foreground" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
        {partial ? (
          <CircleAlert
            className="size-3.5 shrink-0 text-score-mid"
            aria-label="Partial data"
          >
            <title>
              Partial data — some mechanics are unobserved, so this score may
              be skewed
            </title>
          </CircleAlert>
        ) : null}
        <span
          className={cn(
            "ms-auto font-heading text-sm font-semibold tabular-nums transition-colors duration-200",
            muted
              ? cn("text-muted-foreground", TIER_TEXT_GROUP_HOVER[tierOf(score)])
              : tierTextClass(score)
          )}
        >
          {score}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn(
            "h-full rounded-full transition-colors duration-200",
            muted
              ? cn("bg-foreground/30", TIER_BG_GROUP_HOVER[tierOf(score)])
              : tierBgClass(score),
            !highlight && !muted && "opacity-80"
          )}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
