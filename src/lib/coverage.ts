import {
  agentCanReach,
  agentCanReachLoggedIn,
  ANALYSIS_AREA_LABELS,
  LANDING,
} from "./constants";
import type { Brand, Project } from "./types";

export type GapReason = "blocked" | "not_analysed";

/** A data point the platform could not capture, plus how the user fixes it. */
export interface DataGap {
  id: string;
  brand: Brand;
  area: string;
  title: string;
  detail: string;
  reason: GapReason;
  cta: string;
}

export interface Coverage {
  total: number;
  captured: number;
  pct: number;
  gaps: DataGap[];
}

/** Areas in scope for a project: first impression + selected journeys. */
export function projectAreas(project: Project): string[] {
  return [LANDING, ...project.journeys];
}

/** Derives coverage from real analyses only, so every N/A shown anywhere in
 * the product automatically surfaces here as an actionable gap. */
export function getCoverage(project: Project): Coverage {
  const areas = projectAreas(project);
  let total = 0;
  let captured = 0;
  const gaps: DataGap[] = [];

  for (const brand of project.brands) {
    for (const area of areas) {
      total += 1;
      const analysis = brand.analyses[area];
      if (analysis && !analysis.blocked) {
        captured += 1;
      } else if (analysis?.blocked) {
        gaps.push({
          id: `${brand.id}-${area}`,
          brand,
          area,
          title: `${brand.name} — ${ANALYSIS_AREA_LABELS[area] ?? area}`,
          detail:
            analysis.blockReason ??
            "The agent was blocked before it could observe this area.",
          reason: "blocked",
          cta: "Take over",
        });
      } else {
        gaps.push({
          id: `${brand.id}-${area}`,
          brand,
          area,
          title: `${brand.name} — ${ANALYSIS_AREA_LABELS[area] ?? area}`,
          detail: agentCanReach(area)
            ? "Public area — the agent can navigate there and score it on its own."
            : agentCanReachLoggedIn(area)
              ? "Post-login journey — the agent registers a test account during the signup run, then walks this logged in."
              : "Post-login journey — needs a recorded live session to score.",
          reason: "not_analysed",
          cta: agentCanReachLoggedIn(area) ? "Run agent" : "Launch site",
        });
      }
    }
  }

  return {
    total,
    captured,
    pct: total === 0 ? 0 : Math.round((captured / total) * 100),
    gaps,
  };
}
