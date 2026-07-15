"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { landingDemoProject } from "@/lib/landing-demo-project";
import { tierTextClass } from "@/lib/score";
import { overallScore, scorePillars } from "@/lib/types";

const YOU_COLOR = "#3ecf8e";

const VIEWERS = [
  { label: "CEO", color: "#8B5CF6" },
  { label: "Designer", color: "#F472B6" },
  { label: "CPO", color: "#FB923C" },
  { label: "Product Manager", color: "#38BDF8" },
  { label: "YOU", color: YOU_COLOR, highlight: true },
] as const;

const TEAM_CURSORS = [
  { label: "CEO", color: "#8B5CF6", startDelay: 0 },
  { label: "Designer", color: "#F472B6", startDelay: 2200 },
  { label: "CPO", color: "#FB923C", startDelay: 4100 },
  { label: "Product Manager", color: "#38BDF8", startDelay: 6800 },
] as const;

type CursorPoint = { x: number; y: number };

/** Where each role tends to read — small hops, not random ants. */
const HOTSPOTS: Record<(typeof TEAM_CURSORS)[number]["label"], CursorPoint[]> = {
  CEO: [
    { x: 16, y: 36 },
    { x: 24, y: 38 },
    { x: 70, y: 33 },
  ],
  Designer: [
    { x: 79, y: 31 },
    { x: 76, y: 39 },
    { x: 82, y: 35 },
  ],
  CPO: [
    { x: 48, y: 58 },
    { x: 62, y: 62 },
    { x: 55, y: 70 },
  ],
  "Product Manager": [
    { x: 18, y: 64 },
    { x: 26, y: 70 },
    { x: 20, y: 76 },
  ],
};

function useBotPath(
  label: (typeof TEAM_CURSORS)[number]["label"],
  startDelay: number,
  enabled: boolean
): CursorPoint {
  const spots = HOTSPOTS[label];
  const [pos, setPos] = useState<CursorPoint>(spots[0]);
  const idxRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    let dwellTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleNext = () => {
      // ~2.8s glide + 6–10s reading pause before the next hop
      const dwellMs = 2800 + 6000 + Math.random() * 4000;
      dwellTimer = setTimeout(() => {
        idxRef.current = (idxRef.current + 1) % spots.length;
        setPos(spots[idxRef.current]);
        scheduleNext();
      }, dwellMs);
    };

    const startTimer = setTimeout(scheduleNext, startDelay);
    return () => {
      clearTimeout(startTimer);
      if (dwellTimer) clearTimeout(dwellTimer);
    };
  }, [enabled, label, spots, startDelay]);

  return pos;
}

function FigmaCursor({
  label,
  color,
  x,
  y,
  smooth = false,
  className,
}: {
  label: string;
  color: string;
  x: number;
  y: number;
  smooth?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-30 hidden items-start sm:flex",
        smooth &&
          "transition-[left,top] duration-[2800ms] ease-[cubic-bezier(0.45,0.05,0.25,1)]",
        className
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-hidden
    >
      <svg
        width="16"
        height="18"
        viewBox="0 0 16 18"
        fill="none"
        className="drop-shadow-md"
      >
        <path
          d="M1.2 1.2V14.8L5.1 11.2L7.8 16.2L9.5 15.4L6.7 10.1L12.1 9.6L1.2 1.2Z"
          fill={color}
          stroke="white"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="ms-3 -mt-0.5 inline-block max-w-[9rem] truncate rounded-md px-2 py-0.5 text-[11px] font-semibold leading-tight text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
        style={{ backgroundColor: color }}
      >
        {label}
      </span>
    </div>
  );
}

