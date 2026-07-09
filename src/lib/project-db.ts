import { supabase } from "./supabase-server";
import type {
  ActionPlan,
  Brand,
  CaptureRecord,
  JourneyAnalysis,
  Project,
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

function assemble(
  row: ProjectRow,
  brandRows: BrandRow[],
  analysisRows: AnalysisRow[],
  sessionRows: SessionRow[],
  planRow?: ActionPlanRow
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
  const [projects, brands, analyses, sessions, plans] = await Promise.all([
    db
      .from("ps_projects")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    db.from("ps_brands").select("*"),
    db.from("ps_analyses").select("brand_id, area, data"),
    db.from("ps_sessions").select("id, project_id, data").order("created_at", { ascending: false }),
    db.from("ps_action_plans").select("project_id, data"),
  ]);
  for (const res of [projects, brands, analyses, sessions, plans]) {
    if (res.error) throw new Error(res.error.message);
  }
  const brandRows = (brands.data ?? []) as BrandRow[];
  const analysisRows = (analyses.data ?? []) as AnalysisRow[];
  const sessionRows = (sessions.data ?? []) as SessionRow[];
  const planRows = (plans.data ?? []) as ActionPlanRow[];
  return ((projects.data ?? []) as ProjectRow[]).map((p) =>
    assemble(
      p,
      brandRows.filter((b) => b.project_id === p.id),
      analysisRows.filter((a) =>
        brandRows.some((b) => b.id === a.brand_id && b.project_id === p.id)
      ),
      sessionRows.filter((s) => s.project_id === p.id),
      planRows.find((pl) => pl.project_id === p.id)
    )
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

export async function upsertAnalysis(
  brandId: string,
  analysis: JourneyAnalysis
): Promise<void> {
  const { error } = await supabase().from("ps_analyses").upsert({
    brand_id: brandId,
    area: analysis.area,
    data: analysis,
    analysed_at: analysis.analysedAt,
  });
  if (error) throw new Error(error.message);
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
}

export async function setProjectDraft(id: string): Promise<void> {
  const { error } = await supabase()
    .from("ps_projects")
    .update({ status: "draft", analysed_at: null })
    .eq("id", id);
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
