import { NextResponse, type NextRequest } from "next/server";
import { insertProject, listProjects } from "@/lib/project-db";
import type { Project } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json({ projects });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to load projects";
    console.error("[projects] list failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const project = body.project as Project | undefined;
    if (!project?.id || !project.name || !Array.isArray(project.brands)) {
      return NextResponse.json({ error: "invalid project" }, { status: 400 });
    }
    await insertProject(project);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to save project";
    console.error("[projects] create failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
