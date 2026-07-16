"use client";

import { useEffect, useState } from "react";
import type {
  ProjectTrends,
  TrendPoint,
} from "@/app/api/projects/[id]/trends/route";

export type { ProjectTrends, TrendPoint };

const cache = new Map<string, ProjectTrends>();

/** Score history for a report, keyed brand → area. Cached per session —
 * history only changes when a run completes. */
export function useProjectTrends(projectId: string): ProjectTrends | null {
  const [trends, setTrends] = useState<ProjectTrends | null>(
    cache.get(projectId) ?? null
  );

  useEffect(() => {
    if (cache.has(projectId)) return;
    let cancelled = false;
    fetch(`/api/projects/${projectId}/trends`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { trends: ProjectTrends }) => {
        cache.set(projectId, d.trends);
        if (!cancelled) setTrends(d.trends);
      })
      .catch(() => {
        if (!cancelled) setTrends({});
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return trends;
}

/** The change between the two most recent runs, or null with <2 points. */
export function trendDelta(points: TrendPoint[] | undefined): number | null {
  if (!points || points.length < 2) return null;
  return points[points.length - 1]!.score - points[points.length - 2]!.score;
}

/** A brand's overall trend: average the latest and previous score of every
 * area that has at least two runs. Null until any area has history. */
export function overallTrendDelta(
  areas: Record<string, TrendPoint[]> | undefined
): number | null {
  if (!areas) return null;
  const deltas = Object.values(areas)
    .map((points) => trendDelta(points))
    .filter((d): d is number => d !== null);
  if (deltas.length === 0) return null;
  return Math.round(deltas.reduce((s, d) => s + d, 0) / deltas.length);
}
