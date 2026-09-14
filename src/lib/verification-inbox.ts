import "server-only";

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

/** Server-only access to the shared test inbox (scuup678@gmail.com).
 * Every brand's signup uses this same inbox (optionally via +aliases) so
 * verification emails land here and the agent can fetch OTP / confirm links. */

export interface VerificationEmail {
  /** One-time code found in the message (prefers 6 digits). */
  otp: string | null;
  /** Verification/confirmation links, most likely first. */
  links: string[];
  subject: string;
  from: string;
  receivedAt?: string | null;
}

export interface DepositEmail extends VerificationEmail {
  snippet: string;
}

export function inboxConfigured(): boolean {
  return Boolean(
    process.env.GMAIL_IMAP_USER && process.env.GMAIL_IMAP_APP_PASSWORD
  );
}

/** True when IMAP login mailbox matches the research persona inbox. */
export function inboxMatchesResearchDefault(toAddress?: string | null): boolean {
  const user = (process.env.GMAIL_IMAP_USER ?? "").trim().toLowerCase();
  const want = (toAddress ?? process.env.DEFAULT_TEST_EMAIL ?? "scuup678@gmail.com")
    .trim()
    .toLowerCase()
    .split("+")[0];
  if (!user || !want) return true;
  const userLocal = user.split("@")[0] ?? "";
  const wantLocal = want.split("@")[0] ?? "";
  return user === want || userLocal === wantLocal;
}

const OTP_RE = /\b(\d{6})\b/;
const OTP_LOOSE_RE = /\b(\d{4,8})\b/;
const LINK_RE = /https?:\/\/[^\s<>"')\]]+/g;
const VERIFY_LINK_RE = /verif|confirm|activat|validate|token=|welcome/i;
const DEPOSIT_SUBJECT_RE =
  /deposit|payment received|funds (?:have )?been|successful (?:deposit|payment)|transaction (?:complete|confirmed)|credited|your (?:payment|transfer)/i;
const DEPOSIT_BODY_RE =
  /deposit (?:of|received|confirmed|successful)|payment received|funds (?:have )?(?:been )?(?:credited|added)|transaction (?:complete|confirmed)|successfully deposited/i;
const IGNORE_LINK_RE =
  /unsubscribe|privacy|terms|preferences|facebook|twitter|instagram|youtube|apple\.com|play\.google/i;

interface InboxQuery {
  /** The signup address (plus-alias) the email was sent to. */
  toAddress: string;
  /** Only messages received after this moment count. */
  since: Date;
  /** Sender domain hint (brand site host) to disambiguate the shared inbox. */
  fromDomainHint?: string | null;
}

async function fetchLatestMatch(
  q: InboxQuery
): Promise<VerificationEmail | null> {
  const user = process.env.GMAIL_IMAP_USER!;
  const pass = process.env.GMAIL_IMAP_APP_PASSWORD!.replace(/\s+/g, "");
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ since: q.since }, { uid: true });
      // Newest first, small window — verification emails arrive promptly.
      const list = (Array.isArray(uids) ? uids : []).slice(-15).reverse();
      const alias = q.toAddress.toLowerCase();
      const domain = q.fromDomainHint?.toLowerCase().replace(/^www\./, "");
      let fallback: VerificationEmail | null = null;
      for (const uid of list) {
        const msg = await client.fetchOne(
          uid,
          { source: true },
          { uid: true }
        );
        if (!msg || !msg.source) continue;
        const parsed = await simpleParser(msg.source);
        if (parsed.date && parsed.date < q.since) continue;

        const toHeader = parsed.to;
        const toList = Array.isArray(toHeader) ? toHeader : toHeader ? [toHeader] : [];
        const to = toList
          .flatMap((t) => t.value.map((a) => a.address ?? ""))
          .join(", ")
          .toLowerCase();
        const from = parsed.from?.value[0]?.address?.toLowerCase() ?? "";
        // Match the exact signup address, or any delivery to the shared
        // inbox local-part (operators sometimes rewrite plus-aliases).
        const local = alias.split("@")[0]?.split("+")[0] ?? "";
        const matchesAlias =
          to.includes(alias) ||
          (local.length > 2 &&
            (to.includes(`${local}@`) || to.includes(`${local}+`)));
        const matchesDomain = domain
          ? from.endsWith(domain) || from.includes(domain.split(".")[0]!)
          : false;
        if (!matchesAlias && !matchesDomain) continue;

        const text = `${parsed.text ?? ""}\n${parsed.html ?? ""}`;
        const otp = OTP_RE.exec(parsed.text ?? "")?.[1]
          ?? OTP_RE.exec(text)?.[1]
          ?? OTP_LOOSE_RE.exec(parsed.text ?? "")?.[1]
          ?? null;
        const allLinks = [...new Set(text.match(LINK_RE) ?? [])].filter(
          (l) => !IGNORE_LINK_RE.test(l)
        );
        const links = [
          ...allLinks.filter((l) => VERIFY_LINK_RE.test(l)),
          ...allLinks.filter((l) => !VERIFY_LINK_RE.test(l)),
        ];
        const subject = parsed.subject ?? "";
        const looksVerify =
          /verif|confirm (?:your )?email|activat|one[- ]time|otp|security code|passcode/i.test(
            `${subject}\n${text}`
          );
        const hit: VerificationEmail = {
          otp,
          links,
          subject,
          from,
          receivedAt: parsed.date?.toISOString() ?? null,
        };
        if (looksVerify || otp) return hit;
        if (!fallback && links.length > 0) fallback = hit;
      }
      return fallback;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

