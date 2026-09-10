import { NextResponse, type NextRequest } from "next/server";
import { isProductionDeploy } from "@/lib/prod-locks";
import { supabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await supabase()
      .from("research_workspace")
      .select("projects, updated_at")
      .eq("id", "default")
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      projects: data?.projects ?? [],
      updatedAt: data?.updated_at ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "workspace read failed" },
      { status: 500 },
    );
  }
}

function restoreRemovedBrands(
  existing: unknown,
  incoming: unknown[],
): unknown[] {
  if (!Array.isArray(existing)) return incoming;
  const prevById = new Map<
    string,
    {
      id: string;
      brands?: { id: string }[];
      runs?: { id: string; brandId?: string }[];
      emails?: { id?: string; brandId?: string }[];
      teardowns?: { brandId?: string }[];
    }
  >();
  for (const raw of existing) {
    if (!raw || typeof raw !== "object" || !("id" in raw)) continue;
    const p = raw as {
      id: string;
      brands?: { id: string }[];
      runs?: { id: string; brandId?: string }[];
      emails?: { id?: string; brandId?: string }[];
      teardowns?: { brandId?: string }[];
    };
    if (typeof p.id === "string") prevById.set(p.id, p);
  }
  return incoming.map((raw) => {
    if (!raw || typeof raw !== "object" || !("id" in raw)) return raw;
    const p = raw as {
      id: string;
      brands?: { id: string }[];
      runs?: { id: string; brandId?: string }[];
      emails?: { id?: string; brandId?: string }[];
      teardowns?: { brandId?: string }[];
    };
    const prev = prevById.get(p.id);
    if (!prev?.brands?.length || !Array.isArray(p.brands)) return raw;
    const keep = new Set(p.brands.map((b) => b.id));
    const missing = prev.brands.filter((b) => b.id && !keep.has(b.id));
    if (!missing.length) return raw;
    const missingIds = new Set(missing.map((b) => b.id));
    const runIds = new Set((p.runs ?? []).map((r) => r.id));
    return {
      ...p,
      brands: [...p.brands, ...missing],
      runs: [
        ...(p.runs ?? []),
        ...(prev.runs ?? []).filter(
          (r) => r.brandId && missingIds.has(r.brandId) && !runIds.has(r.id),
        ),
      ],
      emails: [
        ...(p.emails ?? []),
        ...(prev.emails ?? []).filter(
          (e) => e.brandId && missingIds.has(e.brandId),
        ),
      ],
      teardowns: [
        ...(p.teardowns ?? []),
        ...(prev.teardowns ?? []).filter(
          (t) => t.brandId && missingIds.has(t.brandId),
        ),
      ],
    };
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const projects = body?.projects;
  if (!Array.isArray(projects)) {
    return NextResponse.json({ error: "projects array required" }, { status: 400 });
  }
  try {
    let next = projects;
    if (isProductionDeploy()) {
      const { data } = await supabase()
        .from("research_workspace")
        .select("projects")
        .eq("id", "default")
        .maybeSingle();
      next = restoreRemovedBrands(data?.projects, projects);
    }
    const { error } = await supabase()
      .from("research_workspace")
      .upsert({
        id: "default",
        projects: next,
        updated_at: new Date().toISOString(),
      });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, count: projects.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "workspace write failed" },
      { status: 500 },
    );
  }
}
