import { cn } from "@/lib/utils";
import { scoreTextClass } from "@/lib/score";

export function ScoreRing({
  score,
  size = 64,
  label,
  className,
}: {
  score: number;
  size?: number;
  label?: string;
  className?: string;
}) {
  const stroke = size >= 80 ? 6 : 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (score / 100) * c;

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-muted/60"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${c - filled}`}
            className={cn(
              "transition-all [filter:drop-shadow(0_0_3px_color-mix(in_oklch,currentColor_40%,transparent))]",
              scoreTextClass(score)
            )}
            stroke="currentColor"
          />
        </svg>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center font-heading font-semibold tabular-nums",
            size >= 80 ? "text-2xl" : "text-sm",
            scoreTextClass(score)
          )}
        >
          {score}
        </span>
      </div>
      {label ? (
        <span className="text-center text-[11px] leading-tight text-muted-foreground">
          {label}
        </span>
      ) : null}
    </div>
  );
}
