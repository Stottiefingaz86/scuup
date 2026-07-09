import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { listProjects } from "@/lib/project-db";
import { seedTestPersona } from "@/lib/credentials-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Seed test persona (email + password + address) for every brand in a project. */
export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/seed-accounts">
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = (await listProjects(user.id)).find((p) => p.id === id);
    if (!project) {
      return NextResponse.json({ error: "project not found" }, { status: 404 });
    }
    for (const brand of project.brands) {
      await seedTestPersona(brand.id, {
        market: project.market,
        brandName: brand.name,
        ownBrand: brand.role === "own_brand",
      });
    }
    return NextResponse.json({ ok: true, count: project.brands.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "seed failed";
    console.error("[seed-accounts] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
