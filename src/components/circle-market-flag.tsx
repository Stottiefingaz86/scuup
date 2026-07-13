"use client";

import { CircleFlag } from "react-circle-flags";
import { marketCircleFlagCode, type MarketOption } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Flat circular country flag from [HatScripts/circle-flags](https://github.com/HatScripts/circle-flags). */
export function CircleMarketFlag({
  market,
  size = 48,
  className,
}: {
  market: Pick<MarketOption, "geo" | "label">;
  size?: number;
  className?: string;
}) {
  return (
    <CircleFlag
      countryCode={marketCircleFlagCode(market)}
      height={size}
      width={size}
      className={cn("shrink-0", className)}
    />
  );
}
