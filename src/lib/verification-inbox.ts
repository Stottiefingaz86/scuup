import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

/** Server-only access to the shared test inbox (stottiefingaz@gmail.com).
 * Every brand's signup uses a plus-alias of this inbox, so verification
 * emails from any operator land here. The agent reads them mid-run to get
 * past "verify your email" walls: fetch the OTP code or confirmation link
 * and complete verification in the same browser session. */

export interface VerificationEmail {
  /** One-time code found in the message (prefers 6 digits). */
  otp: string | null;
  /** Verification/confirmation links, most likely first. */
  links: string[];
  subject: string;
  from: string;
}

export function inboxConfigured(): boolean {
  return Boolean(
    process.env.GMAIL_IMAP_USER && process.env.GMAIL_IMAP_APP_PASSWORD
  );
}

const OTP_RE = /\b(\d{6})\b/;
const OTP_LOOSE_RE = /\b(\d{4,8})\b/;
const LINK_RE = /https?:\/\/[^\s<>"')\]]+/g;
const VERIFY_LINK_RE = /verif|confirm|activat|validate|token=|welcome/i;
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
        const matchesAlias = to.includes(alias);
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
        return {
          otp,
          links,
          subject: parsed.subject ?? "",
          from,
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
