"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  ChevronRight,
  CreditCard,
  Download,
  ExternalLink,
  FolderOpen,
  Globe,
  LayoutGrid,
  Loader2,
  Lock,
  Receipt,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  Trash2,
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
import { Checkbox } from "@/components/ui/checkbox";
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
import type { AdminShowcaseRow } from "@/lib/showcase-db";
import { MarketTag } from "@/components/market-tag";
import type { ServiceHealth } from "@/app/api/admin/health/route";
import type { AnalyticsOverview } from "@/app/api/admin/analytics/route";
import {
  type AdminSentryIssue,
  type AdminSentryReport,
  sentryIssuesDashboardUrl,
} from "@/lib/sentry-admin";
import {
  formatUsd,
  type ReportCogsOverview,
} from "@/lib/report-cogs";

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

const trafficConfig = {
  visitors: { label: "Visitors", color: "var(--chart-1)" },
  pageviews: { label: "Page views", color: "var(--chart-3)" },
} satisfies ChartConfig;

/** Friendly names for the product events tracked via lib/track.ts. */
const EVENT_LABELS: Record<string, string> = {
  signup_completed: "Signups",
  logged_in: "Logins",
  report_created: "Reports created",
  agent_run_started: "Agent runs",
  agent_run_failed: "Agent failures",
  checkout_started: "Checkouts started",
  billing_portal_opened: "Billing portal opens",
  invite_sent: "Invites sent",
};

const MC_COLLAPSE_KEY = "mc-collapsed-sections";

/** Remembers which mission-control panels are collapsed (per browser). */
function useMissionSectionOpen(sectionId: string, defaultOpen = true) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MC_COLLAPSE_KEY);
      if (!raw) return;
      const map = JSON.parse(raw) as Record<string, boolean>;
      if (sectionId in map) setOpen(map[sectionId]);
    } catch {
      // Ignore corrupt storage.
    }
  }, [sectionId]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        const raw = localStorage.getItem(MC_COLLAPSE_KEY);
        const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
        map[sectionId] = next;
        localStorage.setItem(MC_COLLAPSE_KEY, JSON.stringify(map));
      } catch {
        // Ignore quota errors.
      }
      return next;
    });
  }

  return { open, toggle };
}

