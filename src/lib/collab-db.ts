import { randomBytes } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase-server";
import { isAdminUser } from "./auth-server";
import { ownsProject } from "./project-db";
import type { ReportComment, ReportMember } from "./collab";

interface MemberRow {
  id: string;
  project_id: string;
  email: string;
  user_id: string | null;
  role: string;
  status: string;
  token: string;
  invited_by: string;
  created_at: string;
  accepted_at: string | null;
}

interface CommentRow {
  id: string;
  project_id: string;
  section_id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

/** Owner, accepted member, or platform admin — the gate for reading the
 * report and commenting. Mutations elsewhere still require ownsProject.
 * Admins get read access to every report so support can inspect and
 * re-run a user's audit from mission control. */
export async function canAccessProject(
  projectId: string,
  user: Pick<User, "id" | "email">
): Promise<boolean> {
  if (isAdminUser(user)) return true;
  if (await ownsProject(projectId, user.id)) return true;
  const { data, error } = await supabase()
    .from("ps_project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

/** Project ids shared with this user as an accepted viewer. */
export async function sharedProjectIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase()
    .from("ps_project_members")
    .select("project_id")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.project_id as string);
}

export function displayNameFromMeta(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string {
  const meta = user.user_metadata ?? {};
  for (const key of ["full_name", "name", "company"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return user.email?.split("@")[0] ?? "Teammate";
}

/** Every seat on the report: the owner (admin) first, then invitees with
 * their read receipts. */
export async function listMembers(projectId: string): Promise<ReportMember[]> {
  const db = supabase();
  const [{ data: project }, members, views] = await Promise.all([
    db.from("ps_projects").select("user_id").eq("id", projectId).maybeSingle(),
    db
      .from("ps_project_members")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    db
      .from("ps_report_views")
      .select("user_id, name, viewed_at")
      .eq("project_id", projectId),
  ]);
  if (members.error) throw new Error(members.error.message);
  if (views.error) throw new Error(views.error.message);

  const viewByUser = new Map(
    (views.data ?? []).map((v) => [
      v.user_id as string,
      { name: v.name as string, viewedAt: v.viewed_at as string },
    ])
  );

  const result: ReportMember[] = [];
  const ownerId = project?.user_id as string | null;
  if (ownerId) {
    const { data: owner } = await db.auth.admin.getUserById(ownerId);
    if (owner.user) {
      result.push({
        id: `owner-${ownerId}`,
        email: owner.user.email ?? "",
        name: displayNameFromMeta(owner.user),
        role: "admin",
        status: "active",
        viewedAt: viewByUser.get(ownerId)?.viewedAt ?? null,
      });
    }
  }

  for (const row of (members.data ?? []) as MemberRow[]) {
    const view = row.user_id ? viewByUser.get(row.user_id) : undefined;
    result.push({
      id: row.id,
      email: row.email,
      name: view?.name ?? null,
      role: "viewer",
      status: row.status === "active" ? "active" : "pending",
      viewedAt: view?.viewedAt ?? null,
    });
  }
  return result;
}

export async function countMembers(projectId: string): Promise<number> {
  const { count, error } = await supabase()
    .from("ps_project_members")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export class DuplicateInviteError extends Error {
  constructor() {
    super("That email has already been invited to this report.");
    this.name = "DuplicateInviteError";
  }
}

export async function createInvite(
  projectId: string,
  email: string,
  invitedBy: string
): Promise<{ memberId: string; token: string }> {
  const token = randomBytes(24).toString("base64url");
  const { data, error } = await supabase()
    .from("ps_project_members")
    .insert({
      project_id: projectId,
      email: email.toLowerCase(),
      token,
      invited_by: invitedBy,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new DuplicateInviteError();
    throw new Error(error.message);
  }
  return { memberId: data.id as string, token };
}

/** The invite link for a pending member — lets the owner re-copy it. */
export async function inviteTokenFor(
  projectId: string,
  memberId: string
): Promise<string | null> {
  const { data, error } = await supabase()
    .from("ps_project_members")
    .select("token")
    .eq("id", memberId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.token as string) ?? null;
}

/** Claim an invite for the signed-in account. Idempotent — re-clicking an
 * accepted link just returns the project. */
export async function acceptInvite(
  token: string,
  user: User
): Promise<{ projectId: string } | null> {
  const db = supabase();
  const { data, error } = await db
    .from("ps_project_members")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as MemberRow;
  if (row.status !== "active" || row.user_id !== user.id) {
    const { error: updateErr } = await db
      .from("ps_project_members")
      .update({
        user_id: user.id,
        status: "active",
        accepted_at: row.accepted_at ?? new Date().toISOString(),
      })
      .eq("id", row.id);
    if (updateErr) throw new Error(updateErr.message);
  }
  return { projectId: row.project_id };
}

export async function removeMember(
  projectId: string,
  memberId: string
): Promise<void> {
  const { error } = await supabase()
    .from("ps_project_members")
    .delete()
    .eq("id", memberId)
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
}

/* ---- Comments ---- */

function toComment(row: CommentRow): ReportComment {
  return {
    id: row.id,
    sectionId: row.section_id,
    userId: row.user_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function listComments(
  projectId: string
): Promise<ReportComment[]> {
  const { data, error } = await supabase()
    .from("ps_report_comments")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as CommentRow[]).map(toComment);
}

export async function addComment(
  projectId: string,
  sectionId: string,
  user: { id: string; name: string },
  body: string
): Promise<ReportComment> {
  const { data, error } = await supabase()
    .from("ps_report_comments")
    .insert({
      project_id: projectId,
      section_id: sectionId,
      user_id: user.id,
      author_name: user.name,
      body,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toComment(data as CommentRow);
}

export async function getComment(
  commentId: string
): Promise<ReportComment | null> {
  const { data, error } = await supabase()
    .from("ps_report_comments")
    .select("*")
    .eq("id", commentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toComment(data as CommentRow) : null;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase()
    .from("ps_report_comments")
    .delete()
    .eq("id", commentId);
  if (error) throw new Error(error.message);
}

/* ---- Read receipts ---- */

export async function recordView(
  projectId: string,
  user: { id: string; name: string; email: string }
): Promise<void> {
  const { error } = await supabase().from("ps_report_views").upsert({
    project_id: projectId,
    user_id: user.id,
    name: user.name,
    email: user.email,
    viewed_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
