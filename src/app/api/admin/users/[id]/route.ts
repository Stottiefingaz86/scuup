import { NextResponse, type NextRequest } from "next/server";
import { AuthError, isAdminUser, requireUser } from "@/lib/auth-server";
import { adminDeleteUser } from "@/lib/admin-db";
import { supabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Permanently delete a user and all their data (mission control). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "admins only" }, { status: 403 });
    }
    const { id } = await params;
    if (id === user.id) {
      return NextResponse.json(
        { error: "You can't delete the account you're logged in with." },
        { status: 400 }
      );
    }
    const { data: target } = await supabase().auth.admin.getUserById(id);
    if (!target.user) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    if (isAdminUser(target.user)) {
      return NextResponse.json(
        { error: "Admin accounts can't be deleted from mission control." },
        { status: 400 }
      );
    }
    await adminDeleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "delete failed";
    console.error("[admin] delete user failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
