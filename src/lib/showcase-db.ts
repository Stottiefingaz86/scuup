import { supabase } from "./supabase-server";
import {
  brandSlugFromUrl,
  dedupeShowcaseByBrand,
  mergeShowcasePillars,
  isShowcaseExcludedBrand,
  monthKey,
  prevMonthKey,
  rowToEntry,
  type GlobalRank,
  type ShowcaseEntry,
  type ShowcaseSnapshotRow,
} from "./showcase";
import {
  getProjectById,
} from "./project-db";
import {
  overallScore,
  scorePillars,
  type Brand,
} from "./types";

function snapshotFromBrand(
  brand: Brand,
  market: string,
  month: string,
  projectId: string
) {
  const cx = overallScore(brand);
  if (cx === null) return null;
  const pillars = scorePillars(brand);
  const byKey = Object.fromEntries(pillars.map((p) => [p.key, p.score]));
  return {
    brand_slug: brandSlugFromUrl(brand.url),
    brand_name: brand.name,
    brand_url: brand.url,
    favicon: brand.favicon,
    market,
    month,
    cx_score: cx,
    journeys_score: byKey.journeys ?? null,
    retention_score: byKey.retention ?? null,
    voc_score: byKey.voc ?? null,
    design_score: byKey.design ?? null,
    project_id: projectId,
    brand_id: brand.id,
    updated_at: new Date().toISOString(),
  };
}

/** Upsert monthly snapshots for every scored brand in a completed project. */
export async function syncShowcaseFromProject(projectId: string): Promise<number> {
  const db = supabase();
  const { data: row, error } = await db
    .from("ps_projects")
    .select("id, market, status, analysed_at")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || (row.status !== "complete" && row.status !== "archived")) return 0;

  const project = await getProjectById(projectId);
  if (!project) return 0;

  const analysed = row.analysed_at
    ? new Date(row.analysed_at as string)
    : new Date();
  const month = monthKey(analysed);

  let n = 0;
  for (const brand of project.brands) {
    const slug = brandSlugFromUrl(brand.url);
    if (isShowcaseExcludedBrand(slug)) continue;
    const snap = snapshotFromBrand(brand, project.market, month, projectId);
    if (!snap) continue;
    const { error: upsertErr } = await db
      .from("ps_showcase_snapshots")
      .upsert(snap, { onConflict: "brand_slug,market,month" });
    if (upsertErr) throw new Error(upsertErr.message);
    n += 1;
  }
  return n;
}

/** Re-sync the public carousel when a brand's scores change on a finished report. */
export async function syncShowcaseForBrand(brandId: string): Promise<void> {
  const db = supabase();
  const { data: brand, error } = await db
    .from("ps_brands")
    .select("project_id")
    .eq("id", brandId)
    .maybeSingle();
  if (error || !brand?.project_id) return;
  const { data: proj } = await db
    .from("ps_projects")
    .select("status")
    .eq("id", brand.project_id)
    .maybeSingle();
  if (proj?.status === "complete" || proj?.status === "archived") {
    await syncShowcaseFromProject(brand.project_id as string);
  }
}

/** Replace stale snapshot pillar fields with live project data when linked. */
async function liveSnapshotRow(
  row: ShowcaseSnapshotRow
): Promise<ShowcaseSnapshotRow> {
  if (!row.project_id || !row.brand_id) return row;
  try {
    const project = await getProjectById(row.project_id);
    if (
      !project ||
      (project.status !== "complete" && project.status !== "archived")
    ) {
      return row;
    }
    const brand = project.brands.find((b) => b.id === row.brand_id);
    if (!brand || overallScore(brand) === null) return row;

    const snap = snapshotFromBrand(
      brand,
      row.market,
      row.month,
      row.project_id
    );
    if (!snap) return row;

    const changed =
      snap.cx_score !== row.cx_score ||
      snap.journeys_score !== row.journeys_score ||
      snap.retention_score !== row.retention_score ||
      snap.voc_score !== row.voc_score ||
      snap.design_score !== row.design_score;

    if (changed) {
      const { error: upsertErr } = await supabase()
        .from("ps_showcase_snapshots")
        .upsert(snap, { onConflict: "brand_slug,market,month" });
      if (upsertErr) throw new Error(upsertErr.message);
    }

    return {
      ...row,
      cx_score: snap.cx_score,
      journeys_score: snap.journeys_score,
      retention_score: snap.retention_score,
      voc_score: snap.voc_score,
      design_score: snap.design_score,
      updated_at: snap.updated_at,
    };
  } catch (e) {
    console.error("[showcase] live heal failed:", e);
    return row;
  }
}

export async function listShowcaseSnapshots(opts?: {
  market?: string;
  month?: string;
}): Promise<ShowcaseSnapshotRow[]> {
  let q = supabase()
    .from("ps_showcase_snapshots")
    .select("*")
    .order("cx_score", { ascending: false });

  if (opts?.market) q = q.eq("market", opts.market);
  if (opts?.month) q = q.eq("month", opts.month);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ShowcaseSnapshotRow[];
}

