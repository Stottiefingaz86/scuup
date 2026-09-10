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

/** Production: no new projects, no brand add/remove. Other fields still save. */
function freezeRoster(
  existing: unknown,
  incoming: unknown[],
): unknown[] {
  if (!Array.isArray(existing)) return incoming;
  const prevById = new Map<string, { id: string; brands?: { id: string }[] }>();
  for (const raw of existing) {
    if (!raw || typeof raw !== "object" || !("id" in raw)) continue;
    const p = raw as { id: string; brands?: { id: string }[] };
    if (typeof p.id === "string") prevById.set(p.id, p);
  }
  return incoming.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || !("id" in raw)) return [];
    const p = raw as { id: string; brands?: { id: string }[] };
    const prev = prevById.get(p.id);
    if (!prev) return [];
    const incomingById = new Map(
      (p.brands ?? []).map((b) => [b.id, b] as const),
    );
    return [
      {
        ...p,
        brands: (prev.brands ?? []).map((b) => incomingById.get(b.id) ?? b),
      },
    ];
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
      next = freezeRoster(data?.projects, projects);
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
