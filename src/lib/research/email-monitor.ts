import "server-only";

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { inboxConfigured } from "../verification-inbox";
import type { EmailWatchItem } from "./types";

/** Full captured message for Research evidence + agent interaction. */
export interface CapturedInboxEmail {
  id: string;
  uid: number;
  messageId: string | null;
  receivedAt: string;
  from: string;
  to: string;
  subject: string;
  /** Plain-text body, capped for storage. */
  body: string;
  /** Sanitized HTML (capped) for inbox-style UI render. */
  html: string | null;
  snippet: string;
  links: string[];
  otp: string | null;
  category: EmailWatchItem["category"];
}

const HTML_CAP = 50_000;

/** Strip scriptable bits so we can safely put HTML in a sandboxed iframe. */
export function sanitizeEmailHtml(raw: string): string {
  return String(raw)
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object\b[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/data:text\/html/gi, "data:text/plain")
    .slice(0, HTML_CAP);
}

const OTP_RE = /\b(\d{6})\b/;
const OTP_LOOSE_RE = /\b(\d{4,8})\b/;
const LINK_RE = /https?:\/\/[^\s<>"')\]]+/g;
const IGNORE_LINK_RE =
  /unsubscribe|privacy|terms|preferences|facebook|twitter|instagram|youtube|apple\.com|play\.google|mailto:/i;

function imapAuth() {
  return {
    user: process.env.GMAIL_IMAP_USER!,
    pass: process.env.GMAIL_IMAP_APP_PASSWORD!.replace(/\s+/g, ""),
  };
}

/**
 * Match To: against the address we asked for.
 * Specific +aliases (scuup678+rswinna…) must NOT match sibling brands
 * (…+rsbovada…) — that was attaching Bovada screenshots to Winna mail.
 */
function matchesRecipient(to: string, alias: string): boolean {
  const toLower = to.toLowerCase();
  const want = alias.toLowerCase().trim();
  if (!want || !toLower) return false;
  if (toLower.includes(want)) return true;

  const at = want.indexOf("@");
  if (at < 0) return false;
  const wantLocal = want.slice(0, at);
  const wantDomain = want.slice(at + 1);
  if (!wantLocal || !wantDomain) return false;

  // Bare inbox (no +tag): accept base or any plus of that local.
  if (!wantLocal.includes("+")) {
    return (
      toLower.includes(`${wantLocal}@${wantDomain}`) ||
      new RegExp(
        `${escapeRegExp(wantLocal)}\\+[a-z0-9._-]+@${escapeRegExp(wantDomain)}`,
        "i",
      ).test(toLower)
    );
  }

  // Tagged alias: only this exact local-part (plus tag included).
  return new RegExp(
    `${escapeRegExp(wantLocal)}@${escapeRegExp(wantDomain)}`,
    "i",
  ).test(toLower);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when To: is clearly a different research +rs alias than the one we want. */
function isDifferentResearchAlias(to: string, alias: string): boolean {
  const toLower = to.toLowerCase();
  const wantLocal = alias.toLowerCase().split("@")[0] ?? "";
  if (!wantLocal.includes("+")) return false;
  const m = toLower.match(/([a-z0-9._+-]+@[a-z0-9.-]+)/gi) ?? [];
  for (const addr of m) {
    const local = addr.split("@")[0] ?? "";
    if (local.includes("+rs") && local !== wantLocal) return true;
  }
  return false;
}

const WELCOME_SUBJECT_RE =
  /welcome|thanks for (?:joining|signing|registering)|you'?re (?:in|all set)|account (?:is )?(?:ready|created|confirmed)|glad you|let'?s get started/i;

const DEPOSIT_CONFIRM_RE =
  /deposit (?:confirm|confirmed|confirmation|received|successful|success|complete|completed|approved|credited|has been|was)|your (?:bitcoin |btc )?deposit|bitcoin deposit|btc deposit|payment (?:received|confirmed|successful)|funds (?:have )?been (?:credited|added|received)|credited to your|transaction (?:complete|confirmed)/i;

export function categorizeEmail(
  subject: string,
  body: string,
  from: string,
): EmailWatchItem["category"] {
  const hay = `${subject}\n${body}\n${from}`.toLowerCase();
  const depositConfirm =
    DEPOSIT_CONFIRM_RE.test(subject) || DEPOSIT_CONFIRM_RE.test(hay);
  if (
    /verif|confirm (?:your )?email|activat|one[- ]time|otp|security code|passcode/.test(
      hay,
    ) &&
    !depositConfirm
  ) {
    return "verify";
  }
  // A deposit receipt wins over welcome copy — confirmation mail often
  // restates "welcome" in the body and used to vanish from the card.
  if (DEPOSIT_CONFIRM_RE.test(subject) || (depositConfirm && !WELCOME_SUBJECT_RE.test(subject))) {
    return "deposit_nudge";
  }
  // Subject wins for welcome mail: the body almost always mentions deposits
  // and bonuses, which used to misfile every welcome email as a nudge.
  if (WELCOME_SUBJECT_RE.test(subject)) return "welcome";
  if (
    /make (?:your )?first deposit/.test(hay)
  ) {
    return "deposit_nudge";
  }
  if (/welcome|thanks for (?:joining|signing)|get started/.test(hay)) {
    return "welcome";
  }
  if (/bonus|free spins?|promo code|offer|cashback|rakeback/.test(hay)) {
    return "bonus";
  }
  if (/vip|loyalty|tier|rewards club|host/.test(hay)) {
    return "vip";
  }
  if (
    /we miss you|come back|reactivat|inactive|haven'?t (?:played|logged)/.test(
      hay,
    )
  ) {
    return "reactivation";
  }
  return "other";
}

function extractLinks(text: string): string[] {
  return [...new Set(text.match(LINK_RE) ?? [])].filter(
    (l) => !IGNORE_LINK_RE.test(l),
  );
}

function extractOtp(text: string): string | null {
  return OTP_RE.exec(text)?.[1] ?? OTP_LOOSE_RE.exec(text)?.[1] ?? null;
}

/** Bovada mail often comes from bovada.lv / bodog — not bovada.com. */
const SENDER_FAMILY: Record<string, string[]> = {
  bovada: ["bovada", "bodog"],
  bodog: ["bodog", "bovada"],
};

function senderMatchesBrand(from: string, domainHint?: string): boolean {
  if (!domainHint) return false;
  const domain = domainHint.toLowerCase().replace(/^www\./, "");
  if (
    from.endsWith(`@${domain}`) ||
    from.endsWith(`.${domain}`) ||
    from.includes(`@${domain}`)
  ) {
    return true;
  }
  const root = domain.split(".")[0] ?? "";
  if (root.length >= 4 && from.includes(root)) return true;
  const extra = SENDER_FAMILY[root];
  return Boolean(extra?.some((tok) => from.includes(tok)));
}

function headerAddresses(parsed: {
  to?: unknown;
  headers?: { get: (key: string) => unknown };
}): string {
  const toHeader = parsed.to;
  const toList = Array.isArray(toHeader)
    ? toHeader
    : toHeader
      ? [toHeader]
      : [];
  const fromTo = toList
    .flatMap((t) => {
      if (t && typeof t === "object" && "value" in t) {
        return (
          (t as { value: { address?: string }[] }).value?.map(
            (a) => a.address ?? "",
          ) ?? []
        );
      }
      return [];
    })
    .join(", ");
  const extraKeys = ["delivered-to", "x-original-to", "x-forwarded-to"];
  const extras = extraKeys
    .map((k) => {
      const v = parsed.headers?.get(k);
      return v == null ? "" : String(v);
    })
    .join(" ");
  return `${fromTo} ${extras}`.toLowerCase();
}

const IMAP_BOXES = ["INBOX", "[Gmail]/Spam", "Spam"] as const;

/**
 * Fetch every message since `since` addressed to our research inbox
 * (base or +alias). Newest last. Also reads Gmail Spam — Bovada
 * "check your email" mail often never arrives, and when it does it
 * lands in Spam.
 */
export async function fetchInboxEmailsSince(opts: {
  toAddress: string;
  since: Date;
  fromDomainHint?: string | null;
  limit?: number;
}): Promise<CapturedInboxEmail[]> {
  if (!inboxConfigured()) return [];

  const auth = imapAuth();
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth,
    logger: false,
  });

  await client.connect();
  try {
    const alias = opts.toAddress.toLowerCase();
    const domain = opts.fromDomainHint?.toLowerCase().replace(/^www\./, "");
    const perBox = opts.limit ?? 40;
    const seen = new Set<string>();
    const out: CapturedInboxEmail[] = [];

    for (const box of IMAP_BOXES) {
      try {
        const lock = await client.getMailboxLock(box);
        try {
          const uids = await client.search({ since: opts.since }, { uid: true });
          const list = (Array.isArray(uids) ? uids : []).slice(-perBox);
          const boxSlug = box.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

          for (const uid of list) {
            const msg = await client.fetchOne(
              uid,
              { source: true, internalDate: true },
              { uid: true },
            );
            if (!msg || !("source" in msg) || !msg.source) continue;
            const parsed = await simpleParser(msg.source);
            const internal =
              "internalDate" in msg && msg.internalDate instanceof Date
                ? msg.internalDate
                : null;
            const receivedDate = internal ?? parsed.date ?? new Date();
            if (receivedDate < opts.since) continue;

            const to = headerAddresses(parsed);
            const from = parsed.from?.value[0]?.address?.toLowerCase() ?? "";
            const matchesAlias = matchesRecipient(to, alias);
            const matchesDomain = senderMatchesBrand(from, domain);
            if (isDifferentResearchAlias(to, alias)) continue;
            if (!matchesAlias && !matchesDomain) continue;
            if (!matchesAlias && matchesDomain && /\+rs[a-z0-9]+@/i.test(to)) {
              continue;
            }

            const textBody = (parsed.text ?? "")
              .replace(/\r\n/g, "\n")
              .trim()
              .slice(0, 4000);
            const rawHtml = parsed.html ? String(parsed.html) : "";
            const html = rawHtml ? sanitizeEmailHtml(rawHtml) : null;
            const htmlFallback =
              !textBody && html
                ? html
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 4000)
                : "";
            const body = textBody || htmlFallback;
            const subject = parsed.subject ?? "(no subject)";
            const links = extractLinks(`${body}\n${rawHtml}`);
            const otp = extractOtp(body);
            const category = categorizeEmail(subject, body, from);
            const receivedAt = receivedDate.toISOString();
            const dedupe =
              parsed.messageId || `${from}|${subject}|${receivedAt}`;
            if (seen.has(dedupe)) continue;
            seen.add(dedupe);

            out.push({
              id: `imap-${boxSlug}-${uid}`,
              uid: Number(uid),
              messageId: parsed.messageId ?? null,
              receivedAt,
              from,
              to: to.trim() || alias,
              subject,
              body,
              html,
              snippet: body.replace(/\s+/g, " ").slice(0, 280),
              links,
              otp,
              category,
            });
          }
        } finally {
          lock.release();
        }
      } catch {
        // Gmail may not expose "Spam" vs "[Gmail]/Spam".
      }
    }

    return out.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  } finally {
    await client.logout().catch(() => {});
  }
}

