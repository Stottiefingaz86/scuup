/** Client-safe email display helpers (no Node/IMAP imports). */

import type { EmailWatchItem } from "./types";

const LOGIN_ALERT_RE =
  /account login detected|new login detected|confirm your login|login detected from a new device|new device (that )?(logged|signed) in|signed in from a new|unrecognised (sign[- ]?in|login|device)|unrecognized (sign[- ]?in|login|device)|we (noticed|detected) a (new )?(login|sign[- ]?in)|new login to your account|login from a new (device|browser|location)/i;

/** Security noise — not CRM. Hide from the research inbox. */
export function isLoginAlertEmail(e: {
  subject?: string | null;
  summary?: string | null;
  body?: string | null;
}): boolean {
  return LOGIN_ALERT_RE.test(
    `${e.subject ?? ""}\n${e.summary ?? ""}\n${e.body ?? ""}`,
  );
}

function normalizeSubject(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*[-–#:]\s*\d{4,}\s*$/, "")
    .trim();
}

function emailRichness(e: EmailWatchItem): number {
  return (
    (e.html?.length ?? 0) +
    (e.body?.length ?? 0) +
    (e.screenshotUrls?.length ?? 0) * 200
  );
}

function isContestOrCrmSubject(subject: string): boolean {
  return /contest|\braces\b|survivor|seasonal|nfl spread/i.test(subject);
}

/** “The Winna VIP Program: Explained” — not every promo that mentions VIP. */
export function isVipProgramEmail(e: {
  category?: string | null;
  subject?: string | null;
}): boolean {
  const subject = e.subject ?? "";
  if (isRacesEmail(e)) return false;
  return /vip\s*program/i.test(subject);
}

/** “Win your share of $500,000 in Winna Races” */
export function isRacesEmail(e: { subject?: string | null }): boolean {
  return /\braces\b|prize pool|500,?000/i.test(e.subject ?? "");
}

/** VIP / races / contests / later CRM blasts — keep even when To: is a sibling +rs mint. */
export function isRetentionCrmEmail(e: {
  category?: string | null;
  subject?: string | null;
}): boolean {
  const subject = e.subject ?? "";
  return (
    isVipProgramEmail(e) ||
    isRacesEmail(e) ||
    isContestOrCrmSubject(subject) ||
    /rakeback|vip bonus|\bsponsor\b/i.test(subject)
  );
}

function isVerifyEmail(e: {
  category?: string | null;
  subject?: string | null;
}): boolean {
  const subject = e.subject ?? "";
  if (WELCOME_RE.test(subject) || isContestOrCrmSubject(subject)) return false;
  if (
    /confirm your email|verif(?:y|ication)|activat(?:e|ion) (?:your )?email/i.test(
      subject,
    )
  ) {
    return true;
  }
  return e.category === "verify";
}

function isWelcomeStoryEmail(e: {
  category?: string | null;
  subject?: string | null;
}): boolean {
  const subject = e.subject ?? "";
  if (isDepositConfirmEmail(e) || isContestOrCrmSubject(subject)) return false;
  if (WELCOME_RE.test(subject)) return true;
  if (isVerifyEmail(e)) return false;
  return e.category === "welcome";
}

function emailDedupeKey(e: EmailWatchItem): string {
  // Same receipt resent with a new txn id → one row.
  if (isDepositConfirmEmail(e)) return `${e.brandId}|deposit_confirm`;
  // Same VIP Program blast to sibling +rs mints → one card.
  if (isVipProgramEmail(e)) {
    return `${e.brandId}|${normalizeSubject(e.subject)}`;
  }
  const day = (e.receivedAt || "").slice(0, 10);
  return `${e.brandId}|${normalizeSubject(e.subject)}|${day}`;
}

/**
 * Account mail first (confirm → welcome → deposit), then races, then VIP.
 * Chronology inside each bucket. A 2-day-old VIP never jumps in front.
 */
function timelineBucket(e: EmailWatchItem): number {
  if (isVerifyEmail(e)) return 0;
  if (isWelcomeStoryEmail(e)) return 1;
  if (isDepositConfirmEmail(e)) return 2;
  if (isRacesEmail(e)) return 3;
  if (isVipProgramEmail(e)) return 4;
  return 5;
}

export function sortEmailsForTimeline(
  emails: EmailWatchItem[],
): EmailWatchItem[] {
  return [...emails].sort((a, b) => {
    const d = timelineBucket(a) - timelineBucket(b);
    if (d) return d;
    return a.receivedAt.localeCompare(b.receivedAt);
  });
}

export function emailTimelineLabel(e: EmailWatchItem): string {
  if (isWelcomeStoryEmail(e)) return "Welcome";
  if (isVerifyEmail(e)) return "Confirm";
  if (isDepositConfirmEmail(e)) return "Deposit success";
  if (isRacesEmail(e)) return "Races";
  if (isVipProgramEmail(e)) return "VIP";
  const labels: Record<EmailWatchItem["category"], string> = {
    verify: "Confirm",
    welcome: "Welcome",
    deposit_nudge: "Deposit",
    bonus: "Bonus",
    vip: "VIP",
    reactivation: "Comeback",
    other: "Other",
  };
  return labels[e.category] ?? "Other";
}

function mergeWatchEmail(a: EmailWatchItem, b: EmailWatchItem): EmailWatchItem {
  const keep =
    emailRichness(a) !== emailRichness(b)
      ? emailRichness(a) > emailRichness(b)
        ? a
        : b
      : a.receivedAt <= b.receivedAt
        ? a
        : b;
  const drop = keep === a ? b : a;
  const earlier =
    a.receivedAt <= b.receivedAt ? a.receivedAt : b.receivedAt;
  const later =
    a.receivedAt >= b.receivedAt ? a.receivedAt : b.receivedAt;
  return {
    ...keep,
    // VIP is the same blast resent — keep the later send so the 2-day-old
    // sibling mint does not replace this account's copy.
    receivedAt: isVipProgramEmail(keep) ? later : earlier,
    html: keep.html || drop.html,
    body: keep.body || drop.body,
    screenshotUrls: [
      ...new Set([
        ...(keep.screenshotUrls ?? []),
        ...(drop.screenshotUrls ?? []),
      ]),
    ],
  };
}

/** Same brand + subject + calendar day → one row. One deposit confirm per brand. */
export function dedupeWatchEmails(emails: EmailWatchItem[]): EmailWatchItem[] {
  const buckets = new Map<string, EmailWatchItem>();
  for (const e of emails) {
    if (isLoginAlertEmail(e)) continue;
    const key = emailDedupeKey(e);
    const prev = buckets.get(key);
    buckets.set(key, prev ? mergeWatchEmail(prev, e) : e);
  }
  return [...buckets.values()].sort((a, b) =>
    a.receivedAt.localeCompare(b.receivedAt),
  );
}

export function formatEmailReceivedAt(iso: string): {
  relative: string;
  absolute: string;
  valid: boolean;
} {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { relative: "Unknown time", absolute: iso || "—", valid: false };
  }
  const now = Date.now();
  const diffSec = Math.round((now - d.getTime()) / 1000);
  let relative: string;
  if (diffSec < 45) relative = "Just now";
  else if (diffSec < 3600)
    relative = `${Math.max(1, Math.round(diffSec / 60))}m ago`;
  else if (diffSec < 86400)
    relative = `${Math.max(1, Math.round(diffSec / 3600))}h ago`;
  else if (diffSec < 86400 * 7)
    relative = `${Math.max(1, Math.round(diffSec / 86400))}d ago`;
  else
    relative = d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });

  const absolute = d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return { relative, absolute, valid: true };
}

