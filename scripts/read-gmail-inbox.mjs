/**
 * Read recent Gmail inbox messages (test signup / verify emails).
 *
 *   node scripts/read-gmail-inbox.mjs
 *   node scripts/read-gmail-inbox.mjs --to stottiefingaz+stake@gmail.com
 *   node scripts/read-gmail-inbox.mjs --wait --subject verify
 */
import fs from "node:fs";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const user = process.env.GMAIL_IMAP_USER;
const pass = process.env.GMAIL_IMAP_APP_PASSWORD?.replace(/\s+/g, "");
if (!user || !pass) {
  console.error("Set GMAIL_IMAP_USER and GMAIL_IMAP_APP_PASSWORD in .env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const toIdx = args.indexOf("--to");
const filterTo = toIdx >= 0 ? args[toIdx + 1] : undefined;
const subIdx = args.indexOf("--subject");
const filterSubject = subIdx >= 0 ? args[subIdx + 1] : undefined;
const wait = args.includes("--wait");

const OTP_RE = /\b(\d{6})\b/;
const LINK_RE = /https?:\/\/[^\s<>"']+/g;

async function fetchMessages(since) {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });
  await client.connect();
  const out = [];
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ since }, { uid: true });
      const list = (uids ?? []).slice(-20).reverse();
      for (const uid of list) {
        const msg = await client.fetchOne(
          uid,
          { source: true, envelope: true },
          { uid: true }
        );
        if (!msg?.source) continue;
        const parsed = await simpleParser(msg.source);
        const to =
          parsed.to?.value.map((a) => a.address).join(", ") ?? "";
        const subject = parsed.subject ?? "";
        const from = parsed.from?.value[0]?.address ?? "";
        const text = `${parsed.text ?? ""}\n${parsed.html ?? ""}`;
        const date = parsed.date ?? new Date();

        if (filterTo && !to.toLowerCase().includes(filterTo.toLowerCase())) {
          continue;
        }
        if (
          filterSubject &&
          !subject.toLowerCase().includes(filterSubject.toLowerCase())
        ) {
          continue;
        }

        const otp = OTP_RE.exec(text)?.[1] ?? null;
        const links = [...new Set(text.match(LINK_RE) ?? [])];
        out.push({ date, from, to, subject, otp, links, text: parsed.text ?? "" });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
  return out;
}

const since = new Date(Date.now() - 15 * 60 * 1000);
let messages;

if (wait) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    messages = await fetchMessages(since);
    if (messages.length > 0) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
} else {
  messages = await fetchMessages(since);
}

if (!messages?.length) {
  console.log("No matching messages in the last 15 minutes.");
  process.exit(0);
}

for (const m of messages.slice(0, 8)) {
  console.log("---");
  console.log("Date:", m.date.toISOString());
  console.log("From:", m.from);
  console.log("To:", m.to);
  console.log("Subject:", m.subject);
  if (m.otp) console.log("OTP:", m.otp);
  if (m.links.length) console.log("Links:", m.links.slice(0, 3).join("\n       "));
  if (m.text) {
    console.log("Preview:", m.text.replace(/\s+/g, " ").trim().slice(0, 200));
  }
}

console.log(`\n${messages.length} message(s) matched.`);
