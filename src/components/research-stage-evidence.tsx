"use client";

import {
  Globe,
  Handshake,
  Search,
  Share2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { FrameThumb } from "@/components/research-frame-viewer";
import { ResearchEmailThumb } from "@/components/research-email-card";
import {
  formatEmailReceivedAt,
  isDepositConfirmEmail,
} from "@/lib/research/email-format";
import type {
  AcquisitionSource,
  EmailWatchItem,
  JourneyStageResult,
} from "@/lib/research/types";
import { cn } from "@/lib/utils";

function formatSec(n: number | null | undefined) {
  if (n == null) return "—";
  if (n < 60) return `${n}s`;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}m ${s}s`;
}

export function StageEvidenceGallery({
  stages,
  emails = [],
  watchingInbox = false,
  acquisitionSource = null,
  heading = true,
}: {
  stages: JourneyStageResult[];
  emails?: EmailWatchItem[];
  watchingInbox?: boolean;
  acquisitionSource?: AcquisitionSource | null;
  heading?: boolean;
}) {
  const withShots = stages.filter(
    (s) =>
      (s.screenshotUrls?.length ?? 0) > 0 ||
      (s.evidence && s.evidence !== "Skipped" && s.endedAt),
  );
  const showInbox =
    emails.length > 0 ||
    watchingInbox ||
    stages.some(
      (s) =>
        (s.stageId === "registration" || s.stageId === "verification") &&
        (s.startedAt || s.endedAt),
    );

  if (withShots.length === 0 && !showInbox) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--rs-border)] p-4 text-sm text-[var(--rs-muted)]">
        No screenshots yet. They appear here as the agent walks each stage.
      </div>
    );
  }

  type FlowItem =
    | { kind: "stage"; stage: (typeof withShots)[number] }
    | { kind: "inbox" };

  const items: FlowItem[] = [];
  let inboxInserted = false;
  for (const s of withShots) {
    items.push({ kind: "stage", stage: s });
    if (
      !inboxInserted &&
      (s.stageId === "registration" || s.stageId === "verification")
    ) {
      items.push({ kind: "inbox" });
      inboxInserted = true;
    }
  }
  if (showInbox && !inboxInserted) {
    items.push({ kind: "inbox" });
  }

  const cardCls =
    "flex flex-col overflow-hidden rounded-lg border border-[var(--rs-border)] bg-[var(--rs-card)]";
  const HERO_H = 128;

  return (
    <div className="flex flex-col gap-3">
      {heading ? (
        <div>
          <h3 className="font-heading text-base font-medium">Evidence</h3>
          <p className="mt-0.5 text-[11px] text-[var(--rs-muted)]">
            Journey order · every frame the agent saw · click to enlarge
          </p>
        </div>
      ) : null}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
        {items.map((item) => {
          if (item.kind === "inbox") {
            const [first, ...others] = emails;
            return (
              <div key="inbox-after-registration" className={cardCls}>
                <div className="flex items-center justify-between gap-2 border-b border-[var(--rs-border)] px-2.5 py-2">
                  <p className="text-xs font-medium text-[var(--rs-fg)]">
                    Inbox
                  </p>
                  <p className="text-[10px] text-[var(--rs-muted)]">
                    {emails.length > 0
                      ? `${emails.length} message${emails.length === 1 ? "" : "s"}`
                      : watchingInbox
                        ? "Watching…"
                        : "None yet"}
                  </p>
                </div>
                {first ? (
                  <ResearchEmailThumb
                    email={first}
                    width={200}
                    height={HERO_H}
                    bare
                  />
                ) : (
                  <div
                    className="flex items-center justify-center px-2 text-center text-[10px] text-[var(--rs-muted)]"
                    style={{ height: HERO_H }}
                  >
                    {watchingInbox
                      ? "Polling alias…"
                      : "Mail lands after signup"}
                  </div>
                )}
                <div className="flex h-12 items-center gap-1 overflow-x-auto border-t border-[var(--rs-border)] bg-[var(--rs-bg)]/60 px-1.5">
                  {others.length > 0 ? (
                    others
                      .slice(0, 8)
                      .map((e) => (
                        <ResearchEmailThumb
                          key={e.id}
                          email={e}
                          width={36}
                          height={36}
                          bare
                        />
                      ))
                  ) : (
                    <span className="px-1 text-[10px] text-[var(--rs-muted)]">
                      {first ? "1 message" : "—"}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5 p-2">
                  <p className="line-clamp-2 text-[10px] text-[var(--rs-fg)]">
                    {first
                      ? first.subject || "(no subject)"
                      : "As the player sees it on mobile"}
                  </p>
                  <p className="text-[10px] text-[var(--rs-muted)]">
                    {first
                      ? formatEmailReceivedAt(first.receivedAt).relative
                      : ""}
                  </p>
                </div>
              </div>
            );
          }

          const s = item.stage;
          const confirmEmail =
            s.stageId === "deposit_confirmation"
              ? ([...emails].reverse().find(isDepositConfirmEmail) ?? null)
              : null;
          const shots = confirmEmail
            ? []
            : [...new Set(s.screenshotUrls ?? [])];
          const hero =
            s.stageId === "registration" && shots.length
              ? shots[shots.length - 1]
              : shots[0];
          const strip =
            s.stageId === "registration" && shots.length > 1
              ? shots.slice(0, -1)
              : shots.length > 1
                ? [...shots.slice(1), shots[0]!]
                : shots;
          return (
            <div key={s.stageId} className={cardCls}>
              <div className="flex items-center justify-between gap-2 border-b border-[var(--rs-border)] px-2.5 py-2">
                <p className="truncate text-xs font-medium">{s.label}</p>
                <p className="shrink-0 text-[10px] tabular-nums text-[var(--rs-muted)]">
                  {formatSec(s.timeSec)}
                  {s.steps != null ? ` · ${s.steps}clk` : ""}
                </p>
              </div>
              {s.stageId === "first_touch" ? (
                <FirstTouchFunnel height={HERO_H} />
              ) : confirmEmail ? (
                <ResearchEmailThumb
                  email={confirmEmail}
                  width={200}
                  height={HERO_H}
                  bare
                />
              ) : hero ? (
                <FrameThumb
                  src={hero}
                  alt={s.label}
                  caption={`${s.label} · 1/${shots.length}${s.evidence ? ` — ${s.evidence}` : ""}`}
                  className="w-full rounded-none border-0"
                  imgClassName="object-top"
                  style={{ height: HERO_H }}
                />
              ) : (
                <div
                  className="flex items-center justify-center bg-[var(--rs-bg)] text-[10px] text-[var(--rs-muted)]"
                  style={{ height: HERO_H }}
                >
                  {s.endedAt ? "No frame" : "Capturing…"}
                </div>
              )}
              <div className="flex h-12 items-center gap-1 overflow-x-auto border-t border-[var(--rs-border)] bg-[var(--rs-bg)]/60 px-1.5">
                {strip.length > 0 ? (
                  strip.map((src, i) => (
                    <FrameThumb
                      key={src}
                      src={src}
                      alt={`${s.label} ${i + 1}`}
                      caption={`${s.label} · ${i + 1}/${strip.length}`}
                      className={cn(
                        "h-9 w-9 shrink-0",
                        src === hero
                          ? "border-[var(--rs-accent)]/60"
                          : "border-[var(--rs-border)]",
                      )}
                    />
                  ))
                ) : (
                  <span className="truncate px-1 text-[10px] text-[var(--rs-muted)]">
                    {s.stageId === "first_touch"
                      ? `All channels land here · this run: ${acquisitionSource ?? "direct"}`
                      : /on-site: your deposit was successful/i.test(
                            s.evidence ?? "",
                          )
                        ? "On-site success · $11.61"
                        : confirmEmail
                          ? `Confirmed by email · ${formatEmailReceivedAt(confirmEmail.receivedAt).relative}`
                          : "—"}
                  </span>
                )}
                {shots.length > 1 ? (
                  <span className="sticky right-0 ml-auto shrink-0 pl-1 text-[10px] text-[var(--rs-muted)]">
                    {shots.length}
                  </span>
                ) : null}
              </div>
              <div className="space-y-0.5 p-2">
                {s.friction ? (
                  <p className="line-clamp-2 text-[10px] text-amber-400/90">
                    {s.friction}
                  </p>
                ) : (
                  <p className="line-clamp-2 text-[10px] text-[var(--rs-muted)]">
                    {s.evidence || "\u00a0"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const FIRST_TOUCH_CHANNELS: { id: string; label: string; Icon: LucideIcon }[] =
  [
    { id: "affiliate", label: "Affiliates", Icon: Handshake },
    { id: "referral", label: "Refer a friend", Icon: UserPlus },
    { id: "organic", label: "Organic", Icon: Search },
    { id: "social", label: "Socials", Icon: Share2 },
  ];

function FirstTouchFunnel({ height }: { height: number }) {
  const rows = FIRST_TOUCH_CHANNELS;
  const W = 196;
  const PAD = 12;
  const rowY = (i: number) =>
    PAD + 10 + i * ((height - 2 * PAD - 20) / (rows.length - 1));
  const midY = height / 2;
  const X_FROM = 100;
  const X_TO = W - 34;
  return (
    <div
      className="w-full overflow-hidden bg-[var(--rs-bg)]"
      style={{ height }}
    >
      <div className="relative mx-auto h-full" style={{ width: W }}>
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${W} ${height}`}
          aria-hidden
        >
          {rows.map((r, i) => {
            const y = rowY(i);
            const cx = (X_FROM + X_TO) / 2;
            return (
              <g key={r.id}>
                <path
                  d={`M ${X_FROM} ${y} C ${cx} ${y}, ${cx} ${midY}, ${X_TO} ${midY}`}
                  fill="none"
                  stroke="var(--rs-border)"
                  strokeWidth={1}
                />
                <path
                  className="rs-flow-line"
                  d={`M ${X_FROM} ${y} C ${cx} ${y}, ${cx} ${midY}, ${X_TO} ${midY}`}
                  fill="none"
                  stroke="var(--rs-accent)"
                  strokeWidth={1.25}
                  strokeLinecap="round"
                  style={{ animationDelay: `${i * -0.4}s` }}
                />
              </g>
            );
          })}
        </svg>
        <ul
          className="absolute left-0 top-0 flex h-full flex-col justify-between"
          style={{ paddingTop: PAD, paddingBottom: PAD }}
        >
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-1.5 text-[10px] text-[var(--rs-muted)]"
            >
              <span className="flex size-5 items-center justify-center rounded-md border border-[var(--rs-border)] bg-[var(--rs-card)] text-[var(--rs-fg)]/80">
                <r.Icon className="size-3" strokeWidth={1.75} />
              </span>
              {r.label}
            </li>
          ))}
        </ul>
        <div
          className="absolute right-0 flex -translate-y-1/2 flex-col items-center gap-1"
          style={{ top: midY }}
        >
          <span className="flex size-8 items-center justify-center rounded-lg border border-[var(--rs-accent)]/50 bg-[var(--rs-accent)]/10 text-[var(--rs-accent)]">
            <Globe className="size-4" strokeWidth={1.75} />
          </span>
          <span className="text-[9px] text-[var(--rs-muted)]">Landing</span>
        </div>
      </div>
    </div>
  );
}
