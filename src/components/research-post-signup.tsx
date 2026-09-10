"use client";

import { MessageCircle, Sparkles } from "lucide-react";
import { FrameThumb } from "@/components/research-frame-viewer";
import { welcomeTouchLabel } from "@/lib/research/post-signup";
import type { PostSignupObservation } from "@/lib/research/types";
import { cn } from "@/lib/utils";

/**
 * Per-brand callout: did the brand greet the player after signup? Winna's
 * personalised "Hey <handle>, welcome…" chat message is the reference case —
 * a retention touch most operators skip.
 */
export function PostSignupCard({
  obs,
  brandName,
  welcomeEmailSubject,
}: {
  obs: PostSignupObservation;
  brandName: string;
  /** Subject of the first welcome email for this run, if any. */
  welcomeEmailSubject?: string | null;
}) {
  const w = obs.welcome;
  const shot = obs.screenshotUrls[0];
  return (
    <section className="rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">After signup</h3>
          <p className="mt-0.5 text-[11px] text-[var(--rs-muted)]">
            Does {brandName} say hello once the account exists — and how?
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            w.seen
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-[var(--rs-border)] text-[var(--rs-muted)]",
          )}
        >
          {w.seen ? <Sparkles className="size-3" /> : null}
          {w.seen ? "Welcome touch" : "No greeting seen"}
        </span>
      </div>

      <div
        className={cn(
          "mt-3 grid gap-4",
          shot ? "sm:grid-cols-[minmax(0,1fr)_140px]" : "",
        )}
      >
        <dl className="divide-y divide-[var(--rs-border)]/60 text-xs">
          <div className="grid grid-cols-[120px_1fr] gap-3 py-2 sm:grid-cols-[150px_1fr]">
            <dt className="text-[var(--rs-muted)]">Touch</dt>
            <dd>{welcomeTouchLabel(obs) ?? "—"}</dd>
          </div>
          {w.seen ? (
            <>
              <div className="grid grid-cols-[120px_1fr] gap-3 py-2 sm:grid-cols-[150px_1fr]">
                <dt className="text-[var(--rs-muted)]">Message</dt>
                <dd className="flex gap-2">
                  <MessageCircle className="mt-0.5 size-3.5 shrink-0 text-[var(--rs-muted)]" />
                  <span className="whitespace-pre-line text-[var(--rs-fg)]">
                    {(w.text ?? "").slice(0, 420)}
                    {(w.text ?? "").length > 420 ? "…" : ""}
                  </span>
                </dd>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3 py-2 sm:grid-cols-[150px_1fr]">
                <dt className="text-[var(--rs-muted)]">Personalised</dt>
                <dd>
                  {w.personalized
                    ? "Yes — uses the player's own handle / name"
                    : "No — generic copy"}
                </dd>
              </div>
              {w.ctas.length ? (
                <div className="grid grid-cols-[120px_1fr] gap-3 py-2 sm:grid-cols-[150px_1fr]">
                  <dt className="text-[var(--rs-muted)]">Next step offered</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {w.ctas.map((c) => (
                      <span
                        key={c}
                        className="rounded-md border border-[var(--rs-border)] px-1.5 py-0.5 text-[10px]"
                      >
                        {c}
                      </span>
                    ))}
                  </dd>
                </div>
              ) : null}
              <div className="grid grid-cols-[120px_1fr] gap-3 py-2 sm:grid-cols-[150px_1fr]">
                <dt className="text-[var(--rs-muted)]">Agent handling</dt>
                <dd className="text-[var(--rs-muted)]">
                  {w.dismissed === "clicked"
                    ? "Captured, then closed so it couldn't block the cashier"
                    : w.dismissed === "hidden"
                      ? "Captured, then hidden (no close control found)"
                      : "Captured — left on screen"}
                </dd>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-[120px_1fr] gap-3 py-2 sm:grid-cols-[150px_1fr]">
              <dt className="text-[var(--rs-muted)]">Gap</dt>
              <dd className="text-[var(--rs-muted)]">
                No chat greeting, welcome modal or banner while the agent was on
                site — the first human touch is left to email.
              </dd>
            </div>
          )}
          <div className="grid grid-cols-[120px_1fr] gap-3 py-2 sm:grid-cols-[150px_1fr]">
            <dt className="text-[var(--rs-muted)]">Welcome email</dt>
            <dd>
              {welcomeEmailSubject ? (
                <span>“{welcomeEmailSubject}”</span>
              ) : (
                <span className="text-[var(--rs-muted)]">None yet</span>
              )}
            </dd>
          </div>
        </dl>
        {shot ? (
          <FrameThumb
            src={shot}
            alt="Welcome touch"
            className="h-[200px] w-[140px] self-start"
          />
        ) : null}
      </div>
    </section>
  );
}
