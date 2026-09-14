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
export const maxDuration = 120;

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

function csvParam(request: NextRequest, name: string): string[] {
  return (request.nextUrl.searchParams.get(name) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function listInboxCoalesced(
  toAddress: string,
  since: Date,
  hours: number,
  extraToAddresses: string[],
  extraFromHints: string[],
  extraSlugs: string[],
): Promise<ListResult> {
  const key = `${toAddress.toLowerCase()}|${hours}|${extraToAddresses.join(",")}|${extraFromHints.join(",")}|${extraSlugs.join(",")}`;
  const hit = listCache.get(key);
  if (hit && Date.now() - hit.at < LIST_CACHE_MS) return hit.promise;
  const promise = fetchInboxEmailsSince({
    toAddress,
    since,
    extraToAddresses,
    extraFromHints,
    extraSlugs,
    limit: 80,
  });
  listCache.set(key, { at: Date.now(), promise });
  promise.catch(() => listCache.delete(key));
  return promise;
}

function toWatchItems(raw: ListResult) {
  return raw.map((message) =>
    capturedToWatchItem(message, "inbox", new Date(0), {
      actionTaken: "noted",
      actionResult: "Inbox sync",
      dayNumber: 0,
    }),
  );
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
    Math.max(1, Number(request.nextUrl.searchParams.get("hours") ?? "24") || 24),
  );
  const since = new Date(Date.now() - hours * 3600_000);

  if (!peek && !list) {
    const user = process.env.GMAIL_IMAP_USER ?? null;
    const defaultTo = DEFAULT_TEST_EMAIL;
    const mismatch =
      user &&
      defaultTo &&
      user.split("@")[0]?.toLowerCase() !==
        defaultTo.split("@")[0]?.split("+")[0]?.toLowerCase();
    return NextResponse.json({
      configured: true,
      user,
      defaultTo,
      ...(mismatch
        ? {
            warning: `IMAP is logged in as ${user} but Research mail goes to ${defaultTo}. Sync will return empty until GMAIL_IMAP_USER matches.`,
          }
        : {}),
    });
  }

  if (list) {
    try {
      const extraToAddresses = csvParam(request, "aliases");
      const extraFromHints = csvParam(request, "from");
      const extraSlugs = csvParam(request, "slugs");
      const raw = await Promise.race([
        listInboxCoalesced(
          to,
          since,
          hours,
          extraToAddresses,
          extraFromHints,
          extraSlugs,
        ),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Inbox list timed out")),
            90_000,
          ),
        ),
      ]);
      return NextResponse.json({
        configured: true,
        user: process.env.GMAIL_IMAP_USER ?? null,
        to,
        since: since.toISOString(),
        messages: toWatchItems(raw),
        ...(process.env.GMAIL_IMAP_USER &&
        to.split("@")[0]?.split("+")[0]?.toLowerCase() !==
          process.env.GMAIL_IMAP_USER.split("@")[0]?.toLowerCase() &&
        raw.length === 0
          ? {
              warning: `IMAP is ${process.env.GMAIL_IMAP_USER} but sync asked for ${to}. Fix GMAIL_IMAP_USER on Vercel.`,
            }
          : {}),
      });
    } catch (e) {
      return NextResponse.json(
        {
          configured: true,
          error: e instanceof Error ? e.message : "list failed",
        },
        { status: 500 },
      );
    }
  }

  const mail = await waitForVerificationEmail({ toAddress: to, since }, 12_000);

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
