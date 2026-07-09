import { NextResponse, type NextRequest } from "next/server";
import { importProjects } from "@/lib/project-db";
import type { Project } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** One-time migration endpoint: pushes projects saved in the browser's
 * localStorage up to Supabase. Existing project ids are skipped. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projects = Array.isArray(body.projects)
      ? (body.projects as Project[])
      : [];
    const imported = await importProjects(
      projects.filter((p) => p?.id && p?.name)
    );
    return NextResponse.json({ imported });
  } catch (e) {
    const message = e instanceof Error ? e.message : "import failed";
    console.error("[projects] import failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
