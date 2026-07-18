"use client";

import { useEffect, useState } from "react";
import type { GlobalRank } from "@/lib/showcase";

export type { GlobalRank };

const cache = new Map<string, GlobalRank>();

function cacheKey(
  score: number,
  market?: string,
  brandUrl?: string
): string {
  return `${score}|${market ?? ""}|${brandUrl ?? ""}`;
}

/** Where this CX score sits among every brand Scuup has scored. */
export function useGlobalRank(
  score: number | null,
  opts?: { market?: string; brandUrl?: string }
): GlobalRank | null {
  const market = opts?.market;
  const brandUrl = opts?.brandUrl;
  const key =
    score === null ? null : cacheKey(score, market, brandUrl);
  const [rank, setRank] = useState<GlobalRank | null>(
    key ? (cache.get(key) ?? null) : null
  );

  useEffect(() => {
    if (score === null || !key) {
      setRank(null);
      return;
    }
    if (cache.has(key)) {
      setRank(cache.get(key)!);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ score: String(score) });
    if (market) params.set("market", market);
    if (brandUrl) params.set("brandUrl", brandUrl);
    fetch(`/api/benchmark/rank?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: GlobalRank) => {
        cache.set(key, d);
        if (!cancelled) setRank(d);
      })
      .catch(() => {
        if (!cancelled) setRank(null);
      });
    return () => {
      cancelled = true;
    };
  }, [score, key, market, brandUrl]);

  return rank;
}
