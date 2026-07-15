"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FolderOpen,
  KeyRound,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
} from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AdminProjectSummary,
  AdminStats,
  AdminUser,
} from "@/lib/admin-db";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  pro_plus: "Pro Plus",
};

const signupsConfig = {
  count: { label: "Signups", color: "var(--chart-1)" },
} satisfies ChartConfig;

const runsConfig = {
  count: { label: "Agent runs", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** External tools — one place to jump into every system the business runs on.
 * credsKey matches the /api/admin/credentials response for copy buttons. */
const TOOL_LINKS = [
  {
    name: "Stripe",
    href: "https://dashboard.stripe.com",
    note: "Payments, subscriptions, invoices",
    credsKey: "stripe",
  },
  {
    name: "PostHog",
    href: "https://eu.posthog.com/project/224760/dashboard/822320",
    note: "Growth dashboard: signups, funnel, agent runs, recordings",
    credsKey: "posthog",
  },
  {
    name: "Sentry",
    href: "https://scuup.sentry.io/issues/",
    note: "Errors and crash reports",
    credsKey: "sentry",
  },
  {
    name: "Supabase",
    href: "https://supabase.com/dashboard",
    note: "Database, auth, storage",
    credsKey: "supabase",
  },
  {
    name: "Vercel",
    href: "https://vercel.com/dashboard",
    note: "Deploys, logs, domains",
    credsKey: null,
  },
  {
    name: "Vercel Analytics",
    href: "https://vercel.com/chris-projects-e99bc8f6/scuup/analytics",
    note: "Traffic, page views, referrers",
    credsKey: null,
  },
  {
    name: "Browserbase",
    href: "https://www.browserbase.com/overview",
    note: "Agent browser sessions and quota",
    credsKey: "browserbase",
  },
  {
    name: "OpenAI",
    href: "https://platform.openai.com/usage",
    note: "Vision model spend and rate limits",
    credsKey: "openai",
  },
  {
    name: "Resend",
    href: "https://resend.com/emails",
    note: "Transactional email delivery",
    credsKey: "resend",
  },
];

type ToolCredential = { label: string; value: string };

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-heading text-2xl font-semibold tabular-nums">
            {value}
          </p>
          {detail ? (
            <p className="text-xs text-muted-foreground">{detail}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function UserRow({
  user,
  onPlanChange,
}: {
  user: AdminUser;
  onPlanChange: (userId: string, plan: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [projects, setProjects] = useState<AdminProjectSummary[] | null>(null);

  async function toggleProjects() {
    const next = !expanded;
    setExpanded(next);
    if (next && projects === null) {
      try {
        const res = await fetch(`/api/admin/users/${user.id}/projects`);
        const data = await res.json();
        setProjects(data.projects ?? []);
      } catch {
        setProjects([]);
      }
    }
  }

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="min-w-0">
            <p className="truncate font-medium">{user.email}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[user.name, user.company].filter(Boolean).join(" · ") ||
                "No details"}
            </p>
          </div>
        </TableCell>
        <TableCell>
          <Select
            value={user.plan}
            onValueChange={(v) => {
              if (v && v !== user.plan) onPlanChange(user.id, v);
            }}
          >
            <SelectTrigger size="sm" className="min-w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="pro_plus">Pro Plus</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="text-center">
          {user.emailVerified ? (
            <Badge variant="secondary">Verified</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Unverified
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-center tabular-nums">
          <button
            className="underline-offset-2 hover:underline"
            onClick={toggleProjects}
          >
            {user.projectCount}
          </button>
        </TableCell>
        <TableCell className="text-center tabular-nums">
          {user.runsTotal}
          {user.runsToday > 0 ? (
            <span className="text-xs text-muted-foreground">
              {" "}
              (+{user.runsToday} today)
            </span>
          ) : null}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {new Date(user.createdAt).toLocaleDateString(undefined, {
            dateStyle: "medium",
          })}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {user.lastSignInAt
            ? new Date(user.lastSignInAt).toLocaleDateString(undefined, {
                dateStyle: "medium",
              })
            : "Never"}
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={7} className="py-3">
            {projects === null ? (
              <Skeleton className="h-5 w-48" />
            ) : projects.length === 0 ? (
              <p className="text-xs text-muted-foreground">No reports yet.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center gap-2 text-xs"
                  >
                    <FolderOpen className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">{p.market}</span>
                    <Badge
                      variant={p.status === "archived" ? "outline" : "secondary"}
                    >
                      {p.status}
                    </Badge>
                    <span className="text-muted-foreground">
                      created{" "}
                      {new Date(p.createdAt).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [credentials, setCredentials] = useState<Record<
    string,
    ToolCredential[]
  > | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/overview");
      if (res.status === 401 || res.status === 403) {
        setDenied(true);
        return;
      }
      const data = await res.json();
      setStats(data.stats);
      setUsers(data.users ?? []);
    } catch {
      toast.error("Couldn't load mission control data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Keys load separately so a slow secrets fetch never delays the stats.
    fetch("/api/admin/credentials")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.credentials) setCredentials(d.credentials);
      })
      .catch(() => {});
  }, []);

  async function copyCredential(tool: string, cred: ToolCredential) {
    try {
      await navigator.clipboard.writeText(cred.value);
      toast.success(`${tool} ${cred.label.toLowerCase()} copied`);
    } catch {
      toast.error("Clipboard blocked by the browser.");
    }
  }

  async function changePlan(userId: string, plan: string) {
    const prev = users;
    setUsers((u) =>
      u.map((x) => (x.id === userId ? { ...x, plan: plan as AdminUser["plan"] } : x))
    );
    try {
      const res = await fetch("/api/admin/users/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, plan }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Plan set to ${PLAN_LABELS[plan] ?? plan}`);
    } catch {
      setUsers(prev);
      toast.error("Plan change failed.");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.name?.toLowerCase().includes(q) ||
        u.company?.toLowerCase().includes(q)
    );
  }, [users, query]);

  if (denied) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <ShieldAlert className="size-10 text-muted-foreground" />
        <h1 className="font-heading text-xl font-semibold">Admins only</h1>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Mission control is restricted to the Scuup admin account. Log in
          with it and try again.
        </p>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          <ArrowLeft data-icon="inline-start" />
          Back to Scuup
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-2xl font-semibold tracking-tight">
            <Lock className="size-5 text-primary" />
            Mission control
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Users, revenue, agent activity, and every system Scuup runs on.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw
              data-icon="inline-start"
              className={loading ? "animate-spin" : undefined}
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href="/api/admin/users/export" download />}
          >
            <Download data-icon="inline-start" />
            Export emails (CSV)
          </Button>
        </div>
      </header>

      {loading && !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              icon={Users}
              label="Total users"
              value={String(stats.totalUsers)}
              detail={`+${stats.newUsersThisWeek} this week`}
            />
            <StatCard
              icon={CreditCard}
              label="Paying customers"
              value={String(stats.payingUsers)}
              detail={`€${stats.mrr.toLocaleString()} MRR`}
            />
            <StatCard
              icon={FolderOpen}
              label="Active reports"
              value={String(stats.activeProjects)}
              detail={`${stats.totalProjects} all time`}
            />
            <StatCard
              icon={Activity}
              label="Agent runs today"
              value={String(stats.runsToday)}
              detail={`${stats.runsThisWeek} this week`}
            />
            <StatCard
              icon={BarChart3}
              label="Plan split"
              value={
                stats.planSplit
                  .filter((p) => p.count > 0)
                  .map((p) => `${p.count} ${PLAN_LABELS[p.plan] ?? p.plan}`)
                  .join(" · ") || "0"
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signups</CardTitle>
                <CardDescription>New accounts, last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={signupsConfig} className="h-44 w-full">
                  <AreaChart data={stats.signupsByDay}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(d: string) => d.slice(5)}
                      minTickGap={24}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      dataKey="count"
                      type="monotone"
                      fill="var(--color-count)"
                      fillOpacity={0.2}
                      stroke="var(--color-count)"
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agent runs</CardTitle>
                <CardDescription>
                  Analyses, VoC, design reviews and captures, last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={runsConfig} className="h-44 w-full">
                  <BarChart data={stats.runsByDay}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(d: string) => d.slice(5)}
                      minTickGap={24}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="count"
                      fill="var(--color-count)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Users</CardTitle>
              <CardDescription>
                Change plans directly. Click a report count to see the
                user&apos;s reports.
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search email, name, company"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-64 pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && users.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-center">Email</TableHead>
                  <TableHead className="text-center">Reports</TableHead>
                  <TableHead className="text-center">Runs</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <UserRow key={u.id} user={u} onPlanChange={changePlan} />
                ))}
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No users match.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Systems</CardTitle>
          <CardDescription>
            Jump into the tools behind the product. Key buttons copy the live
            credential to your clipboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOOL_LINKS.map((tool) => {
              const creds = tool.credsKey
                ? (credentials?.[tool.credsKey] ?? [])
                : [];
              return (
                <div
                  key={tool.name}
                  className="flex flex-col gap-2 rounded-lg border p-3"
                >
                  <a
                    href={tool.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-start justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{tool.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {tool.note}
                      </p>
                    </div>
                    <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                  </a>
                  {creds.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {creds.map((c) => (
                        <button
                          key={c.label}
                          type="button"
                          onClick={() => copyCredential(tool.name, c)}
                          className="flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <KeyRound className="size-3" />
                          {c.label}
                          <Copy className="size-2.5 opacity-60" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
