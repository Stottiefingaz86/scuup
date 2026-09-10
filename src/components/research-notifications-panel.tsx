"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getResearchProject } from "@/lib/research/store";
import type { ResearchAction } from "@/lib/research/types";

function formatWhen(iso: string, now: number): string {
  const t = new Date(iso);
  const clock = t.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const diffSec = Math.max(0, Math.round((now - t.getTime()) / 1000));
  const rel =
    diffSec < 60
      ? "just now"
      : diffSec < 3600
        ? `${Math.round(diffSec / 60)} min ago`
        : diffSec < 86_400
          ? `${Math.round(diffSec / 3600)} h ago`
          : t.toLocaleDateString();
  return `${clock} · ${rel}`;
}

const CONFIRMED_EVIDENCE_RE = /^(email after|balance after|confirmed after)\s/i;

/** Has any run in this report already seen this brand's deposit land? */
function depositConfirmedLocally(
  a: ResearchAction,
): { via: "email" | "site"; subject: string | null } | null {
  const project = getResearchProject(a.projectId);
  if (!project) return null;
  for (const run of [...project.runs].reverse()) {
    if (run.brandId !== a.brandId) continue;
    const stage = run.stages.find((s) => s.stageId === "deposit_confirmation");
    const evidence = stage?.evidence ?? "";
    if (!stage?.endedAt || !CONFIRMED_EVIDENCE_RE.test(evidence)) continue;
    const isEmail = /^email after/i.test(evidence);
    return {
      via: isEmail ? "email" : "site",
      subject: isEmail ? evidence.replace(/^email after \d+m:\s*/i, "") : null,
    };
  }
  return null;
}

function statusLabel(a: ResearchAction) {
  if (a.kind === "sms_assist") {
    switch (a.status) {
      case "pending":
        return "Needs SMS code";
      case "code_submitted":
        return "Code submitted";
      case "confirmed":
        return "SMS done";
      default:
        return a.status;
    }
  }
  switch (a.status) {
    case "pending":
      return "Needs payment";
    case "payment_sent":
      return "Payment sent — confirming";
    case "confirming":
      return "Confirming…";
    case "confirmed":
      return "Confirmed";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
    default:
      return a.status;
  }
}

