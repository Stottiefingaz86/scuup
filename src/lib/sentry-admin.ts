/**
 * Server-side Sentry issue fetch for mission control. Needs SENTRY_AUTH_TOKEN
 * with event:read (Sentry > Settings > Developer Settings > Auth Tokens).
 */

const SENTRY_API_HOST =
  process.env.SENTRY_API_HOST?.trim() || "https://de.sentry.io";
const SENTRY_ORG = process.env.SENTRY_ORG?.trim() || "scuup";
const SENTRY_PROJECT = process.env.SENTRY_PROJECT?.trim() || "javascript-nextjs";

export interface AdminSentryIssue {
  id: string;
  shortId: string;
  title: string;
  culprit: string | null;
  level: string;
  status: string;
  eventCount: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  url: string;
}

export interface AdminSentryReport {
  configured: true;
  unresolvedCount: number;
  issues: AdminSentryIssue[];
}

interface RawSentryIssue {
  id: string;
  shortId: string;
  title: string;
  culprit?: string | null;
  level?: string;
  status?: string;
  count?: string | number;
  userCount?: number;
  firstSeen?: string;
  lastSeen?: string;
  permalink?: string;
}

function mapIssue(raw: RawSentryIssue): AdminSentryIssue {
  return {
    id: raw.id,
    shortId: raw.shortId,
    title: raw.title,
    culprit: raw.culprit ?? null,
    level: raw.level ?? "error",
    status: raw.status ?? "unresolved",
    eventCount: Number(raw.count ?? 0),
    userCount: raw.userCount ?? 0,
    firstSeen: raw.firstSeen ?? new Date().toISOString(),
    lastSeen: raw.lastSeen ?? new Date().toISOString(),
    url:
      raw.permalink ??
      `https://${SENTRY_ORG}.sentry.io/issues/${raw.id}/`,
  };
}

/** Pull open issues from Sentry, newest activity first. */
export async function fetchSentryReport(
  limit = 15
): Promise<AdminSentryReport> {
  const token = process.env.SENTRY_AUTH_TOKEN?.trim();
  if (!token) {
    throw new Error("SENTRY_AUTH_TOKEN not configured");
  }

  const params = new URLSearchParams({
    query: "is:unresolved",
    project: SENTRY_PROJECT,
    statsPeriod: "24h",
    sort: "date",
    limit: String(limit),
  });

  const res = await fetch(
    `${SENTRY_API_HOST}/api/0/organizations/${SENTRY_ORG}/issues/?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sentry API ${res.status}: ${body.slice(0, 200)}`);
  }

  const issues = (await res.json()) as RawSentryIssue[];
  const hits = res.headers.get("X-Hits");

  return {
    configured: true,
    unresolvedCount: hits ? Number(hits) : issues.length,
    issues: issues.map(mapIssue),
  };
}

export function sentryIssuesDashboardUrl(): string {
  return `https://${SENTRY_ORG}.sentry.io/issues/?project=${SENTRY_PROJECT}&query=is%3Aunresolved`;
}
