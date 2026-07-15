import { NextResponse } from "next/server";
import { AuthError, isAdminUser, requireUser } from "@/lib/auth-server";
import { adminListUsers } from "@/lib/admin-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(value: string | null): string {
  const v = value ?? "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV of every user — import into any CRM or email tool. */
export async function GET() {
  try {
    const user = await requireUser();
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "admins only" }, { status: 403 });
    }
    const users = await adminListUsers();
    const header =
      "email,name,company,plan,signed_up,last_sign_in,email_verified,projects,runs_total";
    const rows = users.map((u) =>
      [
        csvEscape(u.email),
        csvEscape(u.name),
        csvEscape(u.company),
        u.plan,
        u.createdAt.slice(0, 10),
        u.lastSignInAt?.slice(0, 10) ?? "",
        u.emailVerified ? "yes" : "no",
        String(u.projectCount),
        String(u.runsTotal),
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="scuup-users-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
