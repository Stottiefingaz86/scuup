import { cn } from "@/lib/utils";
import { tierLabel, tierTextClass } from "@/lib/score";

/**
 * Semicircular score gauge with the score and tier label inside the arc.
 * The arc sweeps 180° from left to right.
 */
export function ScoreGauge({
  score,
  size = 150,
  caption,
  muted = false,
  className,
}: {
  score: number;
  size?: number;
  caption?: string;
  /** Neutral arc for competitor gauges, tier color is reserved for own brand. */
  muted?: boolean;
  className?: string;
}) {
  const stroke = Math.max(8, Math.round(size / 15));
  const r = (size - stroke) / 2;
  const cy = size / 2;
  const halfCircumference = Math.PI * r;
  const filled = (score / 100) * halfCircumference;
  const height = size / 2 + stroke;

  return (
    <div className={cn("group/score flex flex-col items-center", className)}>
      <div className="relative" style={{ width: size, height }}>
        <svg width={size} height={height} className="overflow-visible">
          <path
            d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className="stroke-muted/60"
          />
          <path
            d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${halfCircumference}`}
            stroke="currentColor"
            className={cn(
              "transition-colors duration-300",
              muted
                ? cn(tierTextClass(score), "opacity-75")
                : cn(
                    "[filter:drop-shadow(0_0_3px_color-mix(in_oklch,currentColor_40%,transparent))]",
                    tierTextClass(score)
                  )
            )}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-0.5">
          <span
            className="font-heading font-semibold leading-none tabular-nums"
            style={{ fontSize: Math.round(size * 0.19) }}
          >
            {score}
            <span
              className="font-normal text-muted-foreground"
              style={{ fontSize: Math.round(size * 0.085) }}
            >
              {" "}
              /100
            </span>
          </span>
          <span
            className={cn(
              "font-heading font-medium transition-colors duration-300",
              muted
                ? cn(tierTextClass(score), "opacity-75")
                : tierTextClass(score)
            )}
            style={{ fontSize: Math.max(10, Math.round(size * 0.075)) }}
          >
            {tierLabel(score)}
          </span>
        </div>
      </div>
      {caption ? (
        <span className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {caption}
        </span>
      ) : null}
    </div>
  );
}