/** Pick the best site CTA link to open from an email. */
export function pickActionableLink(
  email: CapturedInboxEmail,
  siteHost?: string | null,
): string | null {
  const host = siteHost?.replace(/^www\./, "").toLowerCase() ?? null;
  const scored = email.links.map((link) => {
    let score = 0;
    try {
      const u = new URL(link);
      const h = u.hostname.replace(/^www\./, "").toLowerCase();
      if (host && (h === host || h.endsWith(`.${host}`))) score += 10;
      if (/verif|confirm|activat|claim|bonus|deposit|login|play/i.test(link))
        score += 5;
      if (/cdn\.|static\.|image|pixel|track/i.test(h)) score -= 5;
    } catch {
      score -= 10;
    }
    return { link, score };
  });
  scored.sort((a, b) => b.score - a.score);
  if (scored[0] && scored[0].score > 0) return scored[0].link;
  // Verify mail often wraps the CTA in a click-tracker host. Still open it.
  if (email.category === "verify" || email.category === "welcome") {
    return email.links[0] ?? null;
  }
  return null;
}

export function capturedToWatchItem(
  email: CapturedInboxEmail,
  brandId: string,
  journeyStartedAt: Date,
  extras?: Partial<EmailWatchItem>,
): EmailWatchItem {
  // Calendar days since journey start (local midnight), not a sync-window offset.
  const received = new Date(email.receivedAt);
  const start = new Date(journeyStartedAt);
  const receivedDay = new Date(
    received.getFullYear(),
    received.getMonth(),
    received.getDate(),
  );
  const startDay = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const dayNumber = Number.isNaN(received.getTime())
    ? 0
    : Math.max(
        0,
        Math.round((receivedDay.getTime() - startDay.getTime()) / 86_400_000),
      );
  return {
    id: email.id,
    brandId,
    receivedAt: email.receivedAt,
    from: email.from,
    subject: email.subject,
    category: email.category,
    dayNumber,
    summary: email.snippet,
    body: email.body,
    ...(email.html ? { html: email.html } : {}),
    ...(email.to ? { to: email.to } : {}),
    links: email.links,
    otpPresent: Boolean(email.otp),
    ...extras,
  };
}
