"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { latestRunForBrand } from "@/lib/research/feature-benchmark";
import { brandHasCompletedSignup } from "@/lib/research/store";
import type {
  ResearchBrand,
  ResearchProject,
} from "@/lib/research/types";
import { cn } from "@/lib/utils";

function formatSec(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

function brandOverviewCard(
  project: ResearchProject,
  brand: ResearchBrand,
  batchRunning = false,
  batchProgress: string | null = null
) {
  const latest = latestRunForBrand(project.runs, brand.id);
  const signedUp = brandHasCompletedSignup(project, brand.id);
  const emails = project.emails.filter((e) => e.brandId === brand.id);
  const doneStages =
    latest?.stages.filter(
      (s) => s.endedAt != null || (s.timeSec != null && s.timeSec > 0)
    ).length ?? 0;
  const totalStages = latest?.stages.length ?? 0;

  type Tone = "ok" | "run" | "fail" | "idle" | "warn";
  let tone: Tone = "idle";
  let label = "Not started";
  let summary = "No journey run yet.";

  const batchOnThis =
    batchRunning &&
    Boolean(batchProgress?.toLowerCase().includes(brand.name.toLowerCase()));

  if (latest?.status === "running" || batchOnThis) {
    tone = "run";
    label = "In progress";
    const active =
      latest?.stages.find((s) => s.startedAt && !s.endedAt)?.label ||
      latest?.trail?.at(-1) ||
      batchProgress ||
      "Agent working";
    summary = String(active).slice(0, 120);
  } else if (signedUp) {
    tone = "ok";
    label = "Signed up";
    const t = latest?.metrics.totalTimeSec;
    summary =
      t != null
        ? `Verified in ${formatSec(t)} · ${doneStages}/${totalStages} stages`
        : emails.length > 0
          ? `Registered · ${emails.length} email${emails.length === 1 ? "" : "s"}`
          : "Marked registered";
  } else if (latest?.status === "failed") {
    tone = "fail";
    label = "Failed";
    summary = (latest.error || "Signup stopped early").slice(0, 140);
  } else if (latest?.status === "complete") {
    tone = "warn";
    label = "Partial";
    summary =
      doneStages > 0
        ? `${doneStages}/${totalStages} stages done`
        : "Run finished without a verified account";
  }

  return { tone, label, summary };
}

const TONE: Record<
  "ok" | "run" | "fail" | "idle" | "warn",
  { dot: string; badge: string }
> = {
  ok: {
    dot: "bg-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300",
  },
  run: {
    dot: "bg-[var(--rs-accent)] animate-pulse",
    badge: "bg-[var(--rs-accent)]/15 text-[var(--rs-accent)]",
  },
  fail: { dot: "bg-red-400", badge: "bg-red-500/15 text-red-300" },
  warn: { dot: "bg-amber-400", badge: "bg-amber-500/15 text-amber-200" },
  idle: {
    dot: "bg-[var(--rs-muted)]/50",
    badge: "bg-[var(--rs-border)] text-[var(--rs-muted)]",
  },
};

const PLACEHOLDER_TREND = [
  { label: "Run 1", own: 18, best: 12 },
  { label: "Run 2", own: 16, best: 11 },
  { label: "Run 3", own: 14, best: 11 },
  { label: "Run 4", own: 13, best: 10 },
  { label: "Run 5", own: 12, best: 10 },
];

const PLACEHOLDER_BRANDS = [
  { name: "Own", minutes: 14 },
  { name: "Comp A", minutes: 11 },
  { name: "Comp B", minutes: 16 },
  { name: "Comp C", minutes: 12 },
];

const PLACEHOLDER_EMAIL = [
  { category: "Verify", count: 4 },
  { category: "Welcome", count: 3 },
  { category: "Deposit", count: 2 },
  { category: "Bonus", count: 5 },
];

const trendConfig = {
  own: { label: "Own brand", color: "var(--rs-accent)" },
  best: { label: "Best competitor", color: "oklch(0.7 0.12 250)" },
} satisfies ChartConfig;

const brandConfig = {
  minutes: { label: "Minutes", color: "var(--rs-accent)" },
} satisfies ChartConfig;

const emailConfig = {
  count: { label: "Emails", color: "oklch(0.72 0.14 145)" },
} satisfies ChartConfig;

function Scorecard({
  label,
  value,
  hint,
  empty,
}: {
  label: string;
  value: string;
  hint: string;
  empty?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] px-4 py-3",
        empty && "opacity-55"
      )}
    >
      <p className="text-[11px] uppercase tracking-wide text-[var(--rs-muted)]">
        {label}
      </p>
      <p className="mt-1 font-heading text-2xl font-semibold tabular-nums tracking-tight text-[var(--rs-fg)]">
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-[var(--rs-muted)]">
        {hint}
      </p>
    </div>
  );
}

