import { NextResponse, type NextRequest } from "next/server";
import { AuthError, isAdminUser, requireUser } from "@/lib/auth-server";
import { adminProjectsForUser } from "@/lib/admin-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A user's reports, for the mission-control detail row. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "admins only" }, { status: 403 });
    }
    const { id } = await params;
    const projects = await adminProjectsForUser(id);
    return NextResponse.json({ projects });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