export async function listShowcaseMeta(): Promise<{
  markets: string[];
  months: string[];
}> {
  const { data, error } = await supabase()
    .from("ps_showcase_snapshots")
    .select("market, month");
  if (error) throw new Error(error.message);
  const markets = [
    ...new Set((data ?? []).map((r) => r.market as string)),
  ].sort();
  const months = [
    ...new Set((data ?? []).map((r) => r.month as string)),
  ].sort((a, b) => b.localeCompare(a));
  return { markets, months };
}

/** Build entries with month-over-month deltas for the public carousel. */
export async function buildShowcaseEntries(opts?: {
  market?: string;
  month?: string;
}): Promise<{ entries: ShowcaseEntry[]; markets: string[]; months: string[] }> {
  const meta = await listShowcaseMeta();
  const month = opts?.month ?? meta.months[0];
  if (!month) {
    return { entries: [], markets: meta.markets, months: meta.months };
  }

  const rows = await listShowcaseSnapshots({
    market: opts?.market,
    month,
  }).then((all) =>
    all.filter((row) => !isShowcaseExcludedBrand(row.brand_slug))
  );

  const healedRows = await Promise.all(rows.map(liveSnapshotRow));

  const prevMonth = prevMonthKey(month);
  const prevRows = await listShowcaseSnapshots({
    market: opts?.market,
    month: prevMonth,
  });
  const prevByKey = new Map(
    prevRows.map((r) => [`${r.brand_slug}:${r.market}`, r.cx_score])
  );

  const entries = healedRows.map((row) => {
    const prev = prevByKey.get(`${row.brand_slug}:${row.market}`) ?? null;
    return rowToEntry(row, prev);
  });

  const bySlug = new Map<string, ShowcaseEntry[]>();
  for (const entry of entries) {
    const list = bySlug.get(entry.brandSlug) ?? [];
    list.push(entry);
    bySlug.set(entry.brandSlug, list);
  }

  const visible = opts?.market ? entries : dedupeShowcaseByBrand(entries);
  const merged = visible.map((entry) => {
    const siblings = (bySlug.get(entry.brandSlug) ?? []).filter(
      (s) => s.id !== entry.id
    );
    return mergeShowcasePillars(entry, siblings);
  });

  return { entries: merged, markets: meta.markets, months: meta.months };
}

export type { GlobalRank } from "./showcase";

/** Latest CX score per brand across the whole corpus (all markets/months). */
async function latestScoresByBrand(opts?: {
  market?: string;
}): Promise<{ slug: string; name: string; score: number }[]> {
  let q = supabase()
    .from("ps_showcase_snapshots")
    .select("brand_slug, brand_name, cx_score, month, updated_at")
    .order("month", { ascending: false })
    .order("updated_at", { ascending: false });
  if (opts?.market) q = q.eq("market", opts.market);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const out: { slug: string; name: string; score: number }[] = [];
  for (const row of data ?? []) {
    const slug = (row.brand_slug as string).toLowerCase();
    if (isShowcaseExcludedBrand(slug) || seen.has(slug)) continue;
    seen.add(slug);
    out.push({
      slug,
      name: row.brand_name as string,
      score: row.cx_score as number,
    });
  }
  return out;
}

function rankInList(
  score: number,
  peers: { slug: string; name: string; score: number }[],
  selfSlug?: string | null
): Pick<
  GlobalRank,
  "rank" | "total" | "percentile" | "leaderScore" | "leaderName"
> {
  const slug = selfSlug?.toLowerCase() ?? null;
  const others = peers.filter((p) => p.slug !== slug);
  const scores = [...others.map((p) => p.score), score].sort(
    (a, b) => b - a
  );
  const rank = scores.findIndex((s) => s === score) + 1;
  const total = scores.length;
  const beaten = scores.filter((s) => s < score).length;
  const percentile =
    total <= 1 ? 100 : Math.round((beaten / (total - 1)) * 100);

  const topPeer = [...others].sort((a, b) => b.score - a.score)[0];
  const selfLeads = !topPeer || score >= topPeer.score;
  return {
    rank: rank || total,
    total,
    percentile,
    leaderScore: selfLeads ? score : topPeer.score,
    leaderName: selfLeads ? null : topPeer.name,
  };
}

/** Where a CX score sits among every brand Scuup has scored. */
export async function globalRankForScore(
  score: number,
  opts?: { market?: string; brandSlug?: string }
): Promise<GlobalRank> {
  const all = await latestScoresByBrand();
  const global = rankInList(score, all, opts?.brandSlug);

  let marketRank: number | null = null;
  let marketTotal: number | null = null;
  if (opts?.market) {
    const marketPeers = await latestScoresByBrand({ market: opts.market });
    if (marketPeers.length >= 2) {
      const m = rankInList(score, marketPeers, opts.brandSlug);
      marketRank = m.rank;
      marketTotal = m.total;
    }
  }

  return { ...global, marketRank, marketTotal };
}

/** Backfill showcase from every completed project (one-time / cron). */
export async function backfillShowcaseFromAllProjects(): Promise<number> {
  const db = supabase();
  const { data, error } = await db
    .from("ps_projects")
    .select("id")
    .in("status", ["complete", "archived"])
    .not("analysed_at", "is", null);
  if (error) throw new Error(error.message);
  let total = 0;
  for (const row of data ?? []) {
    total += await syncShowcaseFromProject(row.id as string);
  }
  return total;
}