function ChartPanel({
  title,
  subtitle,
  empty,
  emptyHint,
  children,
}: {
  title: string;
  subtitle: string;
  empty: boolean;
  emptyHint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] p-4">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-[var(--rs-fg)]">{title}</h3>
        <p className="mt-0.5 text-[11px] text-[var(--rs-muted)]">{subtitle}</p>
      </div>
      <div className={cn(empty && "opacity-40 grayscale")}>{children}</div>
      {empty ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-14 flex items-center justify-center bg-gradient-to-t from-[var(--rs-card)] via-[var(--rs-card)]/80 to-transparent px-6">
          <p className="rounded-lg border border-[var(--rs-border)] bg-[var(--rs-bg)]/90 px-3 py-2 text-center text-[11px] text-[var(--rs-muted)]">
            {emptyHint}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function ResearchOverviewDashboard({
  project,
  inboxOk,
  batchRunning,
  depositBatchRunning,
  batchProgress,
  depositBatchProgress,
  runError,
  trail,
  liveViewUrl,
  onStartFresh,
  onRetryRemaining,
  onDeposit,
  onOpenBrand,
}: {
  project: ResearchProject;
  inboxOk: boolean | null;
  batchRunning: boolean;
  depositBatchRunning: boolean;
  batchProgress: string | null;
  depositBatchProgress: string | null;
  runError: string | null;
  trail: string[];
  liveViewUrl: string | null;
  onStartFresh: () => void;
  onRetryRemaining: () => void;
  onDeposit: () => void;
  onOpenBrand: (brandId: string) => void;
}) {
  const signedUp = project.brands.filter((b) =>
    brandHasCompletedSignup(project, b.id)
  ).length;
  const remaining = project.brands.length - signedUp;
  const busy = batchRunning || depositBatchRunning;
  const inboxLabel =
    inboxOk == null
      ? "Checking inbox…"
      : inboxOk
        ? "Inbox ready"
        : "Inbox offline";

  const completeRuns = project.runs.filter((r) => r.status === "complete");
  const stakeValues = completeRuns
    .map((r) => r.metrics.depositToFirstBetSec ?? r.metrics.totalTimeSec)
    .filter((n): n is number => typeof n === "number" && n > 0);
  const avgStake =
    stakeValues.length > 0
      ? stakeValues.reduce((a, b) => a + b, 0) / stakeValues.length
      : null;

  const frictionCount = completeRuns.reduce(
    (n, r) => n + (r.topFriction?.length ?? 0),
    0
  );

  const brandBars = project.brands.map((b) => {
    const td = project.teardowns.find((t) => t.brandId === b.id);
    const run = [...project.runs]
      .reverse()
      .find((r) => r.brandId === b.id && r.status === "complete");
    const sec =
      td?.depositToFirstBetSec ??
      td?.totalOnboardingTimeSec ??
      run?.metrics.depositToFirstBetSec ??
      run?.metrics.totalTimeSec ??
      null;
    return {
      name: b.name.slice(0, 10),
      minutes: sec != null ? Math.round((sec / 60) * 10) / 10 : null,
    };
  });
  const brandChartHasData = brandBars.some((b) => b.minutes != null);
  const brandChartData = brandChartHasData
    ? brandBars.map((b) => ({ name: b.name, minutes: b.minutes ?? 0 }))
    : PLACEHOLDER_BRANDS;

  const ownId = project.brands.find((b) => b.role === "own_brand")?.id;
  const competitorIds = new Set(
    project.brands.filter((b) => b.role !== "own_brand").map((b) => b.id)
  );

  const byDay = new Map<
    string,
    { label: string; own: number[]; best: number[] }
  >();
  for (const r of completeRuns) {
    const day = (r.dateTested || "").slice(0, 10);
    if (!day) continue;
    const sec = r.metrics.depositToFirstBetSec ?? r.metrics.totalTimeSec;
    if (sec == null) continue;
    const mins = Math.round((sec / 60) * 10) / 10;
    const row = byDay.get(day) ?? {
      label: day.slice(5),
      own: [] as number[],
      best: [] as number[],
    };
    if (r.brandId === ownId) row.own.push(mins);
    else if (competitorIds.has(r.brandId)) row.best.push(mins);
    byDay.set(day, row);
  }
  const trendRows = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({
      label: v.label,
      own:
        v.own.length > 0
          ? Math.round((v.own.reduce((a, b) => a + b, 0) / v.own.length) * 10) /
            10
          : null,
      best:
        v.best.length > 0
          ? Math.round(
              (v.best.reduce((a, b) => a + b, 0) / v.best.length) * 10
            ) / 10
          : null,
    }))
    .filter((r) => r.own != null || r.best != null);
  const trendHasData = trendRows.length >= 1;
  const trendData = trendHasData
    ? trendRows.map((r) => ({
        label: r.label,
        own: r.own ?? 0,
        best: r.best ?? 0,
      }))
    : PLACEHOLDER_TREND;

  const emailCats: Record<string, number> = {
    Verify: 0,
    Welcome: 0,
    Deposit: 0,
    Bonus: 0,
    Other: 0,
  };
  for (const e of project.emails) {
    if (e.category === "verify") emailCats.Verify!++;
    else if (e.category === "welcome") emailCats.Welcome!++;
    else if (e.category === "deposit_nudge") emailCats.Deposit!++;
    else if (e.category === "bonus" || e.category === "vip")
      emailCats.Bonus!++;
    else emailCats.Other!++;
  }
  const emailHasData = project.emails.length > 0;
  const emailData = emailHasData
    ? Object.entries(emailCats)
        .filter(([, c]) => c > 0)
        .map(([category, count]) => ({ category, count }))
    : PLACEHOLDER_EMAIL;

  const hasAnyMetrics =
    brandChartHasData || trendHasData || emailHasData || signedUp > 0;

  return (
    <section className="flex flex-col gap-8">
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] p-4 transition-all duration-500 sm:flex-row sm:items-center sm:justify-between",
          // Nothing captured yet: glow + sweep so Start is unmissable. Once
          // running, the sticky live bar above the tabs takes over.
          !busy && signedUp === 0 && "rs-start-card",
          busy && "border-[var(--rs-accent)]/30"
        )}
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--rs-fg)]">
            {busy ? <span className="rs-live-dot" aria-hidden /> : null}
            {busy
              ? "Capture running"
              : signedUp === 0
                ? "Start capture"
                : remaining > 0
                  ? "Continue capture"
                  : "Capture complete"}
          </p>
          <p className="mt-0.5 text-xs text-[var(--rs-muted)]">
            {inboxLabel}
            {" · "}
            {signedUp}/{project.brands.length} signed up
            {busy && trail.length > 0
              ? ` · ${trail[trail.length - 1]}`
              : null}
          </p>
          {(runError || (!busy && (batchProgress || depositBatchProgress))) && (
            <p
              className={`mt-1.5 text-xs ${runError ? "text-red-300" : "text-[var(--rs-muted)]"}`}
            >
              {runError || batchProgress || depositBatchProgress}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onStartFresh}
            className={cn(
              "cursor-pointer rounded-lg bg-[var(--rs-accent)] px-4 py-2.5 text-sm font-medium text-[var(--rs-bg)] disabled:opacity-50",
              !busy && signedUp === 0 && "rs-start-button"
            )}
          >
            {batchRunning
              ? "Capturing…"
              : signedUp === 0
                ? "Start"
                : "Start fresh"}
          </button>
          {remaining > 0 && signedUp > 0 && !batchRunning ? (
            <button
              type="button"
              disabled={busy}
              onClick={onRetryRemaining}
              className="cursor-pointer rounded-lg border border-[var(--rs-border)] px-3.5 py-2.5 text-sm text-[var(--rs-fg)] disabled:opacity-50"
            >
              Retry remaining ({remaining})
            </button>
          ) : null}
          {signedUp > 0 ? (
            <button
              type="button"
              disabled={busy || batchRunning}
              onClick={onDeposit}
              className="cursor-pointer rounded-lg border border-[var(--rs-border)] px-3.5 py-2.5 text-sm text-[var(--rs-fg)] disabled:opacity-40"
            >
              {depositBatchRunning ? "Opening cashiers…" : "Deposit"}
            </button>
          ) : null}
          {liveViewUrl ? (
            <a
              href={liveViewUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[var(--rs-accent)]"
            >
              Watch live
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Scorecard
          label="Signed up"
          value={`${signedUp}/${project.brands.length}`}
          hint={inboxLabel}
          empty={signedUp === 0}
        />
        <Scorecard
          label="Avg time to stake"
          value={avgStake != null ? formatSec(avgStake) : "—"}
          hint={
            avgStake != null
              ? `Across ${stakeValues.length} completed run${stakeValues.length === 1 ? "" : "s"}`
              : "Appears after a funded first bet"
          }
          empty={avgStake == null}
        />
        <Scorecard
          label="Inbox"
          value={String(project.emails.length)}
          hint="Messages for this project's aliases"
          empty={project.emails.length === 0}
        />
        <Scorecard
          label="Friction notes"
          value={String(frictionCount)}
          hint="Top issues from completed journeys"
          empty={frictionCount === 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel
          title="Time to stake by brand"
          subtitle="Minutes from deposit to first casino bet (latest run)"
          empty={!brandChartHasData}
          emptyHint="Run a capture to unlock brand comparisons"
        >
          <ChartContainer config={brandConfig} className="h-52 w-full">
            <BarChart data={brandChartData} margin={{ left: 0, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={28}
                tickFormatter={(v) => `${v}`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="minutes"
                fill="var(--color-minutes)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </ChartPanel>

        <ChartPanel
          title="Trend over time"
          subtitle="Own brand vs best competitor (minutes)"
          empty={!trendHasData}
          emptyHint="Trends fill in as you keep completed runs over days"
        >
          <ChartContainer config={trendConfig} className="h-52 w-full">
            <LineChart data={trendData} margin={{ left: 0, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="own"
                stroke="var(--color-own)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="best"
                stroke="var(--color-best)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </ChartPanel>

        <ChartPanel
          title="Voice of inbox"
          subtitle="Email mix by category"
          empty={!emailHasData}
          emptyHint="Inbox fills after signup for this project's aliases"
        >
          <ChartContainer config={emailConfig} className="h-52 w-full">
            <BarChart data={emailData} margin={{ left: 0, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="category" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={28}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </ChartPanel>

        <div className="rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] p-4">
          <h3 className="text-sm font-medium text-[var(--rs-fg)]">How it runs</h3>
          <ol className="mt-3 list-decimal space-y-2 ps-4 text-xs leading-relaxed text-[var(--rs-muted)]">
            <li>Start signs up each brand with a fresh inbox alias.</li>
            <li>
              Deposit only opens a pay request after a Bitcoin address is
              scraped from the page — failed address capture never asks for money.
            </li>
            <li>Metrics and charts update as journeys complete.</li>
          </ol>
          {!hasAnyMetrics ? (
            <p className="mt-3 text-[11px] text-[var(--rs-muted)]">
              Charts stay greyed until the first completed runs land.
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-[var(--rs-fg)]">Brands</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {project.brands.map((brand) => {
            const card = brandOverviewCard(
              project,
              brand,
              batchRunning,
              batchProgress
            );
            const styles = TONE[card.tone];
            return (
              <button
                key={brand.id}
                type="button"
                onClick={() => onOpenBrand(brand.id)}
                className="flex cursor-pointer flex-col gap-2 rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] p-4 text-left transition-colors hover:border-[var(--rs-accent)]/50"
              >
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      brand.favicon ||
                      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
                        brand.url
                      )}&sz=64`
                    }
                    alt=""
                    className="size-9 shrink-0 rounded-lg border border-[var(--rs-border)] bg-[var(--rs-bg)] object-contain p-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-[var(--rs-fg)]">
                        {brand.name}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles.badge}`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${styles.dot}`}
                        />
                        {card.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-snug text-[var(--rs-muted)]">
                      {card.summary}
                    </p>
                    {brand.accountEmail ? (
                      <p className="mt-1 truncate text-[11px] text-[var(--rs-muted)]">
                        {brand.accountEmail}
                      </p>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