async function fetchLatestDepositMatch(
  q: InboxQuery
): Promise<DepositEmail | null> {
  const user = process.env.GMAIL_IMAP_USER!;
  const pass = process.env.GMAIL_IMAP_APP_PASSWORD!.replace(/\s+/g, "");
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ since: q.since }, { uid: true });
      const list = (Array.isArray(uids) ? uids : []).slice(-25).reverse();
      const alias = q.toAddress.toLowerCase();
      const domain = q.fromDomainHint?.toLowerCase().replace(/^www\./, "");
      for (const uid of list) {
        const msg = await client.fetchOne(
          uid,
          { source: true },
          { uid: true }
        );
        if (!msg || !msg.source) continue;
        const parsed = await simpleParser(msg.source);
        if (parsed.date && parsed.date < q.since) continue;

        const toHeader = parsed.to;
        const toList = Array.isArray(toHeader)
          ? toHeader
          : toHeader
            ? [toHeader]
            : [];
        const to = toList
          .flatMap((t) => t.value.map((a) => a.address ?? ""))
          .join(", ")
          .toLowerCase();
        const from = parsed.from?.value[0]?.address?.toLowerCase() ?? "";
        const local = alias.split("@")[0]?.split("+")[0] ?? "";
        const matchesAlias =
          to.includes(alias) ||
          (local.length > 2 &&
            (to.includes(`${local}@`) || to.includes(`${local}+`)));
        const matchesDomain = domain
          ? from.endsWith(domain) || from.includes(domain.split(".")[0]!)
          : false;
        if (!matchesAlias && !matchesDomain) continue;

        const subject = parsed.subject ?? "";
        const text = `${parsed.text ?? ""}\n${parsed.html ?? ""}`;
        if (!DEPOSIT_SUBJECT_RE.test(subject) && !DEPOSIT_BODY_RE.test(text)) {
          continue;
        }

        const allLinks = [...new Set(text.match(LINK_RE) ?? [])].filter(
          (l) => !IGNORE_LINK_RE.test(l)
        );
        return {
          otp: null,
          links: allLinks,
          subject,
          from,
          receivedAt: parsed.date?.toISOString() ?? null,
          snippet: (parsed.text ?? "").replace(/\s+/g, " ").slice(0, 240),
        };
      }
      return null;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

/** Poll inbox for a deposit confirmation email after manual payment. */
export async function waitForDepositEmail(
  q: InboxQuery,
  timeoutMs = 20 * 60_000
): Promise<DepositEmail | null> {
  if (!inboxConfigured()) return null;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const found = await fetchLatestDepositMatch(q);
      if (found) return found;
    } catch (e) {
      console.error(
        "[verification-inbox] deposit fetch failed:",
        e instanceof Error ? e.message : e
      );
    }
    if (Date.now() >= deadline) return null;
    await new Promise((r) => setTimeout(r, 12_000));
  }
}

/** Poll the inbox until a verification email for this signup arrives.
 * Returns null on timeout — never throws, an inbox hiccup must not sink
 * the walk. */
export async function waitForVerificationEmail(
  q: InboxQuery,
  timeoutMs = 90_000
): Promise<VerificationEmail | null> {
  if (!inboxConfigured()) return null;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const found = await fetchLatestMatch(q);
      if (found) return found;
    } catch (e) {
      console.error(
        "[verification-inbox] fetch failed:",
        e instanceof Error ? e.message : e
      );
    }
    if (Date.now() >= deadline) return null;
    await new Promise((r) => setTimeout(r, 7000));
  }
}
