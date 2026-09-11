"use client";

import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { FrameThumb } from "@/components/research-frame-viewer";
import {
  balanceIsZero,
  chainStatusLabel,
  destinationLabel,
  reconcilePostDeposit,
} from "@/lib/research/post-deposit";
import type {
  DepositWatchEntry,
  PlayerDestination,
  PostDepositObservation,
  ResearchProject,
} from "@/lib/research/types";
import { cn } from "@/lib/utils";

function hostOf(url: string | null | undefined): string {
  if (!url) return "—";
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.hostname.replace(/^www\./, "")}${path}`.slice(0, 60);
  } catch {
    return url.slice(0, 60);
  }
}

export function DestPill({
  d,
  label,
}: {
  d: PlayerDestination | null | undefined;
  label?: string;
}) {
  const tone =
    d === "casino"
      ? "bg-emerald-500/15 text-emerald-300"
      : d === "sportsbook"
        ? "bg-red-500/15 text-red-300"
        : d === "bonus"
          ? "bg-violet-500/15 text-violet-300"
          : d === "cashier"
            ? "bg-amber-500/15 text-amber-200"
            : "bg-[var(--rs-border)] text-[var(--rs-muted)]";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        tone,
      )}
    >
      {label ?? destinationLabel(d)}
    </span>
  );
}

function fmtAfter(sec: number): string {
  if (sec < 90) return `${sec}s`;
  return `${Math.round(sec / 60)}m`;
}

/**
 * Live timeline from "I've paid" until funds land — how long did the player
 * sit on $0.00 with no email and no alert? Renders while the agent is still
 * watching and stays on the report afterwards.
 */
export function DepositWatchTimeline({
  entries,
  live,
  confirmed,
}: {
  entries: DepositWatchEntry[];
  live: boolean;
  confirmed: boolean;
}) {
  if (!entries.length) return null;
  const last = entries[entries.length - 1]!;
  const landedAt = confirmed ? last.afterSec : null;
  const chain = last.chain ?? null;
  const senderSide = !confirmed && chain === "none";
  return (
    <section className="rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Waiting for funds</h3>
          <p className="mt-0.5 text-[11px] text-[var(--rs-muted)]">
            What the player sees between sending BTC and the balance moving.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            confirmed
              ? "bg-emerald-500/15 text-emerald-300"
              : live || senderSide
                ? "bg-amber-500/15 text-amber-200"
                : "bg-red-500/15 text-red-300",
          )}
        >
          {live && !confirmed ? (
            <span className="rs-live-dot size-1.5 rounded-full bg-amber-300" />
          ) : null}
          {confirmed
            ? `Landed after ${fmtAfter(landedAt ?? 0)}`
            : live
              ? `Watching · ${fmtAfter(last.afterSec)} so far`
              : senderSide
                ? "Payment never sent — not scored"
                : `Not credited after ${fmtAfter(last.afterSec)}`}
        </span>
      </div>

      <ol className="mt-3 flex flex-col divide-y divide-[var(--rs-border)]/60">
        {entries.map((e, i) => {
          const isLast = i === entries.length - 1;
          const zero = balanceIsZero(e.balance);
          return (
            <li
              key={`${e.afterSec}-${i}`}
              className="grid grid-cols-[56px_1fr_auto] items-center gap-3 py-2 text-xs"
            >
              <span className="font-mono text-[11px] tabular-nums text-[var(--rs-muted)]">
                T+{fmtAfter(e.afterSec)}
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    zero || !e.balance
                      ? "text-[var(--rs-fg)]"
                      : "text-emerald-300",
                  )}
                >
                  {e.balance ?? "balance not shown"}
                </span>
                <span className="text-[var(--rs-muted)]">
                  {e.emails} email{e.emails === 1 ? "" : "s"}
                </span>
                <span className="text-[var(--rs-muted)]">
                  {e.alert ? `alert: “${e.alert.slice(0, 60)}”` : "no alert"}
                </span>
                {e.chain ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px]",
                      e.chain === "confirmed"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : e.chain === "mempool"
                          ? "bg-amber-500/15 text-amber-200"
                          : "bg-[var(--rs-border)] text-[var(--rs-muted)]",
                    )}
                    title="Public chain view of the deposit address (mempool.space)"
                  >
                    {chainStatusLabel(e.chain)}
                  </span>
                ) : null}
                {isLast && confirmed ? (
                  <span className="text-emerald-300">funds landed</span>
                ) : null}
              </span>
              {e.screenshotUrl ? (
                <FrameThumb
                  src={e.screenshotUrl}
                  alt={`T+${fmtAfter(e.afterSec)}`}
                  className="h-12 w-12"
                />
              ) : (
                <span />
              )}
            </li>
          );
        })}
      </ol>
      {senderSide ? (
        <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-[var(--rs-fg)]">
          Nothing has reached the deposit address on-chain yet — the transfer is
          still on the sender&apos;s side (bank / exchange KYC). The brand
          isn&apos;t being scored for this wait.
        </p>
      ) : !confirmed && !live ? (
        <p className="mt-3 rounded-lg border border-red-500/25 bg-red-500/5 p-3 text-xs text-[var(--rs-fg)]">
          {chain === "confirmed"
            ? "Payment was confirmed on-chain and the brand still hadn't credited it — "
            : chain === "mempool"
              ? "Payment was broadcast and awaiting confirmation — "
              : "Payment couldn't be verified on-chain — "}
          the player was left on {last.balance ?? "an empty balance"} for{" "}
          {fmtAfter(last.afterSec)} with no pending-deposit state, no email, no
          alert.
        </p>
      ) : null}
    </section>
  );
}

/** Per-brand: what happened the moment funds landed. Same card language as
 * After signup / overview — one border, definition rows, no nested tiles. */
export function PostDepositCard({
  obs: raw,
  brandName,
}: {
  obs: PostDepositObservation;
  brandName: string;
}) {
  const obs = reconcilePostDeposit(raw);
  const routed = obs.guidedTo ?? obs.popup.ctaTarget ?? obs.landedOn;
  const credited =
    obs.confirmedVia === "site" && (obs.creditedAfterSec ?? 0) === 0
      ? "On-site"
      : obs.creditedAfterSec != null
        ? `${fmtAfter(obs.creditedAfterSec)} via ${obs.confirmedVia ?? "site"}`
        : "Not confirmed";
  const shot = obs.screenshotUrls[0];

  return (
    <section className="rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">After deposit</h3>
          <p className="mt-0.5 text-[11px] text-[var(--rs-muted)]">
            Where {brandName} sends you after the money lands.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--rs-muted)]">
          Opens <DestPill d={routed} />
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
            <dt className="text-[var(--rs-muted)]">Credited</dt>
            <dd>{credited}</dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-3 py-2 sm:grid-cols-[150px_1fr]">
            <dt className="text-[var(--rs-muted)]">Landed on</dt>
            <dd className="flex flex-wrap items-center gap-1.5">
              <DestPill d={obs.landedOn} />
              <span className="font-mono text-[10px] text-[var(--rs-muted)]">
                {hostOf(obs.landingUrl)}
              </span>
            </dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-3 py-2 sm:grid-cols-[150px_1fr]">
            <dt className="text-[var(--rs-muted)]">On-site alert</dt>
            <dd>
              {obs.balanceAlert.seen ? (
                <span>“{obs.balanceAlert.text}”</span>
              ) : (
                <span className="text-[var(--rs-muted)]">None</span>
              )}
            </dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-3 py-2 sm:grid-cols-[150px_1fr]">
            <dt className="text-[var(--rs-muted)]">Next step offered</dt>
            <dd className="flex flex-wrap items-center gap-1.5">
              {obs.popup.seen && obs.popup.cta ? (
                <>
                  <span className="rounded-md border border-[var(--rs-border)] px-1.5 py-0.5 text-[10px]">
                    {obs.popup.cta}
                  </span>
                  <span className="text-[var(--rs-muted)]">→</span>
                  <DestPill d={obs.popup.ctaTarget} />
                </>
              ) : (
                <span className="text-[var(--rs-muted)]">
                  {obs.guidance ?? "None"}
                </span>
              )}
            </dd>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-3 py-2 sm:grid-cols-[150px_1fr]">
            <dt className="text-[var(--rs-muted)]">Emails</dt>
            <dd>
              {obs.emails.length === 0 ? (
                <span className="text-[var(--rs-muted)]">None in window</span>
              ) : (
                <ul className="flex flex-col gap-2">
                  {obs.emails.map((e) => (
                    <li key={`${e.subject}-${e.receivedAfterSec}`}>
                      <span className="font-medium">{e.subject}</span>
                      <span className="text-[var(--rs-muted)]">
                        {" "}
                        · +{fmtAfter(e.receivedAfterSec)}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <DestPill d={e.linkTarget} />
                        {e.resolvedUrl ? (
                          <a
                            href={e.resolvedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate font-mono text-[10px] text-[var(--rs-muted)] hover:text-[var(--rs-fg)]"
                            title={e.resolvedUrl}
                          >
                            {hostOf(e.resolvedUrl)}
                          </a>
                        ) : (
                          <span className="text-[10px] text-[var(--rs-muted)]">
                            no brand link
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>

        {shot ? (
          <FrameThumb
            src={shot}
            alt="After deposit"
            className="h-[200px] w-[140px] self-start"
          />
        ) : null}
      </div>

      {routed === "sportsbook" ? (
        <p className="mt-3 text-xs text-[var(--rs-fg)]">
          Start playing opens sports, not casino.
        </p>
      ) : obs.okrFlags.length ? (
        <div className="mt-3 rounded-lg border border-red-500/25 bg-red-500/5 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-red-300">
            Raise — OKR conflicts
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-[var(--rs-fg)]">
            {obs.okrFlags.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-red-300" />
                <span className="leading-snug">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-xs text-[var(--rs-accent)]">
          Deposit lands and they tell you.
        </p>
      )}

      {obs.screenshotUrls.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {obs.screenshotUrls.slice(1).map((src, i) => (
            <ScreenshotLightbox
              key={src}
              src={src}
              alt={`After deposit ${i + 2}`}
              className="h-14 w-10 shrink-0 rounded-md ring-1 ring-white/20"
              frame="phone"
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** Side-by-side: do competitors do something different after deposit? */
export function PostDepositComparison({
  project,
}: {
  project: ResearchProject;
}) {
  const rows = project.brands
    .map((b) => {
      const run = [...project.runs]
        .reverse()
        .find((r) => r.brandId === b.id && r.postDeposit);
      return run?.postDeposit ? { brand: b, obs: run.postDeposit } : null;
    })
    .filter(Boolean) as {
    brand: ResearchProject["brands"][number];
    obs: PostDepositObservation;
  }[];

  if (rows.length === 0) {
    return (
      <div>
        <h2 className="font-heading text-lg font-medium">After deposit</h2>
        <p className="mt-1 text-sm text-[var(--rs-muted)]">
          Appears once a brand has been funded — where they send the player,
          whether they confirm it, what they email, and OKR conflicts.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-heading text-lg font-medium">After deposit</h2>
      <p className="mt-1 text-sm text-[var(--rs-muted)]">
        The moment funds land: where each brand steers the player, how they
        confirm it, and what the deposit email links to.
      </p>
      <div className="rs-table-wrap mt-4">
        <table className="rs-table rs-fixed min-w-[1080px]">
          <colgroup>
            <col style={{ width: 150 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 90 }} />
            <col />
            <col style={{ width: 170 }} />
            <col style={{ width: 200 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Brand</th>
              <th className="rs-num">Credited</th>
              <th>Steers to</th>
              <th>On-site alert</th>
              <th>Popup / CTA</th>
              <th>Email link →</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ brand, obs: raw }) => {
              const obs = reconcilePostDeposit(raw);
              const routed =
                obs.guidedTo ?? obs.popup.ctaTarget ?? obs.landedOn;
              const mail = obs.emails[0];
              return (
                <tr key={brand.id}>
                  <td>
                    <span className="font-medium">{brand.name}</span>
                    {brand.role === "own_brand" ? (
                      <span className="ml-1 text-[10px] text-[var(--rs-muted)]">
                        you
                      </span>
                    ) : null}
                  </td>
                  <td className="rs-num">
                    {obs.creditedAfterSec != null
                      ? `${obs.creditedAfterSec}s`
                      : "—"}
                  </td>
                  <td>
                    <DestPill d={routed} />
                  </td>
                  <td>
                    {obs.balanceAlert.seen ? (
                      "Yes"
                    ) : (
                      <span className="text-[var(--rs-muted)]">None</span>
                    )}
                  </td>
                  <td>
                    {obs.popup.seen ? (
                      <span>
                        {obs.popup.cta ? `“${obs.popup.cta}” → ` : "Popup → "}
                        <DestPill d={obs.popup.ctaTarget} />
                      </span>
                    ) : (
                      <span className="text-[var(--rs-muted)]">None</span>
                    )}
                  </td>
                  <td>
                    {mail ? (
                      <span className="flex flex-col gap-0.5">
                        <DestPill d={mail.linkTarget} />
                        <span className="font-mono text-[10px] text-[var(--rs-muted)]">
                          {hostOf(mail.resolvedUrl)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[var(--rs-muted)]">No email</span>
                    )}
                  </td>
                  <td>
                    {obs.okrFlags.length ? (
                      <span className="text-red-300">
                        {obs.okrFlags.length} · {obs.okrFlags[0]!.slice(0, 70)}…
                      </span>
                    ) : (
                      <span className="text-[var(--rs-accent)]">Clean</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
