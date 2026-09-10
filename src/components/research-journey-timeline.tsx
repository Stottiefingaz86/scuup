"use client";

import type { JourneyStageResult } from "@/lib/research/types";
import { cn } from "@/lib/utils";
import { Mail, SkipForward } from "lucide-react";

function formatSec(n: number | null | undefined) {
  if (n == null) return null;
  if (n < 60) return `${n}s`;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}m ${s}s`;
}

function stageState(
  s: JourneyStageResult,
): "done" | "active" | "pending" | "skipped" {
  if (s.endedAt && s.evidence === "Skipped") return "skipped";
  if (s.endedAt) return "done";
  if (s.startedAt) return "active";
  return "pending";
}

type PathNode =
  | { kind: "stage"; stage: JourneyStageResult; index: number }
  | { kind: "inbox"; active: boolean; done: boolean };

export function ResearchJourneyTimeline({
  stages,
  emailCount = 0,
  skippableStageIds,
  onSkipStage,
  skippingStageId = null,
}: {
  stages: JourneyStageResult[];
  /** When set, inserts an Inbox node after registration in the path. */
  emailCount?: number;
  /** Stages that offer "Skip" while active (broken / never going to finish). */
  skippableStageIds?: string[];
  onSkipStage?: (stageId: string) => void;
  skippingStageId?: string | null;
}) {
  const nodes: PathNode[] = [];
  let inboxInserted = false;
  stages.forEach((stage, index) => {
    nodes.push({ kind: "stage", stage, index });
    if (!inboxInserted && stage.stageId === "registration") {
      const regDone = Boolean(stage.endedAt);
      const ver = stages.find((s) => s.stageId === "verification");
      const inboxActive =
        regDone &&
        !ver?.endedAt &&
        (emailCount === 0 || Boolean(ver?.startedAt) || !ver);
      nodes.push({
        kind: "inbox",
        done: emailCount > 0,
        active: inboxActive && emailCount === 0,
      });
      inboxInserted = true;
    }
  });

  return (
    <div className="overflow-x-auto pb-1">
      <ol className="flex min-w-max items-start gap-0 py-1">
        {nodes.map((node, i) => {
          const next = nodes[i + 1];
          let state: "done" | "active" | "pending" | "skipped" = "pending";
          let label = "";
          let sub: string | null = null;
          let key = "";

          if (node.kind === "stage") {
            state = stageState(node.stage);
            label = node.stage.label;
            sub = formatSec(node.stage.timeSec);
            if (!sub && state === "active") sub = "…";
            if (!sub && state === "pending") sub = "—";
            key = node.stage.stageId;
          } else {
            state = node.done ? "done" : node.active ? "active" : "pending";
            label = "Inbox";
            sub =
              emailCount > 0
                ? `${emailCount} mail${emailCount === 1 ? "" : "s"}`
                : state === "active"
                  ? "…"
                  : "—";
            key = "inbox";
          }

          const nextState =
            next?.kind === "stage"
              ? stageState(next.stage)
              : next
                ? next.done
                  ? "done"
                  : next.active
                    ? "active"
                    : "pending"
                : null;
          const lineLive =
            state === "active" ||
            (state === "done" &&
              (nextState === "active" || nextState === "pending"));
          const lineDone = state === "done" && nextState === "done";

          return (
            <li key={key} className="flex items-start">
              <div className="flex w-[112px] flex-col items-center gap-2 px-1">
                <div
                  className={cn(
                    "relative flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums",
                    state === "done" &&
                      "bg-[var(--rs-accent)] text-[var(--rs-bg)]",
                    state === "active" &&
                      "bg-[var(--rs-accent)]/20 text-[var(--rs-accent)] ring-2 ring-[var(--rs-accent)] ring-offset-2 ring-offset-[var(--rs-card)]",
                    state === "skipped" &&
                      "bg-[var(--rs-border)] text-[var(--rs-muted)] line-through",
                    state === "pending" &&
                      "border border-[var(--rs-border)] bg-[var(--rs-bg)] text-[var(--rs-muted)]",
                  )}
                >
                  {state === "active" ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-lg bg-[var(--rs-accent)]/25 rs-journey-pulse"
                    />
                  ) : null}
                  <span className="relative z-10">
                    {node.kind === "inbox" ? (
                      <Mail className="size-3.5" strokeWidth={2} />
                    ) : (
                      node.index + 1
                    )}
                  </span>
                </div>
                <span className="px-0.5 text-center text-[10px] font-medium leading-snug text-[var(--rs-fg)]">
                  {label}
                </span>
                {sub ? (
                  <span
                    className={cn(
                      "text-[10px] tabular-nums",
                      state === "done" || state === "active"
                        ? "text-[var(--rs-accent)]"
                        : "text-[var(--rs-muted)]",
                    )}
                  >
                    {sub}
                  </span>
                ) : null}
                {node.kind === "stage" &&
                node.stage.steps != null &&
                node.stage.steps > 0 ? (
                  <span className="text-[9px] text-[var(--rs-muted)]">
                    {node.stage.steps} click
                    {node.stage.steps === 1 ? "" : "s"}
                  </span>
                ) : null}
                {node.kind === "stage" &&
                state === "active" &&
                onSkipStage &&
                skippableStageIds?.includes(node.stage.stageId) ? (
                  <button
                    type="button"
                    disabled={skippingStageId != null}
                    onClick={() => onSkipStage(node.stage.stageId)}
                    title="Give up on this stage and move the agent on to the next one (test — nothing after it is scored)"
                    className="mt-0.5 inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed border-amber-500/40 px-2 py-0.5 text-[10px] text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
                  >
                    {skippingStageId === node.stage.stageId ? (
                      "Skipping…"
                    ) : (
                      <>
                        Skip{" "}
                        <SkipForward className="size-2.5" strokeWidth={2} />
                      </>
                    )}
                  </button>
                ) : null}
              </div>

              {i < nodes.length - 1 ? (
                <div
                  className="relative mt-[18px] h-[2px] w-7 shrink-0 overflow-hidden rounded-full bg-[var(--rs-border)]"
                  aria-hidden
                >
                  {lineDone ? (
                    <span className="absolute inset-0 bg-[var(--rs-accent)]" />
                  ) : null}
                  {lineLive ? (
                    <span className="absolute inset-0 rs-journey-flow bg-[linear-gradient(90deg,transparent,var(--rs-accent),transparent)]" />
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