export function ResearchNotificationsPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [actions, setActions] = useState<ResearchAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [smsDraft, setSmsDraft] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());

  const dismiss = useCallback(async (actionId: string, reason: string) => {
    await fetch(
      `/api/research/actions/${actionId}?reason=${encodeURIComponent(reason)}`,
      { method: "DELETE" },
    ).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/research/actions");
      const data = await res.json();
      const list = (data.actions ?? []) as ResearchAction[];
      // Requests from a report you deleted can't be acted on — drop them so
      // you never pay into a run that no longer exists.
      const orphaned = list.filter(
        (a) => a.status === "pending" && !getResearchProject(a.projectId),
      );
      if (orphaned.length) {
        await Promise.all(orphaned.map((a) => dismiss(a.id, "Report deleted")));
      }
      const orphanIds = new Set(orphaned.map((a) => a.id));
      // A resumed run confirms the deposit under a new job id, so the
      // original request can be left saying "Confirming…". The report's own
      // run is the source of truth — close the request from it.
      const stale = list.filter(
        (a) =>
          a.kind === "manual_deposit" &&
          (a.status === "payment_sent" || a.status === "confirming") &&
          depositConfirmedLocally(a),
      );
      await Promise.all(
        stale.map((a) => {
          const proof = depositConfirmedLocally(a)!;
          return fetch(`/api/research/actions/${a.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "confirmed",
              confirmedVia: proof.via,
              emailSubject: proof.subject,
            }),
          }).catch(() => {});
        }),
      );
      const staleIds = new Set(stale.map((a) => a.id));
      setActions(
        list
          .filter((a) => !orphanIds.has(a.id))
          .map((a) =>
            staleIds.has(a.id)
              ? {
                  ...a,
                  status: "confirmed" as const,
                  confirmedAt: a.confirmedAt ?? new Date().toISOString(),
                  confirmedVia:
                    a.confirmedVia ?? depositConfirmedLocally(a)!.via,
                }
              : a,
          ),
      );
      setNow(Date.now());
    } finally {
      setLoading(false);
    }
  }, [dismiss]);

  useEffect(() => {
    if (!open) return;
    void load();
    const id = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(id);
  }, [open, load]);

  async function markPaid(actionId: string, mode: "paid" | "skip" = "paid") {
    setPayingId(actionId);
    try {
      await fetch(`/api/research/actions/${actionId}/paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      await load();
    } finally {
      setPayingId(null);
    }
  }

  async function submitSms(actionId: string) {
    const code = (smsDraft[actionId] ?? "").trim();
    if (!code) return;
    setPayingId(actionId);
    try {
      const res = await fetch(`/api/research/actions/${actionId}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setSmsDraft((d) => {
        const next = { ...d };
        delete next[actionId];
        return next;
      });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not submit SMS code");
    } finally {
      setPayingId(null);
    }
  }

  const pending = actions.filter((a) => a.status === "pending").length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="research-root w-full gap-0 border-[var(--rs-border)] bg-[var(--rs-bg)] p-0 text-[var(--rs-fg)] sm:max-w-md"
      >
        <SheetHeader className="border-b border-[var(--rs-border)] p-4 text-left">
          <SheetTitle className="font-heading text-lg">
            Needs your attention
          </SheetTitle>
          <SheetDescription className="text-[var(--rs-muted)]">
            {pending > 0
              ? `${pending} item${pending === 1 ? "" : "s"} waiting — SMS codes or deposit payments.`
              : "SMS codes and deposit addresses from Research runs appear here."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-[var(--rs-muted)]">Loading…</p>
          ) : actions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--rs-border)] p-6 text-center text-sm text-[var(--rs-muted)]">
              Nothing pending. SMS and deposit pauses show up here.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {actions.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{a.brandName}</p>
                      <p className="text-xs text-[var(--rs-muted)]">
                        {a.kind === "sms_assist" ? "SMS · " : "Deposit · "}
                        {statusLabel(a)}
                        {a.confirmedVia ? ` · via ${a.confirmedVia}` : null}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-[var(--rs-muted)]">
                        {formatWhen(a.createdAt, now)}
                        {a.notes ? ` · ${a.notes}` : null}
                      </p>
                    </div>
                    {a.liveViewUrl ? (
                      <a
                        href={a.liveViewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[var(--rs-accent)]"
                      >
                        Live
                      </a>
                    ) : null}
                  </div>
                  {a.kind === "sms_assist" ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-[var(--rs-fg)]">
                        {a.smsPrompt ?? "Paste the SMS code from your phone."}
                      </p>
                      {a.phoneHint ? (
                        <p className="font-mono text-[11px] text-[var(--rs-muted)]">
                          {a.phoneHint}
                        </p>
                      ) : null}
                      {a.status === "pending" ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="Code"
                            value={smsDraft[a.id] ?? ""}
                            onChange={(e) =>
                              setSmsDraft((d) => ({
                                ...d,
                                [a.id]: e.target.value,
                              }))
                            }
                            className="min-w-0 flex-1 rounded-lg border border-[var(--rs-border)] bg-[var(--rs-bg)] px-2 py-2 font-mono text-sm"
                          />
                          <button
                            type="button"
                            disabled={
                              payingId === a.id ||
                              !(smsDraft[a.id] ?? "").trim()
                            }
                            onClick={() => void submitSms(a.id)}
                            className="shrink-0 rounded-lg bg-[var(--rs-accent)] px-3 py-2 text-sm font-medium text-[var(--rs-bg)] disabled:opacity-50"
                          >
                            {payingId === a.id ? "…" : "Submit"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {a.kind === "manual_deposit" && a.depositAddress ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--rs-muted)]">
                        Bitcoin (BTC)
                        {a.network ? ` · ${a.network}` : ""}
                      </p>
                      {a.qrUrl ? (
                        <div className="flex items-start gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element -- runtime evidence file */}
                          <img
                            src={a.qrUrl}
                            alt={`QR code for ${a.brandName} deposit address`}
                            className="size-28 shrink-0 rounded-lg border border-[var(--rs-border)] bg-white object-contain p-1"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-[var(--rs-muted)]">
                              Scan from the site, or copy the address below.
                            </p>
                            <code className="mt-1 block break-all rounded-lg bg-[var(--rs-bg)] px-2 py-2 text-[11px]">
                              {a.depositAddress}
                            </code>
                          </div>
                        </div>
                      ) : (
                        <code className="block break-all rounded-lg bg-[var(--rs-bg)] px-2 py-2 text-[11px]">
                          {a.depositAddress}
                        </code>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void navigator.clipboard.writeText(
                              a.depositAddress!,
                            )
                          }
                          className="cursor-pointer rounded-lg border border-[var(--rs-border)] px-2 py-1 text-[11px] text-[var(--rs-fg)]"
                        >
                          Copy address
                        </button>
                        {a.amountHint ? (
                          <span className="text-xs text-[var(--rs-muted)]">
                            Send {a.amountHint}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--rs-muted)]">
                            Send the site minimum in BTC
                          </span>
                        )}
                      </div>
                    </div>
                  ) : null}
                  {a.emailSubject ? (
                    <p className="mt-2 text-xs text-[var(--rs-muted)]">
                      Email: {a.emailSubject}
                    </p>
                  ) : null}
                  {a.kind === "manual_deposit" && a.status === "pending" ? (
                    <button
                      type="button"
                      disabled={payingId === a.id}
                      onClick={() => void markPaid(a.id)}
                      className="mt-3 w-full rounded-lg bg-[var(--rs-accent)] px-3 py-2 text-sm font-medium text-[var(--rs-bg)] disabled:opacity-50"
                    >
                      {payingId === a.id
                        ? "Notifying agent…"
                        : "I've sent payment"}
                    </button>
                  ) : null}
                  {a.kind === "manual_deposit" && a.status === "pending" ? (
                    <button
                      type="button"
                      disabled={payingId === a.id}
                      onClick={() => {
                        if (
                          !confirm(
                            `Skip the ${a.brandName} deposit for this run? No funds are sent — the agent clicks the site's "I've paid", records what happens for 2 min, then carries on to the next steps. Nothing after this point is scored.`,
                          )
                        ) {
                          return;
                        }
                        void markPaid(a.id, "skip");
                      }}
                      className="mt-2 w-full rounded-lg border border-dashed border-amber-500/40 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
                    >
                      Skip deposit — test the rest of the flow
                    </button>
                  ) : null}
                  {a.status !== "pending" ? (
                    <button
                      type="button"
                      disabled={payingId === a.id}
                      onClick={() => {
                        setPayingId(a.id);
                        void dismiss(a.id, "Removed")
                          .then(load)
                          .finally(() => setPayingId(null));
                      }}
                      className="mt-2 w-full rounded-lg border border-[var(--rs-border)] px-3 py-1.5 text-xs text-[var(--rs-muted)] hover:text-[var(--rs-fg)] disabled:opacity-50"
                    >
                      Remove notification
                    </button>
                  ) : null}
                  {a.status === "pending" ? (
                    <button
                      type="button"
                      disabled={payingId === a.id}
                      onClick={() => {
                        if (
                          a.kind === "manual_deposit" &&
                          !confirm(
                            `Dismiss this ${a.brandName} deposit request? The paused agent run will stop and its browser will close.`,
                          )
                        ) {
                          return;
                        }
                        setPayingId(a.id);
                        void dismiss(a.id, "Dismissed")
                          .then(load)
                          .finally(() => setPayingId(null));
                      }}
                      className="mt-2 w-full rounded-lg border border-[var(--rs-border)] px-3 py-1.5 text-xs text-[var(--rs-muted)] hover:text-[var(--rs-fg)] disabled:opacity-50"
                    >
                      {a.kind === "manual_deposit"
                        ? "Dismiss — don't pay this one"
                        : "Dismiss"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
