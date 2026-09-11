"use client";

import { FrameThumb } from "@/components/research-frame-viewer";
import { DestPill } from "@/components/research-post-deposit";
import {
  knownSignupLanding,
  welcomeTouchLabel,
} from "@/lib/research/post-signup";
import type { PostSignupObservation } from "@/lib/research/types";

/**
 * First screen after the account exists — where they land, then greeting.
 */
export function PostSignupCard({
  obs: raw,
  brandName,
  welcomeEmailSubject,
}: {
  obs: PostSignupObservation;
  brandName: string;
  welcomeEmailSubject?: string | null;
}) {
  const known = knownSignupLanding(brandName);
  const obs: PostSignupObservation = {
    ...raw,
    landedOn: raw.landedOn ?? known?.landedOn,
    clicksToWallet: raw.clicksToWallet ?? known?.clicksToWallet ?? null,
  };
  const w = obs.welcome;
  const shot = obs.screenshotUrls[0];
  return (
    <section className="rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">After signup</h3>
          <p className="mt-0.5 text-[11px] text-[var(--rs-muted)]">
            First screen after the account exists — then how far to wallet.
          </p>
        </div>
        {obs.landedOn ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--rs-muted)]">
            Lands on{" "}
            <DestPill
              d={obs.landedOn}
              label={obs.landedOn === "cashier" ? "deposit" : undefined}
            />
          </span>
        ) : null}
      </div>

      <div
        className={`mt-3 grid gap-4 ${shot ? "sm:grid-cols-[minmax(0,1fr)_140px]" : ""}`}
      >
        <dl className="divide-y divide-[var(--rs-border)]/60 text-xs">
          <div className="grid grid-cols-[120px_1fr] gap-3 py-2 sm:grid-cols-[150px_1fr]">
            <dt className="text-[var(--rs-muted)]">Landed on</dt>
            <dd className="flex flex-wrap items-center gap-1.5">
              {obs.landedOn ? (
                <DestPill
                  d={obs.landedOn}
                  label={obs.landedOn === "cashier" ? "deposit" : undefined}
                />
              ) : (
                <span className="text-[var(--rs-muted)]">Not recorded</span>
              )}
              {obs.clicksToWallet != null && obs.clicksToWallet > 0 ? (
                <span className="text-[var(--rs-muted)]">
                  · {obs.clicksToWallet} click
                  {obs.clicksToWallet === 1 ? "" : "s"} to wallet
                </span>
              ) : null}
            </dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-3 py-2 sm:grid-cols-[150px_1fr]">
            <dt className="text-[var(--rs-muted)]">Clicks to wallet</dt>
            <dd>
              {obs.clicksToWallet == null
                ? "—"
                : obs.clicksToWallet === 0
                  ? "0 — already on deposit"
                  : String(obs.clicksToWallet)}
            </dd>
          </div>
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
