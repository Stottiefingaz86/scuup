"use client";

import { useMemo, useState } from "react";
import {
  emailPreviewText,
  formatEmailReceivedAt,
} from "@/lib/research/email-format";
import type { EmailWatchItem } from "@/lib/research/types";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/** iPhone-class width — matches Research mobile journeys. */
const MOBILE_W = 390;

const CATEGORY_STYLE: Record<
  EmailWatchItem["category"],
  { label: string; className: string }
> = {
  verify: {
    label: "Confirm",
    className: "bg-sky-500/15 text-sky-300",
  },
  welcome: {
    label: "Welcome",
    className: "bg-emerald-500/15 text-emerald-300",
  },
  deposit_nudge: {
    label: "Deposit",
    className: "bg-amber-500/15 text-amber-200",
  },
  bonus: {
    label: "Bonus",
    className: "bg-violet-500/15 text-violet-300",
  },
  vip: {
    label: "VIP",
    className: "bg-fuchsia-500/15 text-fuchsia-300",
  },
  reactivation: {
    label: "Comeback",
    className: "bg-orange-500/15 text-orange-300",
  },
  other: {
    label: "Other",
    className: "bg-[var(--rs-border)] text-[var(--rs-muted)]",
  },
};

function shortFrom(from: string): string {
  const m = from.match(/@([^>]+)/);
  if (m) return m[1].replace(/^www\./, "");
  return from.length > 36 ? `${from.slice(0, 34)}…` : from;
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Mobile mail-client document. Forces a phone viewport so email media queries
 * and fixed-width tables reflow the way they do on a real device.
 */
function emailSrcDoc(opts: {
  html?: string;
  body?: string;
  subject: string;
  from: string;
}): string {
  const raw = opts.html?.trim() || "";
  const isFullDoc = /<html[\s>]/i.test(raw) || /<body[\s>]/i.test(raw);

  let mailBody: string;
  if (raw && isFullDoc) {
    const bodyMatch = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    mailBody = bodyMatch?.[1] ?? raw;
  } else if (raw) {
    mailBody = raw;
  } else {
    mailBody = `<pre style="margin:0;padding:16px;font:15px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;white-space:pre-wrap;word-break:break-word;color:#111">${escapeHtml(
      opts.body || ""
    )}</pre>`;
  }

  // Pull style/link tags from full HTML docs so brand CSS still applies.
  const headExtras = isFullDoc
    ? (raw.match(/<style[\s\S]*?<\/style>/gi) ?? []).join("\n") +
      (raw.match(/<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi) ?? []).join("\n")
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=${MOBILE_W}, initial-scale=1, maximum-scale=1"/>
<base target="_blank"/>
${headExtras}
<style>
html,body{margin:0;padding:0;width:100%;background:#fff;color:#111;-webkit-text-size-adjust:100%}
.mail-chrome{position:sticky;top:0;z-index:2;background:#fafafa;border-bottom:1px solid #e4e4e7;padding:10px 14px 8px;font:12px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#52525b}
.mail-chrome strong{display:block;font-size:14px;line-height:1.3;color:#18181b;margin-bottom:4px;font-weight:600}
.mail-body{width:100%;overflow-x:hidden}
.mail-body img{max-width:100%!important;height:auto!important}
.mail-body table{max-width:100%!important}
.mail-body td,.mail-body th{max-width:100%}
</style></head><body>
<div class="mail-chrome"><strong>${escapeHtml(
    opts.subject || "(no subject)"
  )}</strong>From ${escapeHtml(opts.from)}</div>
<div class="mail-body">${mailBody}</div>
</body></html>`;
}

function EmailRenderFrame({
  srcDoc,
  title,
  height,
}: {
  srcDoc: string;
  title: string;
  height: number;
}) {
  return (
    <iframe
      title={title}
      srcDoc={srcDoc}
      sandbox=""
      referrerPolicy="no-referrer"
      width={MOBILE_W}
      style={{
        height,
        width: MOBILE_W,
        maxWidth: "100%",
        border: 0,
        background: "#fff",
        display: "block",
      }}
    />
  );
}

/** Phone shell so the message reads as mobile inbox, not a desktop pane. */
function MobileEmailFrame({
  srcDoc,
  title,
  height,
  interactive,
}: {
  srcDoc: string;
  title: string;
  height: number;
  interactive?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-[390px]">
      <div className="overflow-hidden rounded-[1.35rem] border border-zinc-700/80 bg-zinc-900 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-center gap-1.5 bg-zinc-900 px-3 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
          <span className="h-1 w-16 rounded-full bg-zinc-700" />
        </div>
        <div
          className={
            interactive ? "overflow-auto bg-white" : "overflow-hidden bg-white"
          }
          style={{ height }}
        >
          <EmailRenderFrame srcDoc={srcDoc} title={title} height={height} />
        </div>
        <div className="flex justify-center bg-zinc-900 py-2.5">
          <span className="h-1 w-24 rounded-full bg-zinc-600" />
        </div>
      </div>
    </div>
  );
}

/**
 * Small "as the player sees it" thumbnail for the evidence strip — the real
 * rendered email scaled down, click for the full mobile view.
 */
export function ResearchEmailThumb({
  email,
  width = 168,
  height = 112,
  bare = false,
}: {
  email: EmailWatchItem;
  width?: number;
  height?: number;
  /** Frame only — no subject/sender lines, no rounded border (for strips). */
  bare?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cat = CATEGORY_STYLE[email.category] ?? CATEGORY_STYLE.other;
  const time = formatEmailReceivedAt(email.receivedAt);
  const scale = width / MOBILE_W;
  const modalH =
    typeof window !== "undefined"
      ? Math.min(window.innerHeight * 0.72, 640)
      : 640;
  const srcDoc = useMemo(
    () =>
      emailSrcDoc({
        html: email.html,
        body: email.body || email.summary,
        subject: email.subject,
        from: email.from,
      }),
    [email.html, email.body, email.summary, email.subject, email.from]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          bare
            ? "group block shrink-0 cursor-zoom-in text-left"
            : "group block w-full cursor-zoom-in text-left"
        }
        title={`${email.subject || "(no subject)"} — open as on mobile`}
      >
        <div
          className={
            bare && width <= 48
              ? "relative overflow-hidden rounded-md border border-[var(--rs-border)] bg-white"
              : bare
                ? "relative overflow-hidden bg-white"
                : "relative overflow-hidden rounded-md border border-[var(--rs-border)] bg-white"
          }
          style={{ width, height }}
        >
          <div
            className="pointer-events-none absolute left-0 top-0 origin-top-left"
            style={{
              width: MOBILE_W,
              height: height / scale,
              transform: `scale(${scale})`,
            }}
          >
            <EmailRenderFrame
              srcDoc={srcDoc}
              title={`Thumb: ${email.subject}`}
              height={height / scale}
            />
          </div>
          {width > 48 ? (
            <span
              className={`absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${cat.className}`}
            >
              {cat.label}
            </span>
          ) : null}
        </div>
        {bare ? null : (
          <>
            <p className="mt-1 truncate text-[11px] font-medium text-[var(--rs-fg)] group-hover:text-[var(--rs-accent)]">
              {email.subject || "(no subject)"}
            </p>
            <p className="truncate text-[10px] text-[var(--rs-muted)]">
              {shortFrom(email.from)} · {time.relative}
            </p>
          </>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-auto max-w-[min(96vw,440px)] gap-3 p-4 sm:max-w-[min(96vw,440px)]">
          <DialogTitle className="pe-8 text-sm text-muted-foreground">
            {email.subject || "(no subject)"} · Mobile
          </DialogTitle>
          <MobileEmailFrame
            srcDoc={srcDoc}
            title={email.subject}
            height={modalH}
            interactive
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ResearchEmailCard({
  email,
  brandLabel,
  compact,
}: {
  email: EmailWatchItem;
  brandLabel?: string | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cat = CATEGORY_STYLE[email.category] ?? CATEGORY_STYLE.other;
  const time = formatEmailReceivedAt(email.receivedAt);
  const preview = emailPreviewText(email.body, email.summary, compact ? 140 : 220);
  const links = email.links ?? [];
  const shots = email.screenshotUrls ?? [];
  const hasVisual = Boolean(email.html?.trim() || email.body?.trim());
  const previewH = compact ? 220 : 420;
  const modalH =
    typeof window !== "undefined"
      ? Math.min(window.innerHeight * 0.72, 640)
      : 640;

  const srcDoc = useMemo(
    () =>
      emailSrcDoc({
        html: email.html,
        body: email.body || email.summary,
        subject: email.subject,
        from: email.from,
      }),
    [email.html, email.body, email.summary, email.subject, email.from]
  );

  return (
    <article className="rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cat.className}`}
            >
              {cat.label}
            </span>
            {brandLabel ? (
              <span className="text-[11px] text-[var(--rs-muted)]">
                {brandLabel}
              </span>
            ) : null}
            {email.otpPresent ? (
              <span className="rounded-full bg-[var(--rs-accent)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--rs-accent)]">
                OTP
              </span>
            ) : null}
            {email.actionTaken && email.actionTaken !== "noted" ? (
              <span className="rounded-full border border-[var(--rs-border)] px-2 py-0.5 text-[10px] text-[var(--rs-muted)]">
                {email.actionTaken.replace(/_/g, " ")}
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 text-sm font-medium leading-snug text-[var(--rs-fg)]">
            {email.subject || "(no subject)"}
          </h3>
          <p className="mt-1 text-[11px] text-[var(--rs-muted)]">
            {shortFrom(email.from)}
            {email.dayNumber > 0 ? ` · Journey day ${email.dayNumber}` : null}
            {" · "}
            Mobile preview
          </p>
        </div>
        <time
          dateTime={email.receivedAt}
          title={time.absolute}
          className="shrink-0 text-right text-[11px] leading-tight text-[var(--rs-muted)]"
        >
          <span className="block font-medium text-[var(--rs-fg)]/80">
            {time.relative}
          </span>
          <span className="mt-0.5 block max-w-[9.5rem]">
            {time.absolute}
          </span>
        </time>
      </div>

      {hasVisual ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group relative mx-auto block w-full max-w-[390px] cursor-zoom-in text-left"
            title="Open full email"
          >
            <div className="pointer-events-none">
              <MobileEmailFrame
                srcDoc={srcDoc}
                title={`Preview: ${email.subject}`}
                height={previewH}
              />
            </div>
            <span className="mt-2 block text-center text-[10px] text-[var(--rs-muted)] group-hover:text-[var(--rs-accent)]">
              {email.html
                ? "As on mobile — click to enlarge"
                : "Text email — click to enlarge"}
            </span>
          </button>
        </div>
      ) : preview ? (
        <p className="mt-3 text-xs leading-relaxed text-[var(--rs-muted)]">
          {preview}
        </p>
      ) : null}

      {links.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {links.slice(0, compact ? 2 : 3).map((l) => (
            <a
              key={l}
              href={l}
              target="_blank"
              rel="noreferrer"
              className="max-w-full truncate rounded-md border border-[var(--rs-border)] bg-[var(--rs-bg)] px-2 py-1 text-[10px] text-[var(--rs-accent)] hover:border-[var(--rs-accent)]/40"
              title={l}
            >
              {hostFromUrl(l)}
            </a>
          ))}
          {links.length > (compact ? 2 : 3) ? (
            <span className="px-1 text-[10px] text-[var(--rs-muted)]">
              {links.length - (compact ? 2 : 3)} more links
            </span>
          ) : null}
        </div>
      ) : null}

      {shots.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--rs-muted)]">
            Site after opening link
          </p>
          <div className="flex flex-wrap gap-2">
            {shots.map((src) => (
              <ScreenshotLightbox
                key={src}
                src={src}
                alt={email.subject}
                className="h-20 w-28"
                frame="phone"
              />
            ))}
          </div>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-auto max-w-[min(96vw,440px)] gap-3 p-4 sm:max-w-[min(96vw,440px)]">
          <DialogTitle className="pe-8 text-sm text-muted-foreground">
            {email.subject || "(no subject)"} · Mobile
          </DialogTitle>
          <MobileEmailFrame
            srcDoc={srcDoc}
            title={email.subject}
            height={modalH}
            interactive
          />
        </DialogContent>
      </Dialog>
    </article>
  );
}
