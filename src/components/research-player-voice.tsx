"use client";

import { useState } from "react";
import { MessageSquare, MessageSquareQuote, Star, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { latestRunForBrand } from "@/lib/research/feature-benchmark";
import { matchThemeReviews } from "@/lib/research/player-voice";
import type {
  JourneyRun,
  PlayerVoice,
  PlayerVoiceKind,
  PlayerVoiceReview,
  PlayerVoiceTheme,
  ResearchBrand,
  ResearchProject,
} from "@/lib/research/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Journey context the synthesis is cross-checked against              */
/* ------------------------------------------------------------------ */

function fmtSec(v: number | null | undefined): string {
  if (v == null) return "n/a";
  if (v < 60) return `${Math.round(v)}s`;
  const m = Math.floor(v / 60);
  const s = Math.round(v % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

/** Plain-text summary of what the agent measured for a brand, for the LLM. */
export function journeyContextForBrand(
  runs: JourneyRun[],
  brandId: string,
): string {
  const run = latestRunForBrand(runs, brandId);
  if (!run) return "";
  const lines: string[] = [];
  for (const s of run.stages) {
    if (!s.endedAt) continue;
    const bits = [
      s.steps != null ? `${s.steps} steps` : null,
      s.timeSec != null ? fmtSec(s.timeSec) : null,
      s.fieldCount != null ? `${s.fieldCount} fields` : null,
    ].filter(Boolean);
    lines.push(
      `- ${s.label}: ${bits.join(", ") || "done"}${s.evidence ? `; saw: ${s.evidence}` : ""}${s.friction ? `; friction: ${s.friction}` : ""}`,
    );
  }
  for (const f of run.topFriction ?? []) {
    lines.push(`- Top friction #${f.rank}: ${f.friction} (${f.evidence})`);
  }
  if (run.postDeposit) {
    lines.push(
      `- After deposit landed on: ${run.postDeposit.landedOn}; confirmed via ${run.postDeposit.confirmedVia ?? "not confirmed"}`,
    );
  }
  if (run.features) {
    lines.push(
      `- Features seen on site: ${run.features.features.map((f) => f.name).join(", ") || "none"}`,
    );
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

const KIND_META: Record<
  PlayerVoiceKind,
  { label: string; plural: string; dot: string }
> = {
  complaint: {
    label: "Complaint",
    plural: "Complaints",
    dot: "bg-[var(--rs-critical)]",
  },
  stuck: { label: "Stuck", plural: "Stuck on", dot: "bg-[var(--rs-high)]" },
  ask: { label: "Ask", plural: "Asks", dot: "bg-[var(--rs-medium)]" },
  praise: { label: "Praise", plural: "Praise", dot: "bg-[var(--rs-accent)]" },
};
const KIND_ORDER: PlayerVoiceKind[] = ["complaint", "stuck", "ask", "praise"];

function pct(n: number, total: number): string {
  if (!total) return "—";
  return `${Math.round((n / total) * 100)}%`;
}

function splitVoiceLead(text: string): { lead: string; rest: string } {
  const t = text.trim();
  const m = t.match(/^(.+?[.!?])(?:\s+|$)([\s\S]*)$/);
  if (!m?.[2]?.trim()) return { lead: t, rest: "" };
  return { lead: m[1], rest: m[2].trim() };
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.round(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** Truncated cell text that unfolds to the full message while hovered. The
 * table wrapper clips overflow, so a floating tooltip would be cut off; the
 * row growing in place never is. */
function Truncate({ text }: { text: string }) {
  return (
    <span
      className="block min-w-0 cursor-default truncate hover:whitespace-normal"
      title={text}
    >
      {text}
    </span>
  );
}

function BrandFavicon({ brand }: { brand: ResearchBrand }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={
        brand.favicon ||
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(brand.url)}&sz=64`
      }
      alt=""
      className="size-5 rounded"
    />
  );
}

function MonthlyBars({ voice }: { voice: PlayerVoice }) {
  const max = Math.max(1, ...voice.monthly.map((m) => m.count));
  return (
    <div className="flex items-end gap-1" aria-label="Reviews per month">
      {voice.monthly.map((m) => {
        const h = Math.round((m.count / max) * 36);
        const negH = m.count ? Math.round((m.negative / m.count) * h) : 0;
        const label = new Date(`${m.month}-01T00:00:00Z`).toLocaleDateString(
          undefined,
          { month: "short", timeZone: "UTC" },
        );
        return (
          <div
            key={m.month}
            className="flex w-6 flex-col items-center gap-1"
            title={`${label}: ${m.count} reviews · ${m.negative} negative · avg ${m.avgRating ?? "n/a"}★`}
          >
            <div className="flex h-9 w-full flex-col justify-end overflow-hidden rounded-[3px] bg-[var(--rs-bg)]">
              <div
                className="w-full bg-[var(--rs-muted)]/60"
                style={{ height: Math.max(m.count ? 2 : 0, h - negH) }}
              />
              <div
                className="w-full bg-[var(--rs-critical)]"
                style={{ height: negH }}
              />
            </div>
            <span className="text-[9px] leading-none text-[var(--rs-muted)]">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Journey categories                                                  */
/* ------------------------------------------------------------------ */

const JOURNEY_AREAS = [
  "Signup & verification",
  "Login & account",
  "Deposit",
  "Withdrawal & payouts",
  "Casino",
  "Sports",
  "Bonuses & rewards",
  "Support",
  "Community",
  "Platform",
  "Other",
] as const;
type JourneyArea = (typeof JOURNEY_AREAS)[number];

/** Which part of the player journey a theme belongs to — stage first, the
 * vertical as fallback. */
function journeyArea(t: PlayerVoiceTheme): JourneyArea {
  switch (t.stage) {
    case "landing":
    case "registration":
    case "verification":
      return "Signup & verification";
    case "login":
      return "Login & account";
    case "deposit":
    case "deposit_confirmation":
      return "Deposit";
    case "withdrawal":
      return "Withdrawal & payouts";
    case "casino_discovery":
    case "game_launch":
      return t.vertical === "Sports" ? "Sports" : "Casino";
    case "first_bet":
      return t.vertical === "Casino" ? "Casino" : "Sports";
    case "retention":
      return "Bonuses & rewards";
  }
  switch (t.vertical) {
    case "Account & KYC":
      return "Signup & verification";
    case "Payments":
      return "Withdrawal & payouts";
    case "Casino":
      return "Casino";
    case "Sports":
      return "Sports";
    case "Bonuses & rewards":
      return "Bonuses & rewards";
    case "Support":
      return "Support";
    case "Community":
      return "Community";
    case "Platform":
      return "Platform";
    default:
      return "Other";
  }
}

/** Themes grouped by journey area, areas in journey order, themes by weight. */
function groupByArea(
  themes: PlayerVoiceTheme[],
): { area: JourneyArea; themes: PlayerVoiceTheme[] }[] {
  const map = new Map<JourneyArea, PlayerVoiceTheme[]>();
  for (const t of themes) {
    const a = journeyArea(t);
    const list = map.get(a) ?? [];
    list.push(t);
    map.set(a, list);
  }
  return JOURNEY_AREAS.filter((a) => map.has(a)).map((a) => ({
    area: a,
    themes: map
      .get(a)!
      .slice()
      .sort((x, y) => y.mentions - x.mentions),
  }));
}

/* ------------------------------------------------------------------ */
/* Mentions → the real reviews behind a theme                          */
/* ------------------------------------------------------------------ */

function evidenceForTheme(
  theme: PlayerVoiceTheme,
  voice: PlayerVoice,
): { reviews: PlayerVoiceReview[]; claimed: number; partial: boolean } {
  const claimed = theme.mentions;

  // Prefer reviews copied onto the theme at analysis time — survives even
  // when the top-level corpus was dropped to fit localStorage.
  if (theme.evidence?.length) {
    return {
      reviews: [...theme.evidence].sort((a, b) => b.date.localeCompare(a.date)),
      claimed: Math.max(claimed, theme.evidence.length),
      partial: false,
    };
  }

  const all = voice.reviews ?? [];
  if (all.length) {
    const ids = matchThemeReviews(theme, all);
    const reviews = (ids.length ? ids : (theme.reviewIds ?? []))
      .map((i) => all[i])
      .filter((r): r is PlayerVoiceReview => Boolean(r))
      .sort((a, b) => b.date.localeCompare(a.date));
    if (reviews.length) {
      return {
        reviews,
        claimed: Math.max(claimed, reviews.length),
        partial: false,
      };
    }
  }

  // Older reads only stored 1–2 analyst quotes — do not show those as
  // reviews. The player has to refresh to load the real Trustpilot corpus.
  return {
    reviews: [],
    claimed,
    partial: claimed > 0,
  };
}

function MentionsButton({
  theme,
  voice,
  onClick,
}: {
  theme: PlayerVoiceTheme;
  voice: PlayerVoice;
  onClick: () => void;
}) {
  const { reviews, claimed, partial } = evidenceForTheme(theme, voice);
  const n = partial ? claimed : reviews.length;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        partial
          ? `${n} mentions — load Trustpilot reviews`
          : `Open ${n} Trustpilot review${n === 1 ? "" : "s"}`
      }
      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--rs-border)] bg-[var(--rs-bg)] px-2.5 text-sm font-medium tabular-nums text-[var(--rs-fg)] underline-offset-2 transition-colors hover:border-[var(--rs-accent)] hover:bg-[var(--rs-accent)]/10 hover:underline"
    >
      <MessageSquare className="size-3.5 opacity-70" />
      {n}
    </button>
  );
}

/** Trustpilot green star tiles — the familiar #00b67a squares. */
function TrustStars({ n, size = 20 }: { n: number; size?: number }) {
  const star = Math.round(size * 0.55);
  return (
    <span
      className="inline-flex items-center gap-[2px]"
      aria-label={`${n} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn(
            "inline-flex items-center justify-center rounded-[3px]",
            i <= n ? "bg-[#00b67a]" : "bg-[#dcdce6]",
          )}
          style={{ width: size, height: size }}
        >
          <Star
            className="fill-white text-white"
            style={{ width: star, height: star }}
            strokeWidth={0}
          />
        </span>
      ))}
    </span>
  );
}

function formatReviewDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Evidence popup: real Trustpilot reviews only. */
function EvidenceDialog({
  theme,
  voice,
  onClose,
  onRefresh,
}: {
  theme: PlayerVoiceTheme | null;
  voice: PlayerVoice;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const { reviews, claimed } = theme
    ? evidenceForTheme(theme, voice)
    : { reviews: [] as PlayerVoiceReview[], claimed: 0 };

  return (
    <Dialog open={theme != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] w-[min(560px,calc(100vw-20px))] max-w-none gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 text-[#1a1a1a] shadow-2xl"
      >
        {theme ? (
          <>
            <header className="relative border-b border-[#e5e7eb] px-6 pb-5 pt-6">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 rounded-full p-2 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111]"
              >
                <X className="size-4" />
              </button>
              <p className="pr-10 text-[13px] font-medium text-[#6b7280]">
                {KIND_META[theme.kind].label}
                <span className="mx-1.5 text-[#d1d5db]">·</span>
                {theme.vertical}
              </p>
              <DialogTitle className="mt-1.5 pr-8 text-[22px] font-semibold leading-snug tracking-tight text-[#111]">
                {theme.theme}
              </DialogTitle>
              <DialogDescription className="mt-2 text-[13px] leading-relaxed text-[#6b7280]">
                {reviews.length
                  ? `${reviews.length} review${reviews.length === 1 ? "" : "s"} from Trustpilot`
                  : claimed
                    ? "Trustpilot reviews for this theme are not loaded yet"
                    : "No Trustpilot reviews for this theme"}
              </DialogDescription>
              {theme.insight ? (
                <p className="mt-3 text-[14px] leading-relaxed text-[#374151]">
                  {theme.insight}
                </p>
              ) : null}
            </header>

            <div className="max-h-[calc(90vh-200px)] overflow-y-auto bg-[#f7f7f7] px-4 py-4 sm:px-5">
              {reviews.length === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-xl bg-white px-5 py-6 ring-1 ring-black/[0.04]">
                  <p className="text-[14px] leading-relaxed text-[#374151]">
                    {claimed
                      ? `${claimed} mention${claimed === 1 ? "" : "s"} in the window — refresh to pull the real Trustpilot reviews.`
                      : "No Trustpilot reviews for this theme."}
                  </p>
                  {onRefresh && claimed > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onRefresh();
                      }}
                      className="cursor-pointer rounded-full bg-[#00b67a] px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#00a36c]"
                    >
                      Refresh reviews
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <ul className="flex flex-col gap-3">
                    {reviews.map((r, i) => (
                      <li
                        key={`${r.date}-${i}`}
                        className="rounded-xl bg-white px-5 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]"
                      >
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <TrustStars
                            n={Math.max(
                              1,
                              Math.min(5, Math.round(r.rating) || 1),
                            )}
                            size={22}
                          />
                          <time className="text-[13px] text-[#6b7280]">
                            {formatReviewDate(r.date)}
                          </time>
                        </div>
                        {r.title ? (
                          <h4 className="mt-3.5 text-[16px] font-semibold leading-snug text-[#111]">
                            {r.title}
                          </h4>
                        ) : null}
                        <p
                          className={cn(
                            "text-[15px] leading-[1.55] text-[#1f2937]",
                            r.title ? "mt-2" : "mt-3.5",
                          )}
                        >
                          {r.text}
                        </p>
                        {r.replied ? (
                          <p className="mt-4 border-t border-[#f3f4f6] pt-3 text-[12px] font-medium text-[#00b67a]">
                            Company replied
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 pb-1 text-center text-[11px] text-[#9ca3af]">
                    Reviews from{" "}
                    <a
                      href={voice.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-dotted hover:text-[#6b7280]"
                    >
                      Trustpilot
                    </a>
                  </p>
                </>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* One section of the guide (complaints / stuck / asks / praise)       */
/* ------------------------------------------------------------------ */

const SECTIONS: {
  kind: PlayerVoiceKind;
  title: string;
  question: string;
}[] = [
  {
    kind: "complaint",
    title: "What players complain about",
    question: "The loudest, most repeated grievances in the window.",
  },
  {
    kind: "stuck",
    title: "Where players get stuck",
    question:
      "Pain points: places in the journey where they could not proceed.",
  },
  {
    kind: "ask",
    title: "What players ask for",
    question: "Features, markets, payment methods and options they want.",
  },
  {
    kind: "praise",
    title: "What players praise",
    question: "What is working, so nobody breaks it.",
  },
];

function ThemeSection({
  kind,
  title,
  question,
  themes,
  voice,
  onEvidence,
}: {
  kind: PlayerVoiceKind;
  title: string;
  question: string;
  themes: PlayerVoiceTheme[];
  voice: PlayerVoice;
  onEvidence: (t: PlayerVoiceTheme) => void;
}) {
  const groups = groupByArea(themes);
  const total = themes.reduce((n, t) => n + t.mentions, 0);
  return (
    <section className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <span
            className={cn("size-2 shrink-0 rounded-full", KIND_META[kind].dot)}
          />
          <h3 className="text-base font-medium">{title}</h3>
          <span className="text-xs tabular-nums text-[var(--rs-muted)]">
            {themes.length} · {total} mentions
          </span>
        </div>
        <p className="mt-1 pl-[18px] text-sm text-[var(--rs-muted)]">
          {question}
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--rs-border)] px-5 py-6 text-sm text-[var(--rs-muted)]">
          Nothing raised in this window.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)]">
          {groups.map((g, gi) => (
            <div
              key={g.area}
              className={cn(gi > 0 && "border-t border-[var(--rs-border)]")}
            >
              <div className="flex items-baseline justify-between gap-3 border-b border-[var(--rs-border)]/60 bg-[var(--rs-bg)]/50 px-5 py-2.5">
                <h4 className="text-xs font-medium uppercase tracking-[0.06em] text-[var(--rs-muted)]">
                  {g.area}
                </h4>
                <span className="text-[11px] tabular-nums text-[var(--rs-muted)]">
                  {g.themes.reduce((n, t) => n + t.mentions, 0)} mentions
                </span>
              </div>
              <ul>
                {g.themes.map((t, i) => (
                  <li
                    key={`${kind}-${g.area}-${t.theme}`}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_104px] items-start gap-4 px-5 py-4",
                      i > 0 && "border-t border-[var(--rs-border)]/40",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">
                        {t.theme}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--rs-muted)]">
                        {t.insight}
                      </p>
                      <p className="mt-2 text-[11px] text-[var(--rs-muted)]/80">
                        {t.vertical}
                        {t.stage ? ` · ${t.stage.replace(/_/g, " ")}` : ""}
                      </p>
                    </div>
                    <div className="flex justify-end pt-0.5">
                      <MentionsButton
                        theme={t}
                        voice={voice}
                        onClick={() => onEvidence(t)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Brand detail                                                        */
/* ------------------------------------------------------------------ */

function BrandVoice({
  brand,
  voice,
  onRefresh,
}: {
  brand: ResearchBrand;
  voice: PlayerVoice;
  onRefresh?: () => void | Promise<void>;
}) {
  const [show, setShow] = useState<PlayerVoiceKind | "all">("all");
  const [area, setArea] = useState<JourneyArea | null>(null);
  const [evidence, setEvidence] = useState<PlayerVoiceTheme | null>(null);
  const byKind: Record<PlayerVoiceKind, PlayerVoiceTheme[]> = {
    complaint: voice.complaints,
    stuck: voice.stuck,
    ask: voice.asks,
    praise: voice.praise,
  };
  const all = KIND_ORDER.flatMap((k) => byKind[k]);
  const needsRefresh = all.some((t) => {
    const real =
      (t.evidence?.length ?? 0) > 0 ||
      Boolean(t.reviewIds?.length && voice.reviews?.length);
    return t.mentions > 0 && !real;
  });
  const negShare = voice.sampled
    ? voice.ratingSplit.negative / voice.sampled
    : 0;

  const painByArea = groupByArea([
    ...voice.complaints,
    ...voice.stuck,
    ...voice.asks,
  ])
    .map((g) => ({
      area: g.area,
      mentions: g.themes.reduce((n, t) => n + t.mentions, 0),
    }))
    .sort((a, b) => b.mentions - a.mentions);
  const painMax = Math.max(1, ...painByArea.map((p) => p.mentions));
  const voiceLead = splitVoiceLead(voice.summary);

  return (
    <div className="flex flex-col gap-10">
      {needsRefresh ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] px-4 py-3">
          <p className="text-sm text-[var(--rs-muted)]">
            Mention counts are ready — refresh to load the Trustpilot reviews
            behind them.
          </p>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="shrink-0 cursor-pointer rounded-lg border border-[var(--rs-border)] px-3 py-1.5 text-xs font-medium text-[var(--rs-fg)] hover:bg-[var(--rs-bg)]"
            >
              Refresh reviews
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              [
                "TrustScore",
                voice.trustScore != null ? voice.trustScore.toFixed(1) : "—",
              ],
              [`Reviews · ${voice.windowMonths} mo`, String(voice.sampled)],
              [
                "Negative",
                pct(voice.ratingSplit.negative, voice.sampled),
                negShare > 0.4 ? "text-[var(--rs-critical)]" : undefined,
              ],
              [
                "Brand replies",
                voice.replyRate != null
                  ? `${Math.round(voice.replyRate * 100)}%`
                  : "—",
              ],
            ] as [string, string, string?][]
          ).map(([label, value, tone]) => (
            <div
              key={label}
              className="rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] px-4 py-3"
            >
              <div className="text-[10px] uppercase tracking-[0.06em] text-[var(--rs-muted)]">
                {label}
              </div>
              <div
                className={cn(
                  "mt-1.5 font-heading text-xl font-medium tabular-nums leading-none",
                  tone,
                )}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-end justify-end rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] px-4 py-3">
          <MonthlyBars voice={voice} />
        </div>
      </div>

      {/* Verdict + pain */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] px-5 py-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--rs-accent)]">
            The read
          </p>
          <p className="mt-2 font-heading text-xl font-medium leading-snug tracking-tight">
            {voiceLead.lead}
          </p>
          {voiceLead.rest ? (
            <p className="mt-2 text-sm leading-relaxed text-[var(--rs-muted)]">
              {voiceLead.rest}
            </p>
          ) : null}
          {voice.authenticityNote ? (
            <p className="mt-3 text-xs leading-relaxed text-[var(--rs-muted)]">
              {voice.authenticityNote}
            </p>
          ) : null}
          <a
            href={voice.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--rs-fg)] underline-offset-2 hover:underline"
          >
            <MessageSquare className="size-3.5 opacity-70" />
            {voice.totalReviews != null
              ? `${voice.totalReviews.toLocaleString()} reviews`
              : "Trustpilot"}
            <span className="text-xs text-[var(--rs-muted)]">
              · {relative(voice.fetchedAt)}
            </span>
          </a>
        </div>
        <div className="rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] px-5 py-5">
          <h3 className="text-xs font-medium uppercase tracking-[0.06em] text-[var(--rs-muted)]">
            Where the pain sits
          </h3>
          <p className="mt-1 text-xs text-[var(--rs-muted)]">
            Click a bar to filter the themes below.
          </p>
          {painByArea.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--rs-muted)]">
              No complaints, asks or blockers raised.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-1">
              {painByArea.slice(0, 6).map((p) => {
                const active = area === p.area;
                return (
                  <li key={p.area}>
                    <button
                      type="button"
                      onClick={() => setArea(active ? null : p.area)}
                      className={cn(
                        "grid w-full cursor-pointer grid-cols-[128px_1fr_36px] items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-[var(--rs-fg)]/[0.04]",
                        active && "bg-[var(--rs-fg)]/[0.06]",
                        area && !active && "opacity-45",
                      )}
                    >
                      <span className="truncate">{p.area}</span>
                      <span className="h-2 rounded-full bg-[var(--rs-bg)]">
                        <span
                          className="block h-full rounded-full bg-[var(--rs-critical)]/85"
                          style={{
                            width: `${Math.round((p.mentions / painMax) * 100)}%`,
                          }}
                        />
                      </span>
                      <span className="text-right tabular-nums text-[var(--rs-muted)]">
                        {p.mentions}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {area ? (
          <button
            type="button"
            onClick={() => setArea(null)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--rs-critical)]/40 bg-[var(--rs-critical)]/10 px-3 py-1.5 text-xs text-[var(--rs-fg)]"
          >
            {area}
            <X className="size-3 opacity-70" />
          </button>
        ) : null}
        {(["all", ...KIND_ORDER] as const).map((k) => {
          const inArea = (list: PlayerVoiceTheme[]) =>
            area ? list.filter((t) => journeyArea(t) === area) : list;
          const count =
            k === "all" ? inArea(all).length : inArea(byKind[k]).length;
          const active = show === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setShow(k)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                active
                  ? "border-[var(--rs-accent)] bg-[var(--rs-accent)]/10 text-[var(--rs-fg)]"
                  : "border-[var(--rs-border)] text-[var(--rs-muted)] hover:text-[var(--rs-fg)]",
              )}
            >
              {k !== "all" ? (
                <span
                  className={cn("size-1.5 rounded-full", KIND_META[k].dot)}
                />
              ) : null}
              {k === "all" ? "All" : KIND_META[k].plural}
              <span className="tabular-nums opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {SECTIONS.filter((sec) => show === "all" || show === sec.kind).map(
        (sec) => (
          <ThemeSection
            key={sec.kind}
            kind={sec.kind}
            title={sec.title}
            question={sec.question}
            themes={
              area
                ? byKind[sec.kind].filter((t) => journeyArea(t) === area)
                : byKind[sec.kind]
            }
            voice={voice}
            onEvidence={setEvidence}
          />
        ),
      )}

      <EvidenceDialog
        theme={evidence}
        voice={voice}
        onClose={() => setEvidence(null)}
        onRefresh={onRefresh}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] px-5 py-5">
          <h3 className="text-base font-medium">Feature requests</h3>
          <p className="mt-1 text-sm text-[var(--rs-muted)]">
            What players ask for, ranked by how many raised it.
          </p>
          {voice.asks.length === 0 ? (
            <p className="mt-5 text-sm text-[var(--rs-muted)]">
              No feature requests in the window.
            </p>
          ) : (
            <ol className="mt-5">
              {voice.asks
                .slice()
                .sort((a, b) => b.mentions - a.mentions)
                .map((t, i) => (
                  <li
                    key={t.theme}
                    className={cn(
                      "grid grid-cols-[28px_minmax(0,1fr)_104px] items-start gap-3 py-3.5",
                      i > 0 && "border-t border-[var(--rs-border)]/50",
                    )}
                  >
                    <span className="pt-0.5 text-sm tabular-nums text-[var(--rs-muted)]">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">
                        {t.theme}
                      </p>
                      <p className="mt-1 text-xs text-[var(--rs-muted)]">
                        {journeyArea(t)} · {t.vertical}
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <MentionsButton
                        theme={t}
                        voice={voice}
                        onClick={() => setEvidence(t)}
                      />
                    </div>
                  </li>
                ))}
            </ol>
          )}
        </div>

        <div className="rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] px-5 py-5">
          <h3 className="text-base font-medium">Against the journey we ran</h3>
          {voice.alignment.length === 0 ? (
            <p className="mt-5 text-sm text-[var(--rs-muted)]">
              No journey run for {brand.name} to compare yet.
            </p>
          ) : (
            <ul className="mt-5">
              {voice.alignment.map((a, i) => (
                <li
                  key={`${a.area}-${a.verdict}`}
                  className={cn(
                    "grid grid-cols-[88px_minmax(0,1fr)] gap-3 py-3.5 text-sm",
                    i > 0 && "border-t border-[var(--rs-border)]/50",
                  )}
                >
                  <span
                    className={cn(
                      "pt-0.5 text-[11px] font-medium uppercase tracking-[0.06em]",
                      a.verdict === "confirms"
                        ? "text-[var(--rs-accent)]"
                        : a.verdict === "contradicts"
                          ? "text-[var(--rs-critical)]"
                          : "text-[var(--rs-muted)]",
                    )}
                  >
                    {a.verdict}
                  </span>
                  <span className="leading-relaxed">
                    <span className="font-medium">{a.area}</span>
                    <span className="text-[var(--rs-muted)]"> · {a.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab                                                                 */
/* ------------------------------------------------------------------ */

export function PlayerVoiceTab({
  project,
  onRun,
  onRefreshBrand,
  progress,
  disabled,
  error,
}: {
  project: ResearchProject;
  onRun: () => void;
  onRefreshBrand?: (brandId: string) => void | Promise<void>;
  progress: string | null;
  disabled?: boolean;
  error?: string | null;
}) {
  const [selected, setSelected] = useState<string>("all");
  const anyRead = project.brands.some((b) => b.playerVoice);
  const brand =
    selected === "all"
      ? null
      : (project.brands.find((b) => b.id === selected) ?? null);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-medium">Voice of Player</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--rs-muted)]">
            What players complain about, ask for and get stuck on. Public
            Trustpilot reviews from the last 6 months, tagged by vertical and
            theme, then checked against what the agent measured on the journey.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            disabled={disabled || progress != null}
            onClick={onRun}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--rs-border)] px-3 py-1.5 text-xs font-medium text-[var(--rs-fg)] hover:bg-[var(--rs-bg)] disabled:cursor-default disabled:opacity-50"
          >
            <MessageSquareQuote className="size-3.5 opacity-70" />
            {progress
              ? "Reading reviews…"
              : anyRead
                ? "Refresh reviews"
                : "Read reviews (6 months)"}
          </button>
          {progress ? (
            <p className="max-w-xs truncate text-[10px] text-[var(--rs-muted)]">
              {progress}
            </p>
          ) : error ? (
            <p className="max-w-xs text-right text-[10px] text-[var(--rs-critical)]">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      {/* Brand filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelected("all")}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
            selected === "all"
              ? "border-[var(--rs-accent)] bg-[var(--rs-accent)]/10 text-[var(--rs-fg)]"
              : "border-[var(--rs-border)] text-[var(--rs-muted)] hover:text-[var(--rs-fg)]",
          )}
        >
          All brands
        </button>
        {project.brands.map((b) => {
          const active = b.id === selected;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelected(b.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-[var(--rs-accent)] bg-[var(--rs-accent)]/10 text-[var(--rs-fg)]"
                  : "border-[var(--rs-border)] text-[var(--rs-muted)] hover:text-[var(--rs-fg)]",
                !b.playerVoice && "opacity-60",
              )}
            >
              <BrandFavicon brand={b} />
              {b.name}
              {b.playerVoice ? (
                <span className="text-xs tabular-nums opacity-60">
                  {b.playerVoice.trustScore?.toFixed(1) ?? ""}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {brand ? (
        brand.playerVoice ? (
          <BrandVoice
            brand={brand}
            voice={brand.playerVoice}
            onRefresh={onRefreshBrand ? () => onRefreshBrand(brand.id) : onRun}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--rs-border)] p-6 text-sm text-[var(--rs-muted)]">
            No reviews read for {brand.name} yet.
          </div>
        )
      ) : (
        <div className="flex flex-col gap-6">
          <div>
          <div className="rs-table-wrap">
            <table className="rs-table rs-fixed min-w-[900px]">
              <colgroup>
                <col style={{ width: 170 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th>Brand</th>
                  <th className="rs-num">TrustScore</th>
                  <th className="rs-num">Reviews · 6 mo</th>
                  <th className="rs-num">Negative</th>
                  <th className="rs-num">Replies</th>
                  <th>Top complaint</th>
                  <th>Most stuck on</th>
                </tr>
              </thead>
              <tbody>
                {project.brands.map((b) => {
                  const v = b.playerVoice;
                  return (
                    <tr
                      key={b.id}
                      className={cn(!v && "rs-dim", v && "cursor-pointer")}
                      onClick={v ? () => setSelected(b.id) : undefined}
                    >
                      <td>
                        <span className="inline-flex items-center gap-2 font-medium">
                          <BrandFavicon brand={b} />
                          {b.name}
                          {b.role === "own_brand" ? (
                            <span className="text-[10px] font-normal text-[var(--rs-muted)]">
                              you
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="rs-num">
                        {v?.trustScore != null ? v.trustScore.toFixed(1) : "—"}
                      </td>
                      <td className="rs-num">{v ? v.sampled : "—"}</td>
                      <td
                        className={cn(
                          "rs-num",
                          v &&
                            v.sampled &&
                            v.ratingSplit.negative / v.sampled > 0.4 &&
                            "text-[var(--rs-critical)]",
                        )}
                      >
                        {v ? pct(v.ratingSplit.negative, v.sampled) : "—"}
                      </td>
                      <td className="rs-num">
                        {v?.replyRate != null
                          ? `${Math.round(v.replyRate * 100)}%`
                          : "—"}
                      </td>
                      <td>
                        <Truncate
                          text={v?.complaints[0]?.theme ?? (v ? "None" : "—")}
                        />
                      </td>
                      <td>
                        <Truncate
                          text={v?.stuck[0]?.theme ?? (v ? "None" : "—")}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!anyRead ? (
            <p className="mt-3 text-xs text-[var(--rs-muted)]">
              Nothing read yet. Run it once the journeys are in so the alignment
              can point at real measurements.
            </p>
          ) : (
            <p className="mt-3 text-xs text-[var(--rs-muted)]">
              Click a brand for its themes, Trustpilot reviews and how they
              square with the journey.
            </p>
          )}
          </div>
          {anyRead ? <VoiceAllSynopsis project={project} /> : null}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* All-brands synopsis                                                 */
/* ------------------------------------------------------------------ */

type VoiceBrandRow = {
  brand: ResearchBrand;
  voice: PlayerVoice;
  negPct: number;
};

function themeBlob(v: PlayerVoice): string {
  return [
    ...v.complaints,
    ...v.stuck,
    ...v.asks,
  ]
    .map((t) => `${t.theme} ${t.vertical} ${t.stage ?? ""}`.toLowerCase())
    .join(" · ");
}

function brandsWithVoice(project: ResearchProject): VoiceBrandRow[] {
  return project.brands
    .filter((b): b is ResearchBrand & { playerVoice: PlayerVoice } =>
      Boolean(b.playerVoice),
    )
    .map((b) => ({
      brand: b,
      voice: b.playerVoice,
      negPct: b.playerVoice.sampled
        ? b.playerVoice.ratingSplit.negative / b.playerVoice.sampled
        : 0,
    }))
    .sort(
      (a, b) => (b.voice.trustScore ?? 0) - (a.voice.trustScore ?? 0),
    );
}

/** Shared pain signals that show up on 2+ brands. */
function commonSignals(rows: VoiceBrandRow[]): string[] {
  const checks: { label: string; test: (blob: string) => boolean }[] = [
    {
      label: "Withdrawals delayed, pending, or blocked",
      test: (s) => /withdraw|payout|cash.?out|pending/.test(s),
    },
    {
      label: "Support feels canned, slow, or disappears",
      test: (s) => /support|canned|ignore|ticket|live chat/.test(s),
    },
    {
      label: "Bonus / VIP terms feel unfair after the fact",
      test: (s) => /bonus|vip|wager|promo|void/.test(s),
    },
    {
      label: "Wins limited, voided, or accounts restricted",
      test: (s) => /limit|restrict|void|rigged|confiscat|banned/.test(s),
    },
  ];
  const out: string[] = [];
  for (const c of checks) {
    const hit = rows.filter((r) => c.test(themeBlob(r.voice))).length;
    if (hit >= 2) out.push(c.label);
  }
  return out.slice(0, 4);
}

function VoiceAllSynopsis({ project }: { project: ResearchProject }) {
  const rows = brandsWithVoice(project);
  if (rows.length < 2) return null;

  const leader = rows[0]!;
  const laggard = rows[rows.length - 1]!;
  const common = commonSignals(rows);
  const own = rows.find((r) => r.brand.role === "own_brand");

  type GapItem = {
    key: string;
    brand: ResearchBrand;
    label: string;
    note: string;
    tone: "critical" | "gap";
  };
  const gapItems: GapItem[] = [];
  const seen = new Set<string>();
  const pushGap = (item: GapItem) => {
    if (seen.has(item.key) || gapItems.length >= 4) return;
    seen.add(item.key);
    gapItems.push(item);
  };

  for (const r of rows) {
    if (r.negPct >= 0.6) {
      pushGap({
        key: `neg-${r.brand.id}`,
        brand: r.brand,
        label: `${Math.round(r.negPct * 100)}% negative`,
        note: "Trust is the product problem, not onboarding speed.",
        tone: "critical",
      });
    }
  }
  for (const r of rows) {
    for (const a of r.voice.alignment) {
      if (a.verdict !== "gap") continue;
      pushGap({
        key: `gap-${r.brand.id}-${a.area}`,
        brand: r.brand,
        label: a.area,
        note: a.note,
        tone: "gap",
      });
    }
  }

  const takeaway =
    own && leader.brand.id === own.brand.id
      ? `${leader.brand.name} leads the scoreboard, but all brands share the same war: get money out fairly. ${laggard.brand.name} is the trust laggard.`
      : `${leader.brand.name} leads TrustScore; ${laggard.brand.name} trails. Shared pain is cash-out trust — journeys can’t prove payout speed.`;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--rs-border)] bg-[var(--rs-card)]">
      <div className="border-b border-[var(--rs-border)] px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-2xl">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--rs-muted)]">
              Synopsis
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--rs-fg)]">
              {takeaway}
            </p>
          </div>
          <ol className="flex flex-wrap items-center gap-1.5">
            {rows.map((r, i) => (
              <li key={r.brand.id} className="flex items-center gap-1.5">
                {i > 0 ? (
                  <span
                    className="text-[10px] text-[var(--rs-muted)]"
                    aria-hidden
                  >
                    →
                  </span>
                ) : null}
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs",
                    i === 0
                      ? "border-emerald-500/40 bg-emerald-500/10 text-[var(--rs-fg)]"
                      : i === rows.length - 1
                        ? "border-red-500/30 bg-red-500/5 text-[var(--rs-fg)]"
                        : "border-[var(--rs-border)] text-[var(--rs-muted)]",
                  )}
                >
                  <BrandFavicon brand={r.brand} />
                  <span className="max-w-[7rem] truncate">{r.brand.name}</span>
                  <span className="tabular-nums font-medium text-[var(--rs-fg)]">
                    {r.voice.trustScore?.toFixed(1) ?? "—"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="grid divide-y divide-[var(--rs-border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <section className="px-4 py-4 sm:px-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--rs-muted)]">
            Common
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--rs-muted)]">
            Shared across {rows.length} brands
          </p>
          {common.length ? (
            <ul className="mt-3 space-y-2.5">
              {common.map((c, i) => (
                <li key={c} className="flex gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-[var(--rs-bg)] text-[10px] font-medium tabular-nums text-[var(--rs-muted)]">
                    {i + 1}
                  </span>
                  <span className="text-xs leading-snug text-[var(--rs-fg)]">
                    {c}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[var(--rs-muted)]">
              No shared themes yet.
            </p>
          )}
        </section>

        <section className="px-4 py-4 sm:px-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--rs-muted)]">
            Leading
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--rs-muted)]">
            TrustScore rank
          </p>
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <BrandFavicon brand={leader.brand} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[var(--rs-fg)]">
                    {leader.brand.name}
                    {leader.brand.role === "own_brand" ? (
                      <span className="ml-1.5 text-[10px] font-normal text-[var(--rs-muted)]">
                        you
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[10px] text-emerald-400/90">Ahead</p>
                </div>
                <span className="text-lg font-medium tabular-nums tracking-tight text-[var(--rs-fg)]">
                  {leader.voice.trustScore?.toFixed(1)}
                </span>
              </div>
              {leader.voice.praise[0] ? (
                <p className="mt-2 border-t border-emerald-500/20 pt-2 text-[11px] leading-snug text-[var(--rs-muted)]">
                  Players still praise{" "}
                  <span className="text-[var(--rs-fg)]">
                    {leader.voice.praise[0].theme}
                  </span>
                </p>
              ) : null}
            </div>

            {laggard.brand.id !== leader.brand.id ? (
              <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <BrandFavicon brand={laggard.brand} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-[var(--rs-fg)]">
                      {laggard.brand.name}
                    </p>
                    <p className="text-[10px] text-red-400/90">Trailing</p>
                  </div>
                  <span className="text-lg font-medium tabular-nums tracking-tight text-[var(--rs-fg)]">
                    {laggard.voice.trustScore?.toFixed(1)}
                  </span>
                </div>
                {laggard.voice.complaints[0] ? (
                  <p className="mt-2 border-t border-red-500/15 pt-2 text-[11px] leading-snug text-[var(--rs-muted)]">
                    Top complaint{" "}
                    <span className="text-[var(--rs-fg)]">
                      {laggard.voice.complaints[0].theme}
                    </span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="px-4 py-4 sm:px-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--rs-muted)]">
            Gaps
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--rs-muted)]">
            Reviews vs journey
          </p>
          {gapItems.length ? (
            <ul className="mt-3 space-y-3">
              {gapItems.map((g) => (
                <li key={g.key} className="flex gap-2.5">
                  <BrandFavicon brand={g.brand} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-x-1.5 text-[11px]">
                      <span className="font-medium text-[var(--rs-fg)]">
                        {g.brand.name}
                      </span>
                      <span
                        className={cn(
                          "rounded px-1 py-px text-[10px] font-medium uppercase tracking-wide",
                          g.tone === "critical"
                            ? "bg-red-500/15 text-red-300"
                            : "bg-amber-500/15 text-amber-200",
                        )}
                      >
                        {g.label}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-[var(--rs-muted)]">
                      {g.note}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[var(--rs-muted)]">
              No journey gaps tagged yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
