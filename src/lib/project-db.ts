import { supabase } from "./supabase-server";
import type {
  ActionPlan,
  Brand,
  CaptureRecord,
  DesignReview,
  JourneyAnalysis,
  Project,
  VocAnalysis,
} from "./types";

/* Row shapes as stored in Postgres. Analyses and sessions keep the full
 * app object in a jsonb column so the client model stays the single
 * source of truth for shape. */

interface ProjectRow {
  id: string;
  name: string;
  market: string;
  products: string[];
  journeys: string[];
  analysis_mode: string;
  status: string;
  created_at: string;
  analysed_at: string | null;
}

interface BrandRow {
  id: string;
  project_id: string;
  name: string;
  url: string;
  favicon: string;
  role: string;
  position: number;
}

interface AnalysisRow {
  brand_id: string;
  area: string;
  data: JourneyAnalysis;
}

interface SessionRow {
  id: string;
  project_id: string;
  data: CaptureRecord;
}

interface ActionPlanRow {
  project_id: string;
  data: ActionPlan;
}

interface VocRow {
  brand_id: string;
  data: VocAnalysis;
}

interface DesignRow {
  brand_id: string;
  data: DesignReview;
}

function assemble(
  row: ProjectRow,
  brandRows: BrandRow[],
  analysisRows: AnalysisRow[],
  sessionRows: SessionRow[],
  planRow?: ActionPlanRow,
  vocRows: VocRow[] = [],
  designRows: DesignRow[] = []
): Project {
  const analysesByBrand = new Map<string, Record<string, JourneyAnalysis>>();
  for (const a of analysisRows) {
    const map = analysesByBrand.get(a.brand_id) ?? {};
    map[a.area] = a.data;
    analysesByBrand.set(a.brand_id, map);
  }
  const brands: Brand[] = brandRows
    .sort((a, b) => a.position - b.position)
    .map((b) => ({
      id: b.id,
      name: b.name,
      url: b.url,
      favicon: b.favicon,
      role: b.role as Brand["role"],
      analyses: analysesByBrand.get(b.id) ?? {},
      voc: vocRows.find((v) => v.brand_id === b.id)?.data,
      design: designRows.find((d) => d.brand_id === b.id)?.data,
    }));
  return {
    id: row.id,
    name: row.name,
    market: row.market,
    products: row.products,
    journeys: row.journeys as Project["journeys"],
    analysisMode: row.analysis_mode,
    brands,
    sessions: sessionRows.map((s) => s.data),
    actionPlan: planRow?.data,
    status: row.status as Project["status"],
    createdAt: row.created_at,
    analysedAt: row.analysed_at ?? undefined,
  };
}

export async function listProjects(userId: string): Promise<Project[]> {
  const db = supabase();
  const [projects, shared, brands, analyses, sessions, plans, vocs, designs] =
    await Promise.all([
      db
        .from("ps_projects")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      db
        .from("ps_project_members")
        .select("project_id")
        .eq("user_id", userId)
        .eq("status", "active"),
      db.from("ps_brands").select("*"),
      db.from("ps_analyses").select("brand_id, area, data"),
      db.from("ps_sessions").select("id, project_id, data").order("created_at", { ascending: false }),
      db.from("ps_action_plans").select("project_id, data"),
      db.from("ps_voc").select("brand_id, data"),
      db.from("ps_design").select("brand_id, data"),
    ]);
  for (const res of [projects, shared, brands, analyses, sessions, plans, vocs, designs]) {
    if (res.error) throw new Error(res.error.message);
  }

  // Reports shared with this account as a read-only viewer.
  const ownRows = (projects.data ?? []) as ProjectRow[];
  const sharedIds = ((shared.data ?? []) as { project_id: string }[])
    .map((r) => r.project_id)
    .filter((id) => !ownRows.some((p) => p.id === id));
  let sharedRows: ProjectRow[] = [];
  if (sharedIds.length > 0) {
    const { data, error } = await db
      .from("ps_projects")
      .select("*")
      .in("id", sharedIds)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    sharedRows = (data ?? []) as ProjectRow[];
  }

  const brandRows = (brands.data ?? []) as BrandRow[];
  const analysisRows = (analyses.data ?? []) as AnalysisRow[];
  const sessionRows = (sessions.data ?? []) as SessionRow[];
  const planRows = (plans.data ?? []) as ActionPlanRow[];
  const vocRows = (vocs.data ?? []) as VocRow[];
  const designRows = (designs.data ?? []) as DesignRow[];
  const build = (p: ProjectRow, access: "owner" | "viewer") => ({
    ...assemble(
      p,
      brandRows.filter((b) => b.project_id === p.id),
      analysisRows.filter((a) =>
        brandRows.some((b) => b.id === a.brand_id && b.project_id === p.id)
      ),
      sessionRows.filter((s) => s.project_id === p.id),
      planRows.find((pl) => pl.project_id === p.id),
      vocRows.filter((v) =>
        brandRows.some((b) => b.id === v.brand_id && b.project_id === p.id)
      ),
      designRows.filter((d) =>
        brandRows.some((b) => b.id === d.brand_id && b.project_id === p.id)
      )
    ),
    access,
  });
  return [
    ...ownRows.map((p) => build(p, "owner" as const)),
    ...sharedRows.map((p) => build(p, "viewer" as const)),
  ];
}