export function emailPreviewText(
  body: string | undefined,
  summary: string,
  max = 220,
): string {
  const raw = (body || summary || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max).trim()}…`;
}

const WELCOME_RE =
  /welcome|thanks for (?:joining|signing|registering)|you'?re (?:in|all set)|account (?:is )?(?:ready|created|confirmed)|glad you|let'?s get started/i;

const DEPOSIT_CONFIRM_RE =
  /deposit (?:confirm|confirmed|confirmation|received|successful|success|complete|credited)|your (?:bitcoin |btc )?deposit|payment received|funds (?:have )?been|credited to your|transaction (?:complete|confirmed)/i;

/** Deposit confirmation mail — category is a hint; welcome pitches don't count. */
export function isDepositConfirmEmail(e: {
  category?: string | null;
  subject?: string | null;
  summary?: string | null;
  body?: string | null;
}): boolean {
  const subject = e.subject ?? "";
  // Races / contests mention “deposit” in the body — they are not receipts.
  if (isRacesEmail(e) || isContestOrCrmSubject(subject)) return false;
  if (DEPOSIT_CONFIRM_RE.test(subject)) return true;
  if (e.category !== "deposit_nudge") return false;
  if (WELCOME_RE.test(subject) && !DEPOSIT_CONFIRM_RE.test(subject)) return false;
  return DEPOSIT_CONFIRM_RE.test(`${e.summary ?? ""} ${e.body ?? ""}`);
}

/**
 * The brand's welcome email for a run. Category is a hint, not the truth —
 * welcome mail often doubles as verification or a deposit pitch and gets
 * filed there — so also accept any subject that reads like a welcome, and
 * finally the first non-verification email after signup.
 */
export function pickWelcomeEmail<
  T extends {
    brandId: string;
    subject: string;
    category: string;
    receivedAt: string;
    runId?: string | null;
  },
>(emails: T[], brandId: string, runId?: string | null): T | null {
  const mine = emails
    .filter(
      (e) => e.brandId === brandId && (!e.runId || !runId || e.runId === runId),
    )
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  return (
    mine.find((e) => e.category === "welcome") ??
    mine.find((e) => WELCOME_RE.test(e.subject)) ??
    mine.find((e) => e.category !== "verify" && e.category !== "other") ??
    null
  );
}
