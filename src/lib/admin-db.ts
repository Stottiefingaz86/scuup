import { supabase } from "./supabase-server";
import type { Plan } from "./plan";

/**
 * Mission-control data: every query here is admin-only (callers gate with
 * isAdminUser) and reads via the service-role client.
 */

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  plan: Plan;
  createdAt: string;
  lastSignInAt: string | null;
  emailVerified: boolean;
  projectCount: number;
  activeProjectCount: number;
  runsTotal: number;
  runsToday: number;
  stripeCustomerId: string | null;
}

export interface AdminProjectSummary {
  id: string;
  name: string;
  market: string;
  status: string;
  createdAt: string;
  analysedAt: string | null;
}

export interface AdminStats {
  totalUsers: number;
  newUsersThisWeek: number;
  payingUsers: number;
  mrr: number;
  activeProjects: number;
  totalProjects: number;
  runsToday: number;
  runsThisWeek: number;
  /** ISO day → count, last 30 days. */
  signupsByDay: { day: string; count: number }[];
  runsByDay: { day: string; count: number }[];
  planSplit: { plan: string; count: number }[];
}

const PLAN_PRICES: Record<string, number> = { pro: 79, pro_plus: 349 };

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(isoDay(d));
  }
  return days;
}

function countByDay(
  timestamps: (string | null | undefined)[],
  days: string[]
): { day: string; count: number }[] {
  const counts = new Map<string, number>(days.map((d) => [d, 0]));
  for (const t of timestamps) {
    if (!t) continue;
    const day = t.slice(0, 10);
    if (counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return days.map((day) => ({ day, count: counts.get(day) ?? 0 }));
}

/** All auth users (paged through the Supabase admin API). */
async function listAuthUsers() {
  const users = [];
  let page = 1;
  // 1000/page; loop defensively capped at 50k users.
  while (page <= 50) {
    const { data, error } = await supabase().auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }
  return users;
}

export async function adminListUsers(): Promise<AdminUser[]> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [authUsers, profilesRes, projectsRes, runsRes] = await Promise.all([
    listAuthUsers(),
    supabase()
      .from("ps_profiles")
      .select("user_id, plan, company, email_verified_at, stripe_customer_id"),
    supabase().from("ps_projects").select("user_id, status"),
    supabase().from("ps_run_log").select("user_id, created_at"),
  ]);

  const profiles = new Map(
    (profilesRes.data ?? []).map((p) => [p.user_id as string, p])
  );

  const projectCounts = new Map<string, { total: number; active: number }>();
  for (const p of projectsRes.data ?? []) {
    const uid = p.user_id as string;
    const entry = projectCounts.get(uid) ?? { total: 0, active: 0 };
    entry.total++;
    if (p.status !== "archived") entry.active++;
    projectCounts.set(uid, entry);
  }

  const runCounts = new Map<string, { total: number; today: number }>();
  for (const r of runsRes.data ?? []) {
    const uid = r.user_id as string;
    const entry = runCounts.get(uid) ?? { total: 0, today: 0 };
    entry.total++;
    if (new Date(r.created_at as string) >= todayStart) entry.today++;
    runCounts.set(uid, entry);
  }

  return authUsers
    .map((u) => {
      const profile = profiles.get(u.id);
      const projects = projectCounts.get(u.id) ?? { total: 0, active: 0 };
      const runs = runCounts.get(u.id) ?? { total: 0, today: 0 };
      const plan = (profile?.plan ?? "free") as Plan;
      return {
        id: u.id,
        email: u.email ?? "",
        name:
          (u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.name as string | undefined) ??
          null,
        company: (profile?.company as string | null) ?? null,
        plan,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        emailVerified: Boolean(
          profile?.email_verified_at || u.email_confirmed_at
        ),
        projectCount: projects.total,
        activeProjectCount: projects.active,
        runsTotal: runs.total,
        runsToday: runs.today,
        stripeCustomerId:
          (profile?.stripe_customer_id as string | null) ?? null,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export async function adminStats(): Promise<AdminStats> {
  const days = lastNDays(30);
  const weekAgo = new Date();
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [authUsers, profilesRes, projectsRes, runsRes] = await Promise.all([
    listAuthUsers(),
    supabase().from("ps_profiles").select("plan"),
    supabase().from("ps_projects").select("status, created_at"),
    supabase()
      .from("ps_run_log")
      .select("created_at")
      .gte("created_at", `${days[0]}T00:00:00Z`),
  ]);

  const plans = (profilesRes.data ?? []).map((p) => p.plan as string);
  const paying = plans.filter((p) => p === "pro" || p === "pro_plus");
  const mrr = paying.reduce((sum, p) => sum + (PLAN_PRICES[p] ?? 0), 0);

  const planSplit = ["free", "pro", "pro_plus"].map((plan) => ({
    plan,
    count: plans.filter((p) => (p ?? "free") === plan).length,
  }));
  // Users without a profile row count as free.
  const unprofiled = authUsers.length - plans.length;
  if (unprofiled > 0) planSplit[0]!.count += unprofiled;

  const runTimes = (runsRes.data ?? []).map((r) => r.created_at as string);

  return {
    totalUsers: authUsers.length,
    newUsersThisWeek: authUsers.filter(
      (u) => new Date(u.created_at) >= weekAgo
    ).length,
    payingUsers: paying.length,
    mrr,
    activeProjects: (projectsRes.data ?? []).filter(
      (p) => p.status !== "archived"
    ).length,
    totalProjects: projectsRes.data?.length ?? 0,
    runsToday: runTimes.filter((t) => new Date(t) >= todayStart).length,
    runsThisWeek: runTimes.filter((t) => new Date(t) >= weekAgo).length,
    signupsByDay: countByDay(
      authUsers.map((u) => u.created_at),
      days
    ),
    runsByDay: countByDay(runTimes, days),
    planSplit,
  };
}

export async function adminProjectsForUser(
  userId: string
): Promise<AdminProjectSummary[]> {
  const { data, error } = await supabase()
    .from("ps_projects")
    .select("id, name, market, status, created_at, analysed_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    market: p.market as string,
    status: p.status as string,
    createdAt: p.created_at as string,
    analysedAt: (p.analysed_at as string | null) ?? null,
  }));
}

/** Manual plan change from mission control (early customers, comps). */
export async function adminSetPlan(userId: string, plan: Plan): Promise<void> {
  const { error } = await supabase()
    .from("ps_profiles")
    .upsert({ user_id: userId, plan }, { onConflict: "user_id" });
  if (error) throw new Error(`plan update failed: ${error.message}`);
}
