"use client";

import { useEffect, useRef, useState } from "react";
import { playResearchAlertChime } from "@/lib/research/alert-sound";
import type { ResearchAction } from "@/lib/research/types";

const ALERTED_KEY = "scuup-research-alerted-actions";

function readAlerted(): Set<string> {
  try {
    const raw = window.localStorage.getItem(ALERTED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeAlerted(ids: Set<string>) {
  try {
    window.localStorage.setItem(
      ALERTED_KEY,
      JSON.stringify([...ids].slice(-200))
    );
  } catch {
    /* ignore */
  }
}

function fireBrowserNotify(title: string, body: string, tag: string) {
  if (typeof Notification === "undefined") return;
  const fire = () => {
    try {
      new Notification(title, { body, tag });
    } catch {
      /* ignore */
    }
  };
  if (Notification.permission === "granted") fire();
  else if (Notification.permission === "default") {
    void Notification.requestPermission().then((p) => {
      if (p === "granted") fire();
    });
  }
}

function browserNotify(a: ResearchAction) {
  const title =
    a.kind === "manual_deposit"
      ? `BTC address ready — ${a.brandName}`
      : `SMS code needed — ${a.brandName}`;
  const body =
    a.kind === "manual_deposit"
      ? `${a.amountHint ?? "Send the site minimum in BTC"}\n${a.depositAddress ?? ""}`
      : (a.smsPrompt ?? "Paste the SMS code in Notifications");
  fireBrowserNotify(title, body, `rsa-${a.id}`);
}

function browserNotifyLanded(a: ResearchAction) {
  fireBrowserNotify(
    `Funds landed — ${a.brandName}`,
    a.balanceSeen
      ? `Balance ${a.balanceSeen}${a.emailSubject ? ` · ${a.emailSubject}` : ""}`
      : (a.emailSubject ?? "Deposit confirmed"),
    `rsa-${a.id}-landed`,
  );
}

/**
 * Pending Research action count (deposits / SMS) for the sidebar badge.
 * Fires `onNewAction` once per new pending item — with a chime and a browser
 * notification — so a captured BTC address is impossible to miss.
 */
export function usePendingResearchActions(opts?: {
  onNewAction?: (action: ResearchAction) => void;
}): number {
  const [count, setCount] = useState(0);
  const onNew = useRef(opts?.onNewAction);
  onNew.current = opts?.onNewAction;

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/research/actions");
        const data = await res.json();
        if (cancelled) return;
        setCount(data.pendingCount ?? 0);

        const actions = (data.actions ?? []) as ResearchAction[];
        const alerted = readAlerted();
        let changed = false;
        for (const a of actions) {
          if (a.status === "pending") {
            if (a.kind === "manual_deposit" && !a.depositAddress) continue;
            if (alerted.has(a.id)) continue;
            alerted.add(a.id);
            changed = true;
            playResearchAlertChime();
            browserNotify(a);
            onNew.current?.(a);
            continue;
          }
          const landedAt = a.confirmedAt ? Date.parse(a.confirmedAt) : NaN;
          const landedRecently =
            Number.isFinite(landedAt) && Date.now() - landedAt < 2 * 60 * 60 * 1000;
          if (
            a.kind === "manual_deposit" &&
            a.status === "confirmed" &&
            landedRecently &&
            !alerted.has(`${a.id}:landed`)
          ) {
            alerted.add(`${a.id}:landed`);
            changed = true;
            playResearchAlertChime();
            browserNotifyLanded(a);
          }
        }
        if (changed) writeAlerted(alerted);
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = window.setInterval(tick, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return count;
}
