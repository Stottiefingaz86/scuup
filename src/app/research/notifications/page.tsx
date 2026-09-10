"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ResearchAction } from "@/lib/research/types";

function statusLabel(a: ResearchAction) {
  if (a.kind === "sms_assist") {
    switch (a.status) {
      case "pending":
        return "Needs SMS code";
      case "code_submitted":
        return "Code submitted — agent continuing";
      case "confirmed":
        return "SMS done";
      case "expired":
        return "Expired";
      case "cancelled":
        return "Cancelled";
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

export default function ResearchNotificationsPage() {
  const [actions, setActions] = useState<ResearchAction[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [smsDraft, setSmsDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/research/actions");
      const data = await res.json();
      setActions(data.actions ?? []);
      setPendingCount(data.pendingCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(id);
  }, [load]);

  async function markPaid(actionId: string) {
    setPayingId(actionId);
    try {
      await fetch(`/api/research/actions/${actionId}/paid`, { method: "POST" });
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-xs text-[var(--rs-muted)]">
          <Link href="/research" className="hover:text-[var(--rs-fg)]">
            Research
          </Link>
          {" / Notifications"}
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold">
          Needs your attention
        </h1>
        <p className="mt-1 text-sm text-[var(--rs-muted)]">
          Deposit addresses and SMS codes pause the agent here. Pay crypto or
          paste the text from your phone, then the run continues.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--rs-muted)]">Loading…</p>
      ) : actions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--rs-border)] p-8 text-center text-sm text-[var(--rs-muted)]">
          Nothing pending. When signup needs an SMS or deposit needs payment,
          it shows up here.
        </div>
      ) : (
        <>
          {actions.filter((a) => a.status === "pending").length > 1 ? (
            <p className="rounded-lg border border-[var(--rs-accent)]/30 bg-[var(--rs-accent)]/5 px-4 py-2 text-sm text-[var(--rs-fg)]">
              {actions.filter((a) => a.status === "pending").length} items
              waiting — handle each row separately.
            </p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {actions.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{a.brandName}</p>
                    <p className="text-xs text-[var(--rs-muted)]">
                      {a.kind === "sms_assist" ? "SMS assist · " : "Deposit · "}
                      {statusLabel(a)}
                      {a.confirmedVia ? ` · via ${a.confirmedVia}` : null}
                    </p>
                  </div>
                  {a.liveViewUrl ? (
                    <a
                      href={a.liveViewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[var(--rs-accent)]"
                    >
                      Live browser
                    </a>
                  ) : null}
                </div>

                {a.kind === "sms_assist" ? (
                  <div className="mt-3 rounded-lg bg-[var(--rs-bg)] p-3">
                    <p className="text-sm text-[var(--rs-fg)]">
                      {a.smsPrompt ??
                        "Paste the SMS verification code from your phone."}
                    </p>
                    {a.phoneHint ? (
                      <p className="mt-1 text-xs text-[var(--rs-muted)]">
                        Sent to{" "}
                        <span className="font-mono text-[var(--rs-fg)]">
                          {a.phoneHint}
                        </span>
                      </p>
                    ) : null}
                    {a.status === "pending" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="SMS code"
                          value={smsDraft[a.id] ?? ""}
                          onChange={(e) =>
                            setSmsDraft((d) => ({
                              ...d,
                              [a.id]: e.target.value,
                            }))
                          }
                          className="min-w-[8rem] flex-1 rounded-lg border border-[var(--rs-border)] bg-[var(--rs-card)] px-3 py-2 font-mono text-sm"
                        />
                        <button
                          type="button"
                          disabled={
                            payingId === a.id ||
                            !(smsDraft[a.id] ?? "").trim()
                          }
                          onClick={() => void submitSms(a.id)}
                          className="cursor-pointer rounded-lg bg-[var(--rs-accent)] px-3 py-2 text-sm font-medium text-[var(--rs-bg)] disabled:opacity-50"
                        >
                          {payingId === a.id ? "…" : "Submit code"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {a.kind === "manual_deposit" && a.depositAddress ? (
                  <div className="mt-3 rounded-lg bg-[var(--rs-bg)] p-3">
                    <p className="text-xs text-[var(--rs-muted)]">
                      Send {a.currency ?? "crypto"}
                      {a.network ? ` (${a.network})` : ""}
                      {a.amountHint ? ` · min ${a.amountHint}` : ""}
                    </p>
                    <p className="mt-1 break-all font-mono text-sm select-all">
                      {a.depositAddress}
                    </p>
                  </div>
                ) : null}

                {a.emailSubject ? (
                  <p className="mt-2 text-xs text-[var(--rs-muted)]">
                    Email: {a.emailSubject}
                  </p>
                ) : null}
                {a.balanceSeen ? (
                  <p className="mt-1 text-xs text-[var(--rs-muted)]">
                    Balance: {a.balanceSeen}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {a.kind === "manual_deposit" && a.status === "pending" ? (
                    <button
                      type="button"
                      disabled={payingId === a.id}
                      onClick={() => void markPaid(a.id)}
                      className="cursor-pointer rounded-lg bg-[var(--rs-accent)] px-3 py-1.5 text-sm font-medium text-[var(--rs-bg)] disabled:opacity-50"
                    >
                      {payingId === a.id ? "…" : "I've sent payment"}
                    </button>
                  ) : null}
                  <Link
                    href={`/research/projects/${a.projectId}`}
                    className="rounded-lg border border-[var(--rs-border)] px-3 py-1.5 text-sm text-[var(--rs-muted)] hover:text-[var(--rs-fg)]"
                  >
                    Open project
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {pendingCount > 0 ? (
        <p className="text-xs text-[var(--rs-accent)]">
          {pendingCount} item{pendingCount === 1 ? "" : "s"} still need attention
        </p>
      ) : null}
    </div>
  );
}
