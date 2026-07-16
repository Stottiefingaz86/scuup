import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { canAccessProject } from "@/lib/collab-db";
import { supabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface TrendPoint {
  score: number;
  rawScore: number | null;
  analysedAt: string;
}

/** Per-brand, per-area score history for the trend UI. Areas are journey
 * areas plus the "voc" / "design" pillars. */
export type ProjectTrends = Record<string, Record<string, TrendPoint[]>>;

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/trends">
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    if (!(await canAccessProject(id, user))) {
      return NextResponse.json({ error: "not your project" }, { status: 403 });
    }
    const { data, error } = await supabase()
      .from("ps_score_history")
      .select("brand_id, area, score, raw_score, analysed_at")
      .eq("project_id", id)
      .order("analysed_at", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);

    const trends: ProjectTrends = {};
    for (const row of data ?? []) {
      const brandId = row.brand_id as string;
      const area = row.area as string;
      (trends[brandId] ??= {})[area] ??= [];
      trends[brandId]![area]!.push({
        score: row.score as number,
        rawScore: (row.raw_score as number | null) ?? null,
        analysedAt: row.analysed_at as string,
      });
    }
    return NextResponse.json({ trends });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to load trends";
    console.error("[trends] get failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
