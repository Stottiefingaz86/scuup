import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { AuthError, isAdminUser, requireUser } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PostHog stats for mission control, queried server-side via HogQL so the
 * numbers live on the dashboard instead of behind a deep link.
 *
 * Needs POSTHOG_PERSONAL_API_KEY (a phx_... key with Query Read scope,
 * PostHog > Settings > Personal API keys). The public phc_ key can only
 * ingest events, it cannot read them.
 */

const POSTHOG_PROJECT_ID = "224760";
const POSTHOG_API_HOST = "https://eu.posthog.com";

export interface AnalyticsDay {
  day: string;
  visitors: number;
  pageviews: number;
}

export interface AnalyticsOverview {
  configured: true;
  visitors30d: number;
  pageviews30d: number;
  visitorsToday: number;
  byDay: AnalyticsDay[];
  topPages: { path: string; views: number }[];
  referrers: { domain: string; visitors: number }[];
  events: { event: string; count: number }[];
}

async function hogql(query: string): Promise<unknown[][]> {
  const res = await fetch(
    `${POSTHOG_API_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PostHog query failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { results: unknown[][] };
  return data.results ?? [];
}

const PRODUCT_EVENTS = [
  "signup_completed",
  "logged_in",
  "report_created",
  "agent_run_started",
  "agent_run_failed",
  "checkout_started",
  "invite_sent",
];

async function loadAnalytics(): Promise<AnalyticsOverview> {
  const [byDayRows, totalsRows, todayRows, pagesRows, referrerRows, eventRows] =
    await Promise.all([
      hogql(
        `select toDate(timestamp) as day,
                uniq(person_id) as visitors,
                count() as pageviews
         from events
         where event = '$pageview' and timestamp >= now() - interval 30 day
         group by day order by day`
      ),
      hogql(
        `select uniq(person_id) as visitors, count() as pageviews
         from events
         where event = '$pageview' and timestamp >= now() - interval 30 day`
      ),
      hogql(
        `select uniq(person_id)
         from events
         where event = '$pageview' and toDate(timestamp) = today()`
      ),
      hogql(
        `select properties.$pathname as path, count() as views
         from events
         where event = '$pageview' and timestamp >= now() - interval 30 day
         group by path order by views desc limit 8`
      ),
      hogql(
        `select properties.$referring_domain as domain,
                uniq(person_id) as visitors
         from events
         where event = '$pageview'
           and timestamp >= now() - interval 30 day
           and properties.$referring_domain is not null
           and properties.$referring_domain != '$direct'
         group by domain order by visitors desc limit 6`
      ),
      hogql(
        `select event, count() as c
         from events
         where timestamp >= now() - interval 30 day
           and event in (${PRODUCT_EVENTS.map((e) => `'${e}'`).join(",")})
         group by event order by c desc`
      ),
    ]);

  const byDay = byDayRows.map((r) => ({
    day: String(r[0]),
    visitors: Number(r[1]),
    pageviews: Number(r[2]),
  }));

  return {
    configured: true,
    visitors30d: Number(totalsRows[0]?.[0] ?? 0),
    pageviews30d: Number(totalsRows[0]?.[1] ?? 0),
    visitorsToday: Number(todayRows[0]?.[0] ?? 0),
    byDay,
    topPages: pagesRows.map((r) => ({
      path: String(r[0] ?? "/"),
      views: Number(r[1]),
    })),
    referrers: referrerRows.map((r) => ({
      domain: String(r[0]),
      visitors: Number(r[1]),
    })),
    events: eventRows.map((r) => ({
      event: String(r[0]),
      count: Number(r[1]),
    })),
  };
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "admins only" }, { status: 403 });
    }
    if (!process.env.POSTHOG_PERSONAL_API_KEY?.trim()) {
      return NextResponse.json({ analytics: { configured: false } });
    }
    return NextResponse.json({ analytics: await loadAnalytics() });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error("[admin/analytics] failed:", e);
    Sentry.captureException(e, { tags: { route: "admin-analytics" } });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