function MissionCollapsibleCard({
  sectionId,
  title,
  description,
  icon: Icon,
  href,
  hrefLabel,
  collapsedHint,
  children,
}: {
  sectionId: string;
  title: string;
  description: string;
  icon: typeof Users;
  href?: string;
  hrefLabel?: string;
  collapsedHint?: string;
  children: ReactNode;
}) {
  const { open, toggle } = useMissionSectionOpen(sectionId);

  return (
    <Card>
      <CardHeader className={open ? undefined : "pb-4"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
          >
            <ChevronRight
              className={`mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
            />
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="size-4 text-primary" />
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
              {!open && collapsedHint ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {collapsedHint}
                </p>
              ) : null}
            </div>
          </button>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {hrefLabel}
              <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      </CardHeader>
      {open ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}

/** External tools — one place to jump into every system the business runs on. */
const TOOL_LINKS = [
  {
    name: "Stripe",
    href: "https://dashboard.stripe.com",
    note: "Payments, subscriptions, invoices",
  },
  {
    name: "PostHog",
    href: "https://eu.posthog.com/project/224760/dashboard/822320",
    note: "Growth dashboard: signups, funnel, agent runs, recordings",
  },
  {
    name: "Sentry",
    href: "https://scuup.sentry.io/issues/",
    note: "Errors and crash reports",
  },
  {
    name: "Supabase",
    href: "https://supabase.com/dashboard",
    note: "Database, auth, storage",
  },
  {
    name: "Vercel",
    href: "https://vercel.com/dashboard",
    note: "Deploys, logs, domains",
  },
  {
    name: "Vercel Analytics",
    href: "https://vercel.com/chris-projects-e99bc8f6/scuup/analytics",
    note: "Traffic, page views, referrers",
  },
  {
    name: "Browserbase",
    href: "https://www.browserbase.com/overview",
    note: "Agent browser sessions and quota",
  },
  {
    name: "OpenAI",
    href: "https://platform.openai.com/usage",
    note: "Vision model spend and rate limits",
  },
  {
    name: "Resend",
    href: "https://resend.com/emails",
    note: "Transactional email delivery",
  },
];

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

interface AdminPayment {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  receiptUrl: string | null;
}

/** "3 days", "5 months", "1y 2m" — how long the account has existed. */
function tenureLabel(createdAt: string): string {
  const days = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / 86_400_000
  );
  if (days < 1) return "joined today";
  if (days < 62) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest > 0 ? `${years}y ${rest}m` : `${years} year${years === 1 ? "" : "s"}`;
}

function UserRow({
  user,
  onPlanChange,
  onDeleted,
}: {
  user: AdminUser;
  onPlanChange: (userId: string, plan: string) => void;
  onDeleted: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [projects, setProjects] = useState<AdminProjectSummary[] | null>(null);
  const [payments, setPayments] = useState<AdminPayment[] | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function toggleProjects() {
    const next = !expanded;
    setExpanded(next);
    setConfirmingDelete(false);
    if (next && projects === null) {
      fetch(`/api/admin/users/${user.id}/projects`)
        .then((r) => r.json())
        .then((d) => setProjects(d.projects ?? []))
        .catch(() => setProjects([]));
      fetch(`/api/admin/users/${user.id}/payments`)
        .then((r) => r.json())
        .then((d) => setPayments(d.payments ?? []))
        .catch(() => setPayments([]));
    }
  }

  async function deleteUser() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      // Confirmation resets so a stray click later can't destroy an account.
      setTimeout(() => setConfirmingDelete(false), 5000);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "delete failed");
      toast.success(`${user.email} deleted`);
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  const paidTotal = (payments ?? [])
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const paidCurrency = payments?.find((p) => p.status === "paid")?.currency;

  return (
    <>
      <TableRow>
        <TableCell>
          <button
            type="button"
            onClick={toggleProjects}
            className="flex min-w-0 items-center gap-1.5 text-left"
          >
            <ChevronRight
              className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
            />
            <span className="min-w-0">
              <span className="block truncate font-medium">{user.email}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {[user.name, user.company].filter(Boolean).join(" · ") ||
                  "No details"}
              </span>
            </span>
          </button>
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
          <TableCell colSpan={7} className="py-4">
            <div className="flex flex-col gap-4">
              {/* Account facts */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  Customer for{" "}
                  <span className="font-medium text-foreground">
                    {tenureLabel(user.createdAt)}
                  </span>{" "}
                  (since{" "}
                  {new Date(user.createdAt).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                  )
                </span>
                <span>
                  {user.runsTotal} agent runs · {user.projectCount} reports
                </span>
                {paidTotal > 0 ? (
                  <span>
                    Lifetime billed:{" "}
                    <span className="font-medium text-foreground">
                      {paidTotal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}{" "}
                      {paidCurrency}
                    </span>
                  </span>
                ) : null}
                {user.stripeCustomerId ? (
                  <a
                    href={`https://dashboard.stripe.com/customers/${user.stripeCustomerId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                  >
                    Stripe customer
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Reports */}
                <div className="flex flex-col gap-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Reports
                  </p>
                  {projects === null ? (
                    <Skeleton className="h-5 w-48" />
                  ) : projects.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No reports yet.
                    </p>
                  ) : (
                    projects.map((p) => (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center gap-2 text-xs"
                      >
                        <FolderOpen className="size-3.5 text-muted-foreground" />
                        <a
                          href={`/projects/${p.id}/overview`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
                          title="Open this report (admin access)"
                        >
                          {p.name}
                          <ExternalLink className="size-3 text-muted-foreground" />
                        </a>
                        <span className="text-muted-foreground">
                          {p.market}
                        </span>
                        <Badge
                          variant={
                            p.status === "archived" ? "outline" : "secondary"
                          }
                        >
                          {p.status}
                        </Badge>
                        <span className="text-muted-foreground">
                          created{" "}
                          {new Date(p.createdAt).toLocaleDateString(undefined, {
                            dateStyle: "medium",
                          })}
                        </span>
                        <button
                          type="button"
                          className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                          title="Copy report ID"
                          onClick={async () => {
                            await navigator.clipboard.writeText(p.id);
                            toast.success("Report ID copied");
                          }}
                        >
                          {p.id}
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Payments */}
                <div className="flex flex-col gap-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Payment history
                  </p>
                  {payments === null ? (
                    <Skeleton className="h-5 w-48" />
                  ) : payments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {user.stripeCustomerId
                        ? "No invoices yet."
                        : "Never checked out. No Stripe customer."}
                    </p>
                  ) : (
                    payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center gap-2 text-xs"
                      >
                        <Receipt className="size-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {new Date(p.date).toLocaleDateString(undefined, {
                            dateStyle: "medium",
                          })}
                        </span>
                        <span className="font-medium tabular-nums">
                          {p.amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}{" "}
                          {p.currency}
                        </span>
                        <Badge
                          variant={p.status === "paid" ? "secondary" : "outline"}
                        >
                          {p.status}
                        </Badge>
                        <span className="truncate text-muted-foreground">
                          {p.description}
                        </span>
                        {p.receiptUrl ? (
                          <a
                            href={p.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                          >
                            Invoice
                            <ExternalLink className="size-3" />
                          </a>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Danger zone */}
              <div className="flex items-center gap-3 border-t pt-3">
                <Button
                  size="sm"
                  variant={confirmingDelete ? "destructive" : "outline"}
                  disabled={deleting}
                  onClick={deleteUser}
                >
                  {deleting ? (
                    <Loader2 data-icon="inline-start" className="animate-spin" />
                  ) : (
                    <Trash2 data-icon="inline-start" />
                  )}
                  {confirmingDelete
                    ? "Click again to permanently delete"
                    : "Delete user"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Removes the account, all reports, evidence and usage history.
                  This can&apos;t be undone.
                </p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

/** Usage bar: green while comfortable, amber approaching the allocation,
 * red at or past it (providers bill overage instead of cutting off). */
function UsageBar({ percent }: { percent: number }) {
  const color =
    percent >= 90
      ? "bg-destructive"
      : percent >= 70
        ? "bg-amber-500"
        : "bg-emerald-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${color} transition-all`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

function InfrastructureCard() {
  const [services, setServices] = useState<ServiceHealth[] | null>(null);
  const [cogs, setCogs] = useState<ReportCogsOverview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/health")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setServices(d.services ?? []);
        setCogs(d.cogs ?? null);
      })
      .catch(() => setFailed(true));
  }, []);

  const collapsedHint = (() => {
    if (cogs) {
      return `Free ~${formatUsd(cogs.free.totalUsd)} · Full Pro ~${formatUsd(cogs.fullPro.totalUsd)} · cycle ${formatUsd(cogs.cycle.totalUsd)}`;
    }
    if (!services?.every((s) => s.ok)) return undefined;
    return services
      .map((s) => {
        const worst = Math.max(0, ...s.metrics.map((m) => m.percent ?? 0));
        const status =
          worst >= 90 ? "scale up" : worst >= 70 ? "watch" : "healthy";
        return `${s.service}: ${status}`;
      })
      .join(" · ");
  })();

  return (
    <MissionCollapsibleCard
      sectionId="infrastructure"
      title="Infrastructure health"
      description="Live usage against each provider's plan allocation, plus estimated COGS per report from Browserbase averages and OpenAI models."
      icon={Server}
      collapsedHint={collapsedHint}
    >
      {failed ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load usage data. Check the provider APIs and try a
          refresh.
        </p>
      ) : services === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((svc) => (
              <div
                key={svc.service}
                className="flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{svc.service}</p>
                  {svc.ok ? (
                    (() => {
                      const worst = Math.max(
                        0,
                        ...svc.metrics.map((m) => m.percent ?? 0)
                      );
                      return worst >= 90 ? (
                        <Badge variant="destructive">Scale up</Badge>
                      ) : worst >= 70 ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/50 text-amber-600 dark:text-amber-400"
                        >
                          Watch
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
                        >
                          Healthy
                        </Badge>
                      );
                    })()
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Unavailable
                    </Badge>
                  )}
                </div>
                {svc.ok ? (
                  svc.metrics.map((m) => (
                    <div key={m.label} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">{m.label}</span>
                        <span className="tabular-nums">
                          <span className="font-medium">{m.used}</span>
                          {m.limit ? (
                            <span className="text-muted-foreground">
                              {" "}
                              / {m.limit} ({m.percent}%)
                            </span>
                          ) : null}
                        </span>
                      </div>
                      {m.percent !== null ? (
                        <UsageBar percent={m.percent} />
                      ) : null}
                      {m.detail ? (
                        <p className="text-[11px] text-muted-foreground">
                          {m.detail}
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">{svc.error}</p>
                )}
              </div>
            ))}
          </div>

          {cogs ? (
            <ReportCogsPanel cogs={cogs} />
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Estimated COGS will appear once Browserbase usage is available
              for this cycle.
            </div>
          )}
        </div>
      )}
    </MissionCollapsibleCard>
  );
}

function ReportCogsPanel({ cogs }: { cogs: ReportCogsOverview }) {
  const estimates = [cogs.free, cogs.fullPro];
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <Receipt className="size-4 text-primary" />
            Estimated COGS per report
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{cogs.note}</p>
        </div>
        {cogs.cycle.effectivePerReportUsd != null ? (
          <Badge variant="outline" className="tabular-nums">
            Cycle avg {formatUsd(cogs.cycle.effectivePerReportUsd)}/report
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {estimates.map((est) => (
          <div
            key={est.label}
            className="flex flex-col gap-1 rounded-md bg-muted/40 px-3 py-2.5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium">{est.label}</span>
              <span className="text-base font-semibold tabular-nums">
                {formatUsd(est.totalUsd)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">{est.detail}</p>
            <p className="text-[11px] tabular-nums text-muted-foreground">
              BB {formatUsd(est.browserbaseUsd)} · OpenAI{" "}
              {formatUsd(est.openaiUsd)} · {est.sessions} sessions
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-2 border-t pt-3 text-xs sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground">This cycle (est.)</p>
          <p className="font-medium tabular-nums">
            {formatUsd(cogs.cycle.totalUsd)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Browserbase</p>
          <p className="font-medium tabular-nums">
            {formatUsd(cogs.cycle.browserbaseUsd)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {cogs.cycle.proxyGb.toFixed(2)} GB ·{" "}
            {(cogs.cycle.browserMinutes / 60).toFixed(1)} hrs
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">OpenAI (modeled)</p>
          <p className="font-medium tabular-nums">
            {formatUsd(cogs.cycle.openaiUsd)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {cogs.cycle.analyzeRuns} analyze · {cogs.cycle.vocRuns} voc ·{" "}
            {cogs.cycle.designRuns} design
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Per working session</p>
          <p className="font-medium tabular-nums">
            {formatUsd(cogs.unit.browserbaseUsd)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {cogs.unit.browserMinutes.toFixed(1)} min ·{" "}
            {cogs.unit.proxyMb.toFixed(1)} MB
          </p>
        </div>
      </div>
    </div>
  );
}

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function levelVariant(
  level: string
): "destructive" | "secondary" | "outline" {
  if (level === "error" || level === "fatal") return "destructive";
  if (level === "warning") return "secondary";
  return "outline";
}

function SentryIssueRow({ issue }: { issue: AdminSentryIssue }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <a
          href={issue.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-center gap-1 font-medium underline-offset-2 hover:underline"
        >
          <span className="truncate">{issue.title}</span>
          <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
        </a>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={levelVariant(issue.level)}>{issue.level}</Badge>
          <span className="font-mono text-[10px] text-muted-foreground">
            {issue.shortId}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground">
        {issue.culprit ? <span>{issue.culprit}</span> : null}
        <span>
          {issue.eventCount.toLocaleString()} event
          {issue.eventCount === 1 ? "" : "s"}
        </span>
        <span>
          {issue.userCount.toLocaleString()} user
          {issue.userCount === 1 ? "" : "s"}
        </span>
        <span>Last seen {relativeTime(issue.lastSeen)}</span>
      </div>
    </div>
  );
}

function SentryReportsCard() {
  const [report, setReport] = useState<
    AdminSentryReport | { configured: false } | null
  >(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/sentry")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setReport(d.report ?? { configured: false }))
      .catch(() => setFailed(true));
  }, []);

  return (
    <MissionCollapsibleCard
      sectionId="sentry"
      title="Error reports"
      description="Unresolved issues from Sentry, last 24 hours of activity."
      icon={ShieldAlert}
      href={sentryIssuesDashboardUrl()}
      hrefLabel="Open in Sentry"
      collapsedHint={
        report?.configured && report.issues.length > 0
          ? `${report.unresolvedCount} unresolved issue${report.unresolvedCount === 1 ? "" : "s"}`
          : report?.configured
            ? "All clear"
            : undefined
      }
    >
      {failed ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load Sentry issues. Check the auth token and try a
          refresh.
        </p>
      ) : report === null ? (
        <Skeleton className="h-40 w-full" />
      ) : !report.configured ? (
        <p className="text-sm text-muted-foreground">
          Add SENTRY_AUTH_TOKEN (Settings &gt; Developer Settings &gt; Auth
          Tokens, with event:read scope) to Vercel to see error reports here.
        </p>
      ) : report.issues.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Badge
            variant="outline"
            className="border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
          >
            All clear
          </Badge>
          <p className="text-sm text-muted-foreground">
            No unresolved issues in the last 24 hours.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {report.unresolvedCount.toLocaleString()}
            </span>{" "}
            unresolved
            {report.unresolvedCount > report.issues.length
              ? ` (showing ${report.issues.length} most recent)`
              : null}
          </p>
          {report.issues.map((issue) => (
            <SentryIssueRow key={issue.id} issue={issue} />
          ))}
        </div>
      )}
    </MissionCollapsibleCard>
  );
}

function WebAnalyticsCard() {
  const [analytics, setAnalytics] = useState<
    AnalyticsOverview | { configured: false } | null
  >(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setAnalytics(d.analytics ?? { configured: false }))
      .catch(() => setFailed(true));
  }, []);

  return (
    <MissionCollapsibleCard
      sectionId="posthog"
      title="Traffic and product analytics"
      description="Live from PostHog: visitors, top pages, referrers and key product events, last 30 days."
      icon={Globe}
      href="https://eu.posthog.com/project/224760/dashboard/822320"
      hrefLabel="Open in PostHog"
      collapsedHint={
        analytics?.configured
          ? `${analytics.visitors30d.toLocaleString()} visitors · ${analytics.pageviews30d.toLocaleString()} page views (30d)`
          : undefined
      }
    >
      {failed ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load PostHog data. Check the personal API key and try a
          refresh.
        </p>
      ) : analytics === null ? (
        <Skeleton className="h-48 w-full" />
      ) : !analytics.configured ? (
        <p className="text-sm text-muted-foreground">
          Add POSTHOG_PERSONAL_API_KEY (Settings &gt; Personal API keys, with
          Query Read scope) to Vercel to see PostHog stats here.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                Unique visitors (30d)
              </p>
              <p className="font-heading text-2xl font-semibold tabular-nums">
                {analytics.visitors30d.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {analytics.visitorsToday.toLocaleString()} today
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Page views (30d)</p>
              <p className="font-heading text-2xl font-semibold tabular-nums">
                {analytics.pageviews30d.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                Top referrer (30d)
              </p>
              <p className="truncate font-heading text-2xl font-semibold">
                {analytics.referrers[0]?.domain ?? "Direct only"}
              </p>
              {analytics.referrers[0] ? (
                <p className="text-xs text-muted-foreground">
                  {analytics.referrers[0].visitors.toLocaleString()} visitors
                </p>
              ) : null}
            </div>
          </div>

          <ChartContainer config={trafficConfig} className="h-44 w-full">
            <AreaChart data={analytics.byDay}>
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
                dataKey="pageviews"
                type="monotone"
                fill="var(--color-pageviews)"
                fillOpacity={0.15}
                stroke="var(--color-pageviews)"
              />
              <Area
                dataKey="visitors"
                type="monotone"
                fill="var(--color-visitors)"
                fillOpacity={0.25}
                stroke="var(--color-visitors)"
              />
            </AreaChart>
          </ChartContainer>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Top pages
              </p>
              {analytics.topPages.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data yet.</p>
              ) : (
                analytics.topPages.map((p) => (
                  <div
                    key={p.path}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate font-mono">{p.path}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {p.views.toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Referrers
              </p>
              {analytics.referrers.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  All traffic is direct so far.
                </p>
              ) : (
                analytics.referrers.map((r) => (
                  <div
                    key={r.domain}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate">{r.domain}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {r.visitors.toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Product events (30d)
              </p>
              {analytics.events.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No product events yet.
                </p>
              ) : (
                analytics.events.map((e) => (
                  <div
                    key={e.event}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate">
                      {EVENT_LABELS[e.event] ?? e.event}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {e.count.toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </MissionCollapsibleCard>
  );
}

function ShowcaseHomepageCard() {
  const [entries, setEntries] = useState<AdminShowcaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/showcase");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      toast.error("Couldn't load homepage showcase.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle(row: AdminShowcaseRow, homepage: boolean) {
    const key = `${row.brandSlug}:${row.market}`;
    setBusy(key);
    setEntries((all) =>
      all.map((e) =>
        e.brandSlug === row.brandSlug && e.market === row.market
          ? { ...e, homepage }
          : e
      )
    );
    try {
      const res = await fetch("/api/admin/showcase", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandSlug: row.brandSlug,
          market: row.market,
          homepage,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        homepage
          ? `${row.brandName} is on the homepage`
          : `${row.brandName} hidden from the homepage`
      );
    } catch {
      setEntries((all) =>
        all.map((e) =>
          e.brandSlug === row.brandSlug && e.market === row.market
            ? { ...e, homepage: !homepage }
            : e
        )
      );
      toast.error("Couldn't update homepage visibility.");
    } finally {
      setBusy(null);
    }
  }

  const onCount = entries.filter((e) => e.homepage).length;

  return (
    <MissionCollapsibleCard
      sectionId="showcase"
      title="Homepage showcase"
      description="Choose which scored brands appear in the public Player CX carousel on the landing page."
      icon={LayoutGrid}
      href="/#showcase"
      hrefLabel="View on site"
      collapsedHint={
        loading
          ? undefined
          : `${onCount} of ${entries.length} brands showing on homepage`
      }
    >
      {loading && entries.length === 0 ? (
        <Skeleton className="h-40 w-full" />
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No scored brands in the showcase yet. Complete a report and it will
          show up here.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Home</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Market</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>Report</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((row) => {
              const key = `${row.brandSlug}:${row.market}`;
              return (
                <TableRow key={key}>
                  <TableCell>
                    <Checkbox
                      checked={row.homepage}
                      disabled={busy === key}
                      onCheckedChange={(v) =>
                        void toggle(row, v === true)
                      }
                      aria-label={`Show ${row.brandName} on homepage`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={row.favicon || "/icon.png"}
                        alt=""
                        width={20}
                        height={20}
                        className="size-5 rounded-sm"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {row.brandName}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {row.brandUrl.replace(/^https?:\/\//, "")}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <MarketTag market={row.market} />
                  </TableCell>
                  <TableCell className="text-right font-heading tabular-nums">
                    {row.cxScore}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate text-xs text-muted-foreground">
                    {row.projectName ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </MissionCollapsibleCard>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
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
  }, []);

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
                Change plans directly. Click a user to see their reports,
                payment history and account controls.
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
                  <UserRow
                    key={u.id}
                    user={u}
                    onPlanChange={changePlan}
                    onDeleted={() =>
                      setUsers((all) => all.filter((x) => x.id !== u.id))
                    }
                  />
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

      <ShowcaseHomepageCard />

      <WebAnalyticsCard />

      <SentryReportsCard />

      <InfrastructureCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Systems</CardTitle>
          <CardDescription>
            Jump into the tools behind the product.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOOL_LINKS.map((tool) => (
              <a
                key={tool.name}
                href={tool.href}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start justify-between gap-2 rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{tool.name}</p>
                  <p className="text-xs text-muted-foreground">{tool.note}</p>
                </div>
                <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
