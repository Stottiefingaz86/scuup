/** Client-safe email display helpers (no Node/IMAP imports). */

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