/** Load one project with full brand data — server-side only. */
export async function getProjectById(id: string): Promise<Project | null> {
  const db = supabase();
  const { data: row, error } = await db
    .from("ps_projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;

  const { data: brandRows, error: brandErr } = await db
    .from("ps_brands")
    .select("*")
    .eq("project_id", id);
  if (brandErr) throw new Error(brandErr.message);

  const brands = (brandRows ?? []) as BrandRow[];
  const brandIds = brands.map((b) => b.id);

  if (brandIds.length === 0) {
    return assemble(row as ProjectRow, [], [], [], undefined, [], []);
  }

  const [analyses, sessions, plan, vocs, designs] = await Promise.all([
    db.from("ps_analyses").select("brand_id, area, data").in("brand_id", brandIds),
    db
      .from("ps_sessions")
      .select("id, project_id, data")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("ps_action_plans")
      .select("project_id, data")
      .eq("project_id", id)
      .maybeSingle(),
    db.from("ps_voc").select("brand_id, data").in("brand_id", brandIds),
    db.from("ps_design").select("brand_id, data").in("brand_id", brandIds),
  ]);

  for (const res of [analyses, sessions, plan, vocs, designs]) {
    if (res.error) throw new Error(res.error.message);
  }

  return assemble(
    row as ProjectRow,
    brands,
    (analyses.data ?? []) as AnalysisRow[],
    (sessions.data ?? []) as SessionRow[],
    plan.data as ActionPlanRow | undefined,
    (vocs.data ?? []) as VocRow[],
    (designs.data ?? []) as DesignRow[]
  );
}

/** How many reports this account has created (any status). */
export async function countProjects(userId: string): Promise<number> {
  const { count, error } = await supabase()
    .from("ps_projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Archive every live report for this account. Used when replacing the
 * active report during onboarding so stale multi-active rows can't block
 * creation. */
export async function archiveAllActiveProjects(userId: string): Promise<number> {
  const { data, error } = await supabase()
    .from("ps_projects")
    .select("id")
    .eq("user_id", userId)
    .neq("status", "archived");
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    await setProjectArchived(row.id as string, true);
  }
  return data?.length ?? 0;
}

/** Non-archived reports for this account. */
export async function countActiveProjects(userId: string): Promise<number> {
  const { count, error } = await supabase()
    .from("ps_projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "archived");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** The account's live (non-archived) report, if any. Only one may exist
 * for normal accounts — admins may run several in parallel. */
export async function activeProject(
  userId: string
): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase()
    .from("ps_projects")
    .select("id, name")
    .eq("user_id", userId)
    .neq("status", "archived")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { id: data.id as string, name: data.name as string } : null;
}

/** True when the project belongs to this account. */
export async function ownsProject(
  projectId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase()
    .from("ps_projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

/** True when the brand's parent report is archived (paused). */
export async function brandProjectArchived(brandId: string): Promise<boolean> {
  const db = supabase();
  const { data, error } = await db
    .from("ps_brands")
    .select("project_id")
    .eq("id", brandId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return false;
  const { data: proj, error: projErr } = await db
    .from("ps_projects")
    .select("status")
    .eq("id", data.project_id as string)
    .maybeSingle();
  if (projErr) throw new Error(projErr.message);
  return proj?.status === "archived";
}

/** True when the brand belongs to one of this account's projects. */
export async function ownsBrand(
  brandId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase()
    .from("ps_brands")
    .select("project_id")
    .eq("id", brandId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return false;
  return ownsProject(data.project_id as string, userId);
}

export async function insertProject(
  project: Project,
  userId: string
): Promise<void> {
  const db = supabase();
  const { error } = await db.from("ps_projects").insert({
    id: project.id,
    name: project.name,
    market: project.market,
    products: project.products,
    journeys: project.journeys,
    analysis_mode: project.analysisMode,
    status: project.status,
    created_at: project.createdAt,
    analysed_at: project.analysedAt ?? null,
    user_id: userId,
  });
  if (error) throw new Error(error.message);

  if (project.brands.length) {
    const { error: brandErr } = await db.from("ps_brands").insert(
      project.brands.map((b, i) => ({
        id: b.id,
        project_id: project.id,
        name: b.name,
        url: b.url,
        favicon: b.favicon,
        role: b.role,
        position: i,
      }))
    );
    if (brandErr) throw new Error(brandErr.message);
  }

  const analysisRows = project.brands.flatMap((b) =>
    Object.values(b.analyses).map((a) => ({
      brand_id: b.id,
      area: a.area,
      data: a,
      analysed_at: a.analysedAt,
    }))
  );
  if (analysisRows.length) {
    const { error: aErr } = await db.from("ps_analyses").upsert(analysisRows);
    if (aErr) throw new Error(aErr.message);
  }

  if (project.sessions.length) {
    const { error: sErr } = await db.from("ps_sessions").upsert(
      project.sessions.map((s) => ({
        id: s.id,
        project_id: project.id,
        brand_id: s.brandId,
        data: s,
        created_at: s.date,
      }))
    );
    if (sErr) throw new Error(sErr.message);
  }
}

/** The stored analysis for one brand+area, or null on first run. */
export async function getAnalysis(
  brandId: string,
  area: string
): Promise<JourneyAnalysis | null> {
  const { data, error } = await supabase()
    .from("ps_analyses")
    .select("data")
    .eq("brand_id", brandId)
    .eq("area", area)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as JourneyAnalysis) ?? null;
}

/** Append one point to the score history that powers trends and the
 * re-run guardrail. Fail-soft: history must never block saving a run. */
async function recordScoreHistory(
  brandId: string,
  area: string,
  score: number,
  rawScore: number | null,
  analysedAt: string
): Promise<void> {
  try {
    const db = supabase();
    const { data } = await db
      .from("ps_brands")
      .select("project_id")
      .eq("id", brandId)
      .maybeSingle();
    if (!data) return;
    const { error } = await db.from("ps_score_history").insert({
      project_id: data.project_id as string,
      brand_id: brandId,
      area,
      score,
      raw_score: rawScore,
      analysed_at: analysedAt,
    });
    // 23505 = the client sync path re-saving the same run — not a problem.
    if (error && error.code !== "23505") {
      console.error("[score-history] record failed:", error.message);
    }
  } catch (e) {
    console.error("[score-history] record failed:", e);
  }
}

/** Saves a run and returns what was actually published — re-runs may be
 * guardrailed against the previous run, so callers must return/display the
 * result of this function, not their input. */
export async function upsertAnalysis(
  brandId: string,
  analysis: JourneyAnalysis
): Promise<JourneyAnalysis> {
  // Re-runs are anchored to the previous run so scores trend rather than
  // whiplash — a subscriber's report must not swing 15 points when the
  // site didn't change.
  let toSave = analysis;
  try {
    const prev = await getAnalysis(brandId, analysis.area);
    // A failed re-run never replaces a good result — the previous scored
    // analysis stays published, the blocked attempt is only logged.
    if (analysis.blocked && prev && !prev.blocked) {
      console.error(
        `[analysis] ${analysis.area} re-run blocked (${analysis.blockReason}); keeping the previous scored result`
      );
      return prev;
    }
    const { applyScoreGuardrail } = await import("./score-guardrail");
    toSave = applyScoreGuardrail(analysis, prev);
  } catch (e) {
    console.error("[guardrail] skipped, saving unanchored:", e);
  }

  const { error } = await supabase().from("ps_analyses").upsert({
    brand_id: brandId,
    area: toSave.area,
    data: toSave,
    analysed_at: toSave.analysedAt,
  });
  if (error) {
    // 23503: the report (and its brands) was deleted while this run was
    // in flight — there is nowhere to save to and nothing to fix.
    if (error.code === "23503") {
      console.error(
        `[analysis] ${analysis.area} finished after its report was deleted — result discarded`
      );
      return toSave;
    }
    throw new Error(error.message);
  }
  if (!toSave.blocked) {
    await recordScoreHistory(
      brandId,
      toSave.area,
      toSave.score,
      toSave.rawScore ?? null,
      toSave.analysedAt
    );
  }
  void import("./showcase-db")
    .then((m) => m.syncShowcaseForBrand(brandId))
    .catch((e) => console.error("[showcase] sync after analysis failed:", e));
  return toSave;
}

export async function upsertVoc(
  brandId: string,
  voc: VocAnalysis
): Promise<void> {
  const { error } = await supabase().from("ps_voc").upsert({
    brand_id: brandId,
    source: voc.source,
    fetched_at: voc.fetchedAt,
    data: voc,
  });
  if (error) throw new Error(error.message);
  if (voc.trustScore != null) {
    await recordScoreHistory(
      brandId,
      "voc",
      Math.round(voc.trustScore * 20),
      null,
      voc.fetchedAt
    );
  }
  void import("./showcase-db")
    .then((m) => m.syncShowcaseForBrand(brandId))
    .catch((e) => console.error("[showcase] sync after voc failed:", e));
}

export async function upsertDesign(
  brandId: string,
  design: DesignReview
): Promise<void> {
  const { error } = await supabase().from("ps_design").upsert({
    brand_id: brandId,
    fetched_at: design.fetchedAt,
    data: design,
  });
  if (error) throw new Error(error.message);
  if (design.score != null) {
    await recordScoreHistory(
      brandId,
      "design",
      design.score,
      null,
      design.fetchedAt
    );
  }
  void import("./showcase-db")
    .then((m) => m.syncShowcaseForBrand(brandId))
    .catch((e) => console.error("[showcase] sync after design failed:", e));
}

export async function insertSession(
  projectId: string,
  record: CaptureRecord
): Promise<void> {
  const { error } = await supabase().from("ps_sessions").insert({
    id: record.id,
    project_id: projectId,
    brand_id: record.brandId,
    data: record,
    created_at: record.date,
  });
  if (error) throw new Error(error.message);
}

export async function saveActionPlan(
  projectId: string,
  plan: ActionPlan
): Promise<void> {
  const { error } = await supabase().from("ps_action_plans").upsert({
    project_id: projectId,
    data: plan,
    generated_at: plan.generatedAt,
  });
  if (error) throw new Error(error.message);
}

export async function setProjectComplete(id: string): Promise<void> {
  const { error } = await supabase()
    .from("ps_projects")
    .update({ status: "complete", analysed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  try {
    const { syncShowcaseFromProject } = await import("./showcase-db");
    await syncShowcaseFromProject(id);
  } catch (e) {
    console.error("[showcase] sync on complete failed:", e);
  }
}

export async function setProjectDraft(id: string): Promise<void> {
  const { error } = await supabase()
    .from("ps_projects")
    .update({ status: "draft", analysed_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Archive pauses a report (kept readable, nothing runs); unarchiving
 * restores it to complete/draft depending on whether it was analysed. */
export async function setProjectArchived(
  id: string,
  archived: boolean
): Promise<void> {
  const db = supabase();
  if (archived) {
    const { error } = await db
      .from("ps_projects")
      .update({ status: "archived" })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const { data, error: readErr } = await db
    .from("ps_projects")
    .select("analysed_at")
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  const { error } = await db
    .from("ps_projects")
    .update({ status: data?.analysed_at ? "complete" : "draft" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Permanent removal — brands, analyses, sessions, VoC, design reviews
 * and action plans all cascade with the project row. */
export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase().from("ps_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** One-time import of projects that lived in the browser's localStorage.
 * Skips projects that already exist server-side; imports are claimed by
 * the signed-in account. */
export async function importProjects(
  projects: Project[],
  userId: string
): Promise<number> {
  const db = supabase();
  const { data, error } = await db.from("ps_projects").select("id");
  if (error) throw new Error(error.message);
  const existing = new Set((data ?? []).map((r) => r.id as string));
  let imported = 0;
  for (const project of projects) {
    if (existing.has(project.id)) continue;
    await insertProject(project, userId);
    imported += 1;
  }
  return imported;
}
