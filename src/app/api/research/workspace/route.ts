import { NextResponse, type NextRequest } from "next/server";
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

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const projects = body?.projects;
  if (!Array.isArray(projects)) {
    return NextResponse.json({ error: "projects array required" }, { status: 400 });
  }
  try {
    const { error } = await supabase()
      .from("research_workspace")
      .upsert({
        id: "default",
        projects,
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
