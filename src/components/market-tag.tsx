import { CircleMarketFlag } from "@/components/circle-market-flag";
import { marketOptionForLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Circle flag + market label — used on showcase cards and project chrome. */
export function MarketTag({
  market,
  className,
  showLabel = true,
}: {
  market: string;
  className?: string;
  /** When false, flag only (e.g. tight layouts). */
  showLabel?: boolean;
}) {
  const opt = marketOptionForLabel(market);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted/50 py-0.5 pe-2.5 ps-0.5",
        className
      )}
      title={market}
    >
      <CircleMarketFlag
        market={opt}
        size={20}
        className="shrink-0 shadow-sm ring-1 ring-black/10"
      />
      {showLabel ? (
        <span className="truncate text-[11px] text-muted-foreground">
          {market}
        </span>
      ) : null}
    </span>
  );
}
