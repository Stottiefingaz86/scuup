"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimelinePoint, TopicGroupScore, TopicRow } from "@/lib/grace/analysis";
import { TP_STAR, TpStars } from "./tp-stars";

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#e7e9ec] bg-white px-3 py-2 text-xs text-[#191919] shadow-md">
      {children}
    </div>
  );
}

export function TopicBars({
  rows,
  mode,
  limit = 8,
  onPick,
}: {
  rows: TopicRow[];
  mode: "positive" | "negative";
  limit?: number;
  onPick?: (topic: string, value: number) => void;
}) {
  const data = rows
    .map((r) => ({ topic: r.topic, value: mode === "positive" ? r.positive : r.negative, total: r.total }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
  const max = data[0]?.value ?? 1;
  const color = mode === "positive" ? "#00b67a" : "#ff3722";
  if (data.length === 0) {
    return <p className="py-6 text-[13px] text-[#8a9198]">No {mode} mentions in this selection.</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((r) => (
        <button
          key={r.topic}
          type="button"
          className="tp-bar-row cursor-pointer rounded-md text-left hover:bg-[#f7f8f9]"
          onClick={() => onPick?.(r.topic, r.value)}
        >
          <span className="truncate text-[13px] text-[#191919]">{r.topic}</span>
          <div className="tp-bar-track">
            <div className="tp-bar-fill" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
          <span
            className={`text-right text-[12px] tabular-nums underline-offset-2 hover:underline ${
              mode === "positive" ? "text-[#00b67a]" : "text-[#ff3722]"
            }`}
          >
            {r.value}
          </span>
        </button>
      ))}
    </div>
  );
}

export function SentimentSlider({ value }: { value: number }) {
  const clamped = Math.max(-100, Math.min(100, value));
  const left = ((clamped + 100) / 200) * 100;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-[#191919]">Sentiment score</span>
        <span className="text-[20px] font-semibold tabular-nums text-[#191919]">
          {clamped > 0 ? `+${clamped}` : clamped}
        </span>
      </div>
      <div className="tp-meter">
        <span className="tp-meter-knob" style={{ left: `${left}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-[#8a9198]">
        <span>Negative</span>
        <span>Neutral</span>
        <span>Positive</span>
      </div>
    </div>
  );
}

export function ReviewsMeter({ count, max }: { count: number; max: number }) {
  const pct = max ? Math.min(100, (count / max) * 100) : 0;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-[#191919]">Reviews</span>
        <span className="text-[20px] font-semibold tabular-nums text-[#191919]">{count.toLocaleString()}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#f1f3f5]">
        <div className="h-full rounded-full bg-[#00b67a]" style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
    </div>
  );
}

const TICK = { fill: "#8a9198", fontSize: 11 };
const SENT_TICKS = [-100, 0, 100];

function sentLabel(v: number) {
  if (v === 0) return "0";
  return v > 0 ? `+${v}` : `${v}`;
}

export function TimelineChart({ points }: { points: TimelinePoint[] }) {
  if (points.every((p) => p.count === 0)) {
    return <p className="py-10 text-center text-[13px] text-[#8a9198]">No reviews in this period.</p>;
  }
  const data = points.map((p) => ({ ...p, sent: p.count ? p.sentiment : null }));
  const few = data.length <= 6;
  return (
    <div className="gr-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 2, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#eef0f2" />
          <XAxis
            dataKey="label"
            tick={TICK}
            tickLine={false}
            axisLine={false}
            interval={few ? 0 : "preserveStartEnd"}
            minTickGap={28}
            tickMargin={10}
            padding={{ left: 16, right: 16 }}
            height={28}
          />
          <YAxis
            yAxisId="count"
            allowDecimals={false}
            domain={[0, (max: number) => Math.max(4, max)]}
            width={0}
            tick={false}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="sent"
            domain={[-100, 100]}
            ticks={SENT_TICKS}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={sentLabel}
            width={40}
            tickMargin={8}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as TimelinePoint;
              return (
                <Tip>
                  <div className="font-semibold">{d.label}</div>
                  <div className="mt-1 text-[#6c737a]">
                    {d.count} reviews · sentiment {d.count ? sentLabel(d.sentiment) : "—"}
                  </div>
                </Tip>
              );
            }}
          />
          <Bar yAxisId="count" dataKey="count" fill="#e4e7eb" maxBarSize={28} radius={[4, 4, 0, 0]} />
          <ReferenceLine yAxisId="sent" y={0} stroke="#e7e9ec" />
          <Line
            yAxisId="sent"
            type="monotone"
            dataKey="sent"
            stroke="#191919"
            strokeWidth={2}
            dot={{ r: 3.5, fill: "#191919", strokeWidth: 0 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center gap-4 text-[11px] text-[#8a9198]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2.5 rounded-[2px] bg-[#e4e7eb]" />
          Reviews
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-px w-3 bg-[#191919]" />
          Sentiment
        </span>
      </div>
    </div>
  );
}

export function StarDistribution({
  stars,
  total,
  onPick,
}: {
  stars: Record<1 | 2 | 3 | 4 | 5, number>;
  total: number;
  onPick?: (star: 1 | 2 | 3 | 4 | 5, count: number) => void;
}) {
  const order: (1 | 2 | 3 | 4 | 5)[] = [5, 4, 3, 2, 1];
  return (
    <div className="flex flex-col gap-2">
      {order.map((s) => {
        const n = stars[s];
        const pct = total ? (n / total) * 100 : 0;
        return (
          <button
            key={s}
            type="button"
            disabled={!n || !onPick}
            onClick={() => onPick?.(s, n)}
            className="grid grid-cols-[72px_1fr_40px] items-center gap-3 rounded-md text-left disabled:cursor-default enabled:cursor-pointer enabled:hover:bg-[#f7f8f9]"
          >
            <TpStars rating={s} size={12} />
            <div className="h-2 overflow-hidden rounded-full bg-[#f1f3f5]">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: TP_STAR[s] }} />
            </div>
            <span className={`text-right text-[12px] tabular-nums ${n && onPick ? "text-[#00b67a]" : "text-[#6c737a]"}`}>
              {n}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function MiniStarBar({
  stars,
  total,
}: {
  stars: Record<1 | 2 | 3 | 4 | 5, number>;
  total: number;
}) {
  if (!total) return <span className="text-[#8a9198]">—</span>;
  const segs: { n: number; c: string }[] = [
    { n: stars[5], c: TP_STAR[5] },
    { n: stars[4], c: TP_STAR[4] },
    { n: stars[3], c: TP_STAR[3] },
    { n: stars[2], c: TP_STAR[2] },
    { n: stars[1], c: TP_STAR[1] },
  ];
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#f1f3f5]">
      {segs.map((s, i) =>
        s.n ? <span key={i} style={{ width: `${(s.n / total) * 100}%`, background: s.c }} /> : null,
      )}
    </div>
  );
}

export interface SliderBrand {
  id: string;
  name: string;
  color: string;
  self: boolean;
  scores: TopicGroupScore[];
}

export function CompetitorSliders({
  brands,
  compact = false,
}: {
  brands: SliderBrand[];
  compact?: boolean;
}) {
  if (brands.length === 0) return null;
  const topics = brands[0].scores.map((s) => ({ id: s.id, label: s.label }));
  return (
    <div className={`grid sm:grid-cols-2 ${compact ? "gap-x-8 gap-y-5" : "gap-x-10 gap-y-8"}`}>
      {topics.map((t) => {
        const points = brands
          .map((b) => ({ brand: b, score: b.scores.find((s) => s.id === t.id) }))
          .filter((p) => p.score && p.score.count > 0);
        const max = Math.max(1, ...points.map((p) => p.score!.count));
        return (
          <div key={t.id}>
            <div className={`font-semibold text-[#191919] ${compact ? "mb-2 text-[12px]" : "mb-3 text-[14px]"}`}>
              {t.label}
            </div>
            <div className={compact ? "relative mx-2 h-6" : "relative mx-3 h-8"}>
              <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#eceef1]" />
              <div className="absolute left-1/2 top-1/2 h-3 w-px -translate-y-1/2 bg-[#d5d8dc]" />
              {points.map(({ brand, score }) => {
                const x = ((score!.sentiment + 100) / 200) * 100;
                const r = compact ? 8 + (score!.count / max) * 4 : 8 + (score!.count / max) * 6;
                return (
                  <div
                    key={brand.id}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${x}%` }}
                    title={`${brand.name}: ${sentLabel(score!.sentiment)}`}
                  >
                    <span
                      className="block rounded-full border-2 border-white"
                      style={{
                        width: r,
                        height: r,
                        background: brand.color,
                        boxShadow: brand.self ? `0 0 0 2px ${brand.color}` : "0 0 0 1px rgba(0,0,0,0.06)",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className={`mt-1 flex justify-between text-[11px] text-[#8a9198] ${compact ? "mx-2" : "mx-3"}`}>
              <span>Negative</span>
              <span>Neutral</span>
              <span>Positive</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface SeriesBrand {
  id: string;
  name: string;
  color: string;
  self: boolean;
  points: TimelinePoint[];
}

export function CompetitorLines({ brands }: { brands: SeriesBrand[] }) {
  if (brands.length === 0) return null;
  const keys = new Map<string, string>();
  for (const b of brands) for (const p of b.points) keys.set(p.key, p.label);
  const rows = [...keys.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, label]) => {
      const row: Record<string, string | number | null> = { key, label };
      for (const b of brands) {
        const p = b.points.find((x) => x.key === key);
        row[b.id] = p && p.count ? p.sentiment : null;
      }
      return row;
    })
    .filter((row) => brands.some((b) => row[b.id] != null));
  if (rows.length === 0) {
    return <p className="py-10 text-center text-[13px] text-[#8a9198]">No sentiment movement in this month.</p>;
  }
  const few = rows.length <= 6;
  return (
    <div className="gr-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 2, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#eef0f2" />
          <XAxis
            dataKey="label"
            tick={TICK}
            tickLine={false}
            axisLine={false}
            interval={few ? 0 : "preserveStartEnd"}
            minTickGap={28}
            tickMargin={10}
            padding={{ left: 16, right: 16 }}
            height={28}
          />
          <YAxis
            domain={[-100, 100]}
            ticks={SENT_TICKS}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={sentLabel}
            width={40}
            tickMargin={8}
          />
          <ReferenceLine y={0} stroke="#e7e9ec" />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <Tip>
                  <div className="font-semibold">{label}</div>
                  {payload.map((p) => (
                    <div key={String(p.dataKey)} className="mt-0.5 flex justify-between gap-6 text-[#6c737a]">
                      <span>{p.name}</span>
                      <span className="tabular-nums text-[#191919]">
                        {p.value == null ? "—" : sentLabel(Number(p.value))}
                      </span>
                    </div>
                  ))}
                </Tip>
              );
            }}
          />
          {brands.map((b) => (
            <Line
              key={b.id}
              type="monotone"
              dataKey={b.id}
              name={b.name}
              stroke={b.color}
              strokeWidth={b.self ? 2.4 : 1.6}
              dot={{ r: b.self ? 4 : 3, strokeWidth: 0, fill: b.color }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KeywordMentionBars({
  rows,
  limit = 10,
  onPick,
}: {
  rows: TopicRow[];
  limit?: number;
  onPick?: (topic: string, count: number) => void;
}) {
  const data = rows.slice(0, limit);
  if (data.length === 0) return <p className="py-6 text-[13px] text-[#8a9198]">No keyword mentions.</p>;
  const max = data[0]?.total ?? 1;
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((r) => (
        <button
          key={r.topic}
          type="button"
          className="tp-bar-row cursor-pointer rounded-md text-left hover:bg-[#f7f8f9]"
          onClick={() => onPick?.(r.topic, r.total)}
        >
          <span className="truncate text-[13px] text-[#191919]">{r.topic}</span>
          <div className="tp-bar-track">
            <div
              className="tp-bar-fill"
              style={{
                width: `${(r.total / max) * 100}%`,
                background: r.sentiment >= 20 ? "#00b67a" : r.sentiment <= -20 ? "#ff3722" : "#ffce00",
              }}
            />
          </div>
          <span className="text-right text-[12px] tabular-nums text-[#00b67a]">{r.total}</span>
        </button>
      ))}
    </div>
  );
}
