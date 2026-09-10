import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_TEST_EMAIL } from "@/lib/constants";
import {
  capturedToWatchItem,
  fetchInboxEmailsSince,
} from "@/lib/research/email-monitor";
import {
  inboxConfigured,
  waitForVerificationEmail,
} from "@/lib/verification-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ListResult = Awaited<ReturnType<typeof fetchInboxEmailsSince>>;

/**
 * IMAP list is slow (15–30s). Coalesce identical in-flight requests and serve
 * a short-lived cache so a polling client can't stack connections and starve
 * the agent's own inbox monitoring.
 */
const listStore = globalThis as unknown as {
  __researchInboxList?: Map<
    string,
    { at: number; promise: Promise<ListResult> }
  >;
};
const listCache = (listStore.__researchInboxList ??= new Map());
const LIST_CACHE_MS = 20_000;

function listInboxCoalesced(
  toAddress: string,
  since: Date,
  hours: number
): Promise<ListResult> {
  const key = `${toAddress.toLowerCase()}|${hours}`;
  const hit = listCache.get(key);
  if (hit && Date.now() - hit.at < LIST_CACHE_MS) return hit.promise;
  const promise = fetchInboxEmailsSince({ toAddress, since, limit: 50 });
  listCache.set(key, { at: Date.now(), promise });
  promise.catch(() => listCache.delete(key));
  return promise;
}

/** Health / peek / full list for the shared Research verification inbox. */
export async function GET(request: NextRequest) {
  if (!inboxConfigured()) {
    return NextResponse.json({
      configured: false,
      user: null,
      message: "Set GMAIL_IMAP_USER and GMAIL_IMAP_APP_PASSWORD",
    });
  }

  const to =
    request.nextUrl.searchParams.get("to")?.trim() || DEFAULT_TEST_EMAIL;
  const peek = request.nextUrl.searchParams.get("peek") === "1";
  const list = request.nextUrl.searchParams.get("list") === "1";
  // Days 1–14 CRM tracking pulls the whole window (plus slack).
  const hours = Math.min(
    16 * 24,
    Math.max(1, Number(request.nextUrl.searchParams.get("hours") ?? "24") || 24)
  );
  const since = new Date(Date.now() - hours * 3600_000);

  if (!peek && !list) {
    return NextResponse.json({
      configured: true,
      user: process.env.GMAIL_IMAP_USER ?? null,
      defaultTo: DEFAULT_TEST_EMAIL,
    });
  }

  if (list) {
    try {
      const raw = await listInboxCoalesced(to, since, hours);
      const messages = raw.map((m) =>
        // dayNumber recalculated client-side against project createdAt
        capturedToWatchItem(m, "inbox", new Date(0), {
          actionTaken: "noted",
          actionResult: "Inbox sync",
          dayNumber: 0,
        })
      );
      return NextResponse.json({
        configured: true,
        user: process.env.GMAIL_IMAP_USER ?? null,
        to,
        since: since.toISOString(),
        messages,
      });
    } catch (e) {
      return NextResponse.json(
        {
          configured: true,
          error: e instanceof Error ? e.message : "list failed",
        },
        { status: 500 }
      );
    }
  }

  const mail = await waitForVerificationEmail(
    { toAddress: to, since },
    12_000
  );

  return NextResponse.json({
    configured: true,
    user: process.env.GMAIL_IMAP_USER ?? null,
    to,
    since: since.toISOString(),
    mail: mail
      ? {
          from: mail.from,
          subject: mail.subject,
          hasOtp: Boolean(mail.otp),
          otpLength: mail.otp?.length ?? 0,
          linkCount: mail.links.length,
        }
      : null,
  });
}
