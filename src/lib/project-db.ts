import { supabase } from "./supabase-server";
import type {
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

function assemble(
  row: ProjectRow,
  brandRows: BrandRow[],
  analysisRows: AnalysisRow[],
  sessionRows: SessionRow[]
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
    status: row.status as Project["status"],
    createdAt: row.created_at,
    analysedAt: row.analysed_at ?? undefined,
  };
}

export async function listProjects(): Promise<Project[]> {
  const db = supabase();
  const [projects, brands, analyses, sessions] = await Promise.all([
    db.from("ps_projects").select("*").order("created_at", { ascending: false }),
    db.from("ps_brands").select("*"),
    db.from("ps_analyses").select("brand_id, area, data"),
    db.from("ps_sessions").select("id, project_id, data").order("created_at", { ascending: false }),
  ]);
  for (const res of [projects, brands, analyses, sessions]) {
    if (res.error) throw new Error(res.error.message);
  }
  const brandRows = (brands.data ?? []) as BrandRow[];
  const analysisRows = (analyses.data ?? []) as AnalysisRow[];
  const sessionRows = (sessions.data ?? []) as SessionRow[];
  return ((projects.data ?? []) as ProjectRow[]).map((p) =>
    assemble(
      p,
      brandRows.filter((b) => b.project_id === p.id),
      analysisRows.filter((a) =>
        brandRows.some((b) => b.id === a.brand_id && b.project_id === p.id)
      ),
      sessionRows.filter((s) => s.project_id === p.id)
    )
  );
}

export async function insertProject(project: Project): Promise<void> {
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

export async function setProjectComplete(id: string): Promise<void> {
  const { error } = await supabase()
    .from("ps_projects")
    .update({ status: "complete", analysed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** One-time import of projects that lived in the browser's localStorage.
 * Skips projects that already exist server-side. */
export async function importProjects(projects: Project[]): Promise<number> {
  const db = supabase();
  const { data, error } = await db.from("ps_projects").select("id");
  if (error) throw new Error(error.message);
  const existing = new Set((data ?? []).map((r) => r.id as string));
  let imported = 0;
  for (const project of projects) {
    if (existing.has(project.id)) continue;
    await insertProject(project);
    imported += 1;
  }
  return imported;
}