function ReportPreview() {
  const project = landingDemoProject();
  const ownBrand = project.brands.find((b) => b.role === "own_brand")!;
  const ownScore = overallScore(ownBrand);
  const ranked = project.brands
    .map((b) => ({ brand: b, score: overallScore(b) }))
    .filter((r): r is { brand: typeof ownBrand; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score);
  const leader = ranked[0];

  return (
    <div className="relative bg-background p-5 sm:p-7 lg:p-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-brand/[0.06] to-transparent" />

      <div className="relative flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div className="flex flex-col gap-2">
            <Badge variant="outline" className="w-fit gap-1.5 font-normal">
              <Sparkles className="size-3" />
              Competitor CX report · July 2026
            </Badge>
            <h3 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
              {project.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {project.brands.length} brands · 100% data coverage · shared link
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-card/60 px-3 py-2 text-xs text-muted-foreground">
            <FileText className="size-3.5 shrink-0" />
            Section 01 · Executive summary
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="rounded-xl border bg-card/50 p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-brand">
              Executive read
            </p>
            <p className="mt-3 font-heading text-lg font-medium leading-snug sm:text-xl">
              {leader ? (
                <>
                  <span className="text-brand">{leader.brand.name}</span> leads the
                  set at {leader.score}
                  {ownScore !== null && leader.brand.id !== ownBrand.id
                    ? ` — you're ${leader.score - ownScore} points behind on player experience.`
                    : "."}
                </>
              ) : null}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {ownBrand.analyses.landing?.summary ??
                "Winna's Bonus Center and crypto loop read well for retention-minded players, but sports depth and first-impression polish still trail Stake in this set."}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border bg-card/50 px-4 py-5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Your Player CX Score
            </span>
            <span
              className={cn(
                "mt-1 font-heading text-5xl font-semibold tabular-nums",
                ownScore !== null ? tierTextClass(ownScore) : "text-muted-foreground"
              )}
            >
              {ownScore ?? "—"}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">out of 100</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border">
          <div className="border-b bg-muted/20 px-4 py-2.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Section 02 · Competitor ranking
            </p>
          </div>
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Brand</th>
                  <th className="px-4 py-2.5 text-center font-medium">Journeys</th>
                  <th className="px-4 py-2.5 text-center font-medium">Retention</th>
                  <th className="px-4 py-2.5 text-right font-medium">Overall</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(({ brand, score }, i) => {
                  const pillars = Object.fromEntries(
                    scorePillars(brand).map((p) => [p.key, p.score])
                  );
                  return (
                    <tr
                      key={brand.id}
                      className={cn(
                        "border-b border-border/60 last:border-0",
                        brand.role === "own_brand" && "bg-brand/[0.05]"
                      )}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium">{brand.name}</span>
                        {brand.role === "own_brand" ? (
                          <span className="ms-2 text-xs text-brand">(you)</span>
                        ) : (
                          <span className="ms-2 text-xs text-muted-foreground">
                            #{i + 1}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                        {pillars.journeys ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                        {pillars.retention ?? "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right font-heading font-semibold tabular-nums",
                          tierTextClass(score)
                        )}
                      >
                        {score}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function BotCursorView({
  label,
  color,
  startDelay,
  enabled,
}: {
  label: (typeof TEAM_CURSORS)[number]["label"];
  color: string;
  startDelay: number;
  enabled: boolean;
}) {
  const pos = useBotPath(label, startDelay, enabled);
  return (
    <FigmaCursor
      label={label}
      color={color}
      x={pos.x}
      y={pos.y}
      smooth
    />
  );
}

function ReportMultiplayerLayer() {
  const arenaRef = useRef<HTMLDivElement>(null);
  const youPendingRef = useRef<CursorPoint | null>(null);
  const youFrameRef = useRef<number | null>(null);
  const [you, setYou] = useState<CursorPoint | null>(null);
  const [inside, setInside] = useState(false);
  const [motionOk, setMotionOk] = useState(true);

  useEffect(() => {
    setMotionOk(
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
    return () => {
      if (youFrameRef.current !== null) {
        cancelAnimationFrame(youFrameRef.current);
      }
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = arenaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = {
      x: Math.max(2, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(8, Math.min(94, ((e.clientY - rect.top) / rect.height) * 100)),
    };
    youPendingRef.current = next;
    if (youFrameRef.current !== null) return;
    youFrameRef.current = requestAnimationFrame(() => {
      youFrameRef.current = null;
      if (youPendingRef.current) setYou(youPendingRef.current);
    });
  }, []);

  return (
    <div
      ref={arenaRef}
      className={cn(
        "relative min-h-[420px] sm:min-h-[460px]",
        inside && "cursor-none"
      )}
      onPointerEnter={() => setInside(true)}
      onPointerLeave={() => {
        setInside(false);
        setYou(null);
      }}
      onPointerMove={onPointerMove}
    >
      <ReportPreview />

      {motionOk
        ? TEAM_CURSORS.map((bot) => (
            <BotCursorView
              key={bot.label}
              label={bot.label}
              color={bot.color}
              startDelay={bot.startDelay}
              enabled={motionOk}
            />
          ))
        : null}

      {inside && you ? (
        <FigmaCursor label="YOU" color={YOU_COLOR} x={you.x} y={you.y} />
      ) : null}

      <p className="pointer-events-none absolute inset-x-0 bottom-3 hidden text-center text-[11px] text-muted-foreground/70 sm:block">
        {inside
          ? "You're viewing live with the team"
          : "Hover the report — your cursor joins the review"}
      </p>
    </div>
  );
}

export function SharedReportReview() {
  return (
    <section
      id="shared-report"
      className="border-y border-border bg-card/30 py-20 sm:py-28"
    >
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brand">
            Shared deliverable
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            One report the whole team reviews together
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Export a board-ready PDF or share a live link — leadership, product,
            and design read the same evidence-backed scorecard, not five
            different decks.
          </p>
        </div>

        <div className="relative mx-auto mt-14 max-w-5xl">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_24px_80px_-32px_rgba(0,0,0,0.65)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/15 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">5 people</span>{" "}
                  reviewing this report
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {VIEWERS.map((viewer) => (
                  <span
                    key={viewer.label}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                      "highlight" in viewer && viewer.highlight
                        ? "border-brand/40 bg-brand/10 text-brand"
                        : "border-border bg-background/60 text-foreground/90"
                    )}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: viewer.color }}
                    />
                    {viewer.label}
                  </span>
                ))}
              </div>
            </div>

            <ReportMultiplayerLayer />

            <div className="flex flex-wrap gap-2 border-t border-border bg-muted/10 px-4 py-3 sm:hidden">
              {VIEWERS.map((viewer) => (
                <span
                  key={viewer.label}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-white"
                  style={{ backgroundColor: viewer.color }}
                >
                  {viewer.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
