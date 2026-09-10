import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dev-only: persist a browser localStorage dump so we can upload it. */
export async function POST(request: NextRequest) {
  if (process.env.VERCEL) {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const projects = body?.projects;
  if (!Array.isArray(projects)) {
    return NextResponse.json({ error: "projects array required" }, { status: 400 });
  }
  const dir = path.join(process.cwd(), ".data");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "research-snapshot.json");
  await writeFile(file, JSON.stringify(projects));
  return NextResponse.json({
    ok: true,
    count: projects.length,
    runs: projects.reduce(
      (n: number, p: { runs?: unknown[] }) => n + (p.runs?.length ?? 0),
      0,
    ),
  });
}
