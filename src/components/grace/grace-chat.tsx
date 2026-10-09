"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";

export interface ChatFacts {
  month: string;
  filter: string;
  matchingCount: number;
  monthTotal: number;
  avgRating: number;
  sentiment: number;
  officialScore: number | null;
  pokerScore: number | null;
  pokerCount: number;
  topics: string[];
  current: {
    headline: string;
    period: string[];
    positive: string;
    negative: string;
    mix: string;
  };
}

export interface ChatPatch {
  headline?: string;
  period?: string[];
  positive?: string;
  negative?: string;
  mix?: string;
}

type Turn = { role: "user" | "assistant"; text: string; applied?: string[] };

export function GraceChat({
  brand,
  facts,
  onApply,
}: {
  brand: string;
  facts: ChatFacts;
  onApply: (patch: ChatPatch) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [turns, open]);

  const send = async () => {
    const message = draft.trim();
    if (!message || busy) return;
    setDraft("");
    setError(null);
    const nextTurns = [...turns, { role: "user" as const, text: message }];
    setTurns(nextTurns);
    setBusy(true);
    try {
      const res = await fetch("/api/grace/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          brand,
          history: nextTurns.slice(-8).map((t) => ({ role: t.role, text: t.text })),
          facts,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chat failed");
      const patch: ChatPatch = {};
      const applied: string[] = [];
      if (data.apply) {
        if (data.headline) {
          patch.headline = data.headline;
          applied.push("headline");
        }
        if (data.period) {
          const lines = String(data.period)
            .split("\n")
            .map((s: string) => s.trim())
            .filter(Boolean);
          if (lines.length) {
            patch.period = lines;
            applied.push("period");
          }
        }
        if (data.positive) {
          patch.positive = data.positive;
          applied.push("positive");
        }
        if (data.negative) {
          patch.negative = data.negative;
          applied.push("negative");
        }
        if (data.mix) {
          patch.mix = data.mix;
          applied.push("mix");
        }
        if (applied.length) onApply(patch);
      }
      setTurns((prev) => [
        ...prev,
        { role: "assistant", text: String(data.reply ?? ""), applied },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gr-no-print gr-chat">
      {open ? (
        <div className="gr-chat-panel">
          <div className="gr-chat-head">
            <div>
              <p className="text-[13px] font-semibold text-[#191919]">Ask about this report</p>
              <p className="text-[11px] text-[#8a9198]">Explain a number, or tell me to rewrite a line.</p>
            </div>
            <button type="button" className="gr-icon-sq" onClick={() => setOpen(false)} aria-label="Close chat">
              <X className="size-3.5" />
            </button>
          </div>
          <div ref={scroller} className="gr-chat-log">
            {turns.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-[#8a9198]">
                Try “why does the briefing say 26 reviews?” or “rewrite the negative paragraph so it only talks about the {facts.matchingCount} matching reviews.”
              </p>
            ) : null}
            {turns.map((t, i) => (
              <div key={`${t.role}-${i}`} className="gr-chat-turn" data-role={t.role}>
                <p>{t.text}</p>
                {t.applied?.length ? (
                  <p className="mt-1 text-[11px] text-[#00b67a]">Updated {t.applied.join(", ")}.</p>
                ) : null}
              </div>
            ))}
            {busy ? (
              <p className="inline-flex items-center gap-1.5 text-[12px] text-[#8a9198]">
                <Loader2 className="size-3 animate-spin" /> Reading the report
              </p>
            ) : null}
            {error ? <p className="text-[12px] text-[#ff3722]">{error}</p> : null}
          </div>
          <form
            className="gr-chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask or rewrite…"
              disabled={busy}
            />
            <button type="submit" className="gr-icon-sq" disabled={busy || !draft.trim()} aria-label="Send">
              <Send className="size-3.5" />
            </button>
          </form>
        </div>
      ) : null}
      <button
        type="button"
        className="gr-chat-fab"
        data-open={String(open)}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close report chat" : "Ask about this report"}
      >
        {open ? <X className="size-5" /> : <Sparkles className="size-5" />}
      </button>
    </div>
  );
}
