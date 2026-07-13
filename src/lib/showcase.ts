/** Public landing showcase — monthly brand score snapshots. */

import type { ScorePillar } from "./types";

/** Brands hidden from the public carousel (slug from brand URL hostname). */
export const SHOWCASE_EXCLUDED_BRAND_SLUGS = new Set(["betonline"]);

export function isShowcaseExcludedBrand(slug: string): boolean {
  return SHOWCASE_EXCLUDED_BRAND_SLUGS.has(slug.toLowerCase());
}

export type ShowcaseTrend = "up" | "down" | "flat" | null;

export type ShowcaseSort =
  | "score"
  | "trending_up"
  | "trending_down"
  | "big_movers";

export interface ShowcaseSnapshotRow {
  id: number;
  brand_slug: string;
  brand_name: string;
  brand_url: string;
  favicon: string;
  market: string;
  month: string;
  cx_score: number;
  journeys_score: number | null;
  retention_score: number | null;
  voc_score: number | null;
  design_score: number | null;
  project_id: string | null;
  brand_id: string | null;
  updated_at: string;
}

export interface ShowcaseEntry {
  id: number;
  brandSlug: string;
  brandName: string;
  brandUrl: string;
  favicon: string;
  market: string;
  month: string;
  cxScore: number;
  journeysScore: number | null;
  retentionScore: number | null;
  vocScore: number | null;
  designScore: number | null;
  /** Change vs the prior month for this brand + market. Null when no prior row. */
  scoreDelta: number | null;
  trend: ShowcaseTrend;
}

export interface ShowcaseResponse {
  entries: ShowcaseEntry[];
  markets: string[];
  months: string[];
}

export function brandSlugFromUrl(url: string): string {
  try {
    const host = new URL(
      url.startsWith("http") ? url : `https://${url}`
    ).hostname.replace(/^www\./, "");
    return host.split(".")[0].toLowerCase();
  } catch {
    return url.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }
}

/** First day of the calendar month for a date (UTC). */
export function monthKey(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function prevMonthKey(month: string): string {
  const d = new Date(`${month}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return monthKey(d);
}

export function trendFromDelta(delta: number | null): ShowcaseTrend {
  if (delta === null) return null;
  if (delta >= 3) return "up";
  if (delta <= -3) return "down";
  if (delta === 0) return "flat";
  return "flat";
}

const BIG_MOVER = 8;
const TREND_UP = 3;
const TREND_DOWN = -3;

export function matchesSort(entry: ShowcaseEntry, sort: ShowcaseSort): boolean {
  if (sort === "score") return true;
  const d = entry.scoreDelta;
  if (d === null) return false;
  if (sort === "big_movers") return Math.abs(d) >= BIG_MOVER;
  if (sort === "trending_up") return d >= TREND_UP;
  if (sort === "trending_down") return d <= TREND_DOWN;
  return true;
}

/** One public card per brand when the carousel spans all markets. */
export function dedupeShowcaseByBrand(
  entries: ShowcaseEntry[]
): ShowcaseEntry[] {
  const bySlug = new Map<string, ShowcaseEntry>();
  for (const entry of entries) {
    const kept = bySlug.get(entry.brandSlug);
    if (
      !kept ||
      entry.cxScore > kept.cxScore ||
      (entry.cxScore === kept.cxScore && entry.id > kept.id)
    ) {
      bySlug.set(entry.brandSlug, entry);
    }
  }
  return [...bySlug.values()].sort((a, b) => b.cxScore - a.cxScore);
}

export function rowToEntry(
  row: ShowcaseSnapshotRow,
  prevScore: number | null
): ShowcaseEntry {
  const scoreDelta =
    prevScore === null ? null : row.cx_score - prevScore;
  return {
    id: row.id,
    brandSlug: row.brand_slug,
    brandName: row.brand_name,
    brandUrl: row.brand_url,
    favicon: row.favicon,
    market: row.market,
    month: row.month,
    cxScore: row.cx_score,
    journeysScore: row.journeys_score,
    retentionScore: row.retention_score,
    vocScore: row.voc_score,
    designScore: row.design_score,
    scoreDelta,
    trend: trendFromDelta(scoreDelta),
  };
}

export function formatMonthLabel(month: string): string {
  const d = new Date(`${month}T00:00:00.000Z`);
  return d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Pillar breakdown for landing showcase cards — mirrors in-app scorePillars(). */
export function pillarsFromShowcaseEntry(entry: ShowcaseEntry): ScorePillar[] {
  const journeyDetail =
    entry.journeysScore !== null
      ? `avg of scored journeys`
      : "no journeys scored yet";
  const retentionDetail =
    entry.retentionScore !== null
      ? "loyalty & rewards visit"
      : "loyalty visit not scored yet";
  const vocDetail =
    entry.vocScore !== null
      ? "Trustpilot rescaled to 100"
      : "reviews not analysed yet";
  const designDetail =
    entry.designScore !== null
      ? "live code + accessibility review"
      : "design not reviewed yet";

  return [
    {
      key: "journeys",
      label: "Journeys",
      score: entry.journeysScore,
      detail: journeyDetail,
    },
    {
      key: "retention",
      label: "Retention",
      score: entry.retentionScore,
      detail: retentionDetail,
    },
    {
      key: "voc",
      label: "Voice of Customer",
      score: entry.vocScore,
      detail: vocDetail,
    },
    {
      key: "design",
      label: "Design",
      score: entry.designScore,
      detail: designDetail,
    },
  ];
}
