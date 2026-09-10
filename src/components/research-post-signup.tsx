"use client";

import { FrameThumb } from "@/components/research-frame-viewer";
import { DestPill } from "@/components/research-post-deposit";
import { welcomeTouchLabel } from "@/lib/research/post-signup";
import type { PostSignupObservation } from "@/lib/research/types";
import { cn } from "@/lib/utils";

/**
 * Where they put you when the account exists — landing, greeting, mail.
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
            Where {brandName} puts you when the account exists.
          </p>
        </div>
        {obs.landedOn ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--rs-muted)]">
            Lands on <DestPill d={obs.landedOn} />
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              w.seen
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-[var(--rs-border)] text-[var(--rs-muted)]",
            )}
          >
            {w.seen ? "Welcome touch" : "No greeting"}
          </span>
        )}
      </div>

      <div
        className={cn(
          "mt-3 grid gap-4",
          shot ? "sm:grid-cols-[minmax(0,1fr)_140px]" : "",
        )}
      >
        <dl className="divide-y divide-[var(--rs-border)]/60 text-xs">
          {obs.landedOn ? (
            <div className="grid grid-cols-[120px_1fr] gap-3 py-2 sm:grid-cols-[150px_1fr]">
              <dt className="text-[var(--rs-muted)]">Landed on</dt>
              <dd>
                <DestPill d={obs.landedOn} />
              </dd>
            </div>
          ) : null}
          <div className="grid grid-cols-[120px_1fr] gap-3 py-2 sm:grid-cols-[150px_1fr]">
            <dt className="text-[var(--rs-muted)]">Greeting</dt>
            <dd>{welcomeTouchLabel(obs) ?? "None"}</dd>
          </div>
          {w.seen && w.text ? (
            <div className="grid grid-cols-[120px_1fr] gap-3 py-2 sm:grid-cols-[150px_1fr]">
              <dt className="text-[var(--rs-muted)]">Message</dt>
              <dd className="whitespace-pre-line text-[var(--rs-fg)]">
                {w.text.slice(0, 420)}
                {w.text.length > 420 ? "…" : ""}
              </dd>
            </div>
          ) : null}
          <div className="grid grid-cols-[120px_1fr] gap-3 py-2 sm:grid-cols-[150px_1fr]">
            <dt className="text-[var(--rs-muted)]">Welcome email</dt>
            <dd>
              {welcomeEmailSubject ? (
                <span>“{welcomeEmailSubject}”</span>
              ) : (
                <span className="text-[var(--rs-muted)]">None</span>
              )}
            </dd>
          </div>
        </dl>
        {shot ? (
          <FrameThumb
            src={shot}
            alt="After signup"
            className="h-[200px] w-[140px] self-start"
          />
        ) : null}
      </div>
    </section>
  );
}
