import { NextResponse, type NextRequest } from "next/server";
import { AuthError, planFor, requireUser } from "@/lib/auth-server";
import {
  canAccessProject,
  countMembers,
  createInvite,
  DuplicateInviteError,
  displayNameFromMeta,
  listMembers,
} from "@/lib/collab-db";
import { PLAN_INVITE_LIMIT } from "@/lib/plan";
import { ownsProject } from "@/lib/project-db";
import { sendInviteEmail } from "@/lib/send-invite-email";
import { appOriginFromRequest } from "@/lib/app-url";
import { supabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(e: unknown, fallback: string) {
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
  const message = e instanceof Error ? e.message : fallback;
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/members">
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    if (!(await canAccessProject(id, user))) {
      return NextResponse.json({ error: "not your report" }, { status: 403 });
    }
    const isOwner = await ownsProject(id, user.id);
    const [members, plan] = await Promise.all([
      listMembers(id),
      // Seats are set by the report owner's plan, not the viewer's.
      (async () => {
        const { data } = await supabase()
          .from("ps_projects")
          .select("user_id")
          .eq("id", id)
          .maybeSingle();
        return data?.user_id ? planFor(data.user_id as string) : "free";
      })(),
    ]);
    return NextResponse.json({
      members,
      isOwner,
      inviteLimit: PLAN_INVITE_LIMIT[plan],
      used: members.filter((m) => m.role !== "admin").length,
    });
  } catch (e) {
    console.error("[members] list failed:", e);
    return errorResponse(e, "failed to load members");
  }
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/members">
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    if (!(await ownsProject(id, user.id))) {
      return NextResponse.json(
        { error: "Only the report admin can invite people." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }
    if (email === user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "That's you — you already have full access." },
        { status: 400 }
      );
    }

    const [plan, used] = await Promise.all([
      planFor(user.id),
      countMembers(id),
    ]);
    const limit = PLAN_INVITE_LIMIT[plan];
    if (used >= limit) {
      return NextResponse.json(
        {
          error:
            plan === "free"
              ? "Free plans include 1 team seat per report. Upgrade to Pro to invite up to 5 people."
              : `Your plan includes ${limit} team seats per report.`,
          code: "limit_reached",
        },
        { status: 402 }
      );
    }

    const { token } = await createInvite(id, email, user.id);
    const inviteUrl = `${appOriginFromRequest(request)}/invite/${token}`;

    const { data: projectRow } = await supabase()
      .from("ps_projects")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    const emailSent = await sendInviteEmail({
      to: email,
      inviterName: displayNameFromMeta(user),
      reportName: (projectRow?.name as string) ?? "a competitor CX report",
      inviteUrl,
    });

    return NextResponse.json({
      ok: true,
      inviteUrl,
      emailSent,
      members: await listMembers(id),
    });
  } catch (e) {
    if (e instanceof DuplicateInviteError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error("[members] invite failed:", e);
    return errorResponse(e, "failed to send invite");
  }
}
