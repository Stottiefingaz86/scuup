import "server-only";

import { chromium } from "playwright-core";
import type { Page } from "playwright-core";
import { createSession, releaseSession } from "@/lib/browserbase";
import { trustpilotSlugFromInput } from "./slug";
import type {
  GraceReview,
  GraceScrape,
  GraceWindow,
  StarCounts,
} from "./types";

/**
 * Standalone Trustpilot reader for /grace.
 *
 * Trustpilot only serves 10 listing pages (200 reviews) per filter
 * combination before demanding a login, so for busy brands we slice the
 * window by star rating — each star gets its own 10 pages — and record the
 * exact per-star counts Trustpilot reports so the window-wide average is
 * right even when we couldn't capture every review. We keep reviews from the
 * last 24 months. Trustpilot's public date filter often stops at 12 months;
 * an extra undated `poker` search (sliced by star) reaches the year before.
 */

export const PULL_DAYS = 730;

export function windowDays(_w: GraceWindow): number {
  return PULL_DAYS;
}

function oldestReviewMs(pp: PageProps): number {
  const times = (pp.reviews ?? [])
    .map((r) => Date.parse(r.dates?.publishedDate ?? ""))
    .filter((n) => !Number.isNaN(n));
  return times.length ? Math.min(...times) : Date.now();
}

const PER_PAGE = 20;
/** Trustpilot gates page 11+ behind login. */
const MAX_PAGES_PER_FILTER = 10;

interface TpNextData {
  props?: {
    pageProps?: {
      businessUnit?: {
        displayName?: string;
        identifyingName?: string;
        trustScore?: number;
        numberOfReviews?: number;
        stars?: number;
      } | null;
      filters?: {
        pagination?: { totalCount?: number; totalPages?: number };
        reviewStatistics?: {
          ratings?: {
            total?: number;
            one?: number;
            two?: number;
            three?: number;
            four?: number;
            five?: number;
          };
        };
      };
      reviews?: Array<{
        id?: string;
        rating?: number;
        title?: string;
        text?: string;
        language?: string;
        likes?: number;
        dates?: { publishedDate?: string; experiencedDate?: string };
        consumer?: { displayName?: string; countryCode?: string };
        reply?: { message?: string; publishedDate?: string } | null;
        labels?: { verification?: { isVerified?: boolean } };
      }>;
    };
  };
}

type PageProps = NonNullable<NonNullable<TpNextData["props"]>["pageProps"]>;

async function readPage(page: Page, url: string): Promise<PageProps | null> {
  await page
    .goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 })
    .catch(() => {});
  // Cloudflare interstitial: Browserbase clears it in the background;
  // poll until __NEXT_DATA__ exists. Later pages reuse the cookie.
  let raw: string | null = null;
  for (let i = 0; i < 20 && !raw; i++) {
    raw = await page
      .evaluate(
        () => document.getElementById("__NEXT_DATA__")?.textContent ?? null,
      )
      .catch(() => null);
    if (!raw) await page.waitForTimeout(1500);
  }
  if (!raw) return null;
  const json = JSON.parse(raw) as TpNextData;
  const pp = json.props?.pageProps;
  // Login wall / redirect pages have no reviews array at all.
  if (!pp || !Array.isArray(pp.reviews)) return null;
  return pp;
}

function toReview(
  r: NonNullable<PageProps["reviews"]>[number],
): GraceReview | null {
  if (!r.rating) return null;
  const date = r.dates?.publishedDate ?? "";
  const id =
    r.id ?? `${date}|${r.consumer?.displayName ?? ""}|${r.title ?? ""}`;
  return {
    id,
    rating: r.rating,
    title: (r.title ?? "").trim(),
    text: (r.text ?? "").trim(),
    date,
    author: r.consumer?.displayName?.trim() || "Anonymous",
    country: r.consumer?.countryCode ?? null,
    verified: Boolean(r.labels?.verification?.isVerified),
    likes: r.likes ?? 0,
    reply: r.reply?.message?.trim() || null,
    replyDate: r.reply?.publishedDate ?? null,
    language: r.language ?? null,
    source: "trustpilot",
  };
}

export interface ScrapeOptions {
  input: string;
  window: GraceWindow;
  /** Stop walking pages after this wall-clock budget. */
  budgetMs?: number;
  /** Extra Trustpilot `search=` pulls merged into the result. */
  searchTerms?: string[];
  onProgress?: (line: string) => void;
}

export async function scrapeTrustpilotFull(
  opts: ScrapeOptions,
): Promise<GraceScrape> {
  const slug = trustpilotSlugFromInput(opts.input);
  const sourceUrl = `https://www.trustpilot.com/review/${slug}`;
  const days = windowDays(opts.window);
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const deadline = Date.now() + (opts.budgetMs ?? 250_000);
  const searchTerms = (opts.searchTerms ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

  // US residential egress: datacenter IPs get a stripped page from
  // Trustpilot (no business unit); US is the canonical English corpus.
  const session = await createSession(undefined, undefined, "US");
  const browser = await chromium.connectOverCDP(session.connectUrl);

  try {
    const page = browser.contexts()[0].pages()[0];
    const reviews: GraceReview[] = [];
    const seen = new Set<string>();
    let pagesRead = 0;
    let truncated = false;

    const listUrl = (params: Record<string, string>, p: number, date: string | null) => {
      const q = new URLSearchParams({ sort: "recency", ...params });
      if (date) q.set("date", date);
      if (p > 1) q.set("page", String(p));
      return `${sourceUrl}?${q.toString()}`;
    };

    /** Absorb one page of reviews. Returns true when we hit reviews older
     * than the window (recency sort ⇒ nothing further is useful). */
    const absorb = (pp: PageProps): { n: number; pastWindow: boolean } => {
      let pastWindow = false;
      let n = 0;
      for (const raw of pp.reviews ?? []) {
        const r = toReview(raw);
        if (!r) continue;
        n += 1;
        if (r.date && new Date(r.date) < cutoff) {
          pastWindow = true;
          continue;
        }
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        reviews.push(r);
      }
      return { n, pastWindow };
    };

    /** Walk a filter combination from page `from` to Trustpilot's cap. */
    const walk = async (
      params: Record<string, string>,
      label: string,
      totalPages: number,
      from = 1,
      date: string | null = "last12months",
    ) => {
      const last = Math.min(totalPages, MAX_PAGES_PER_FILTER);
      for (let p = from; p <= last; p++) {
        if (Date.now() > deadline) {
          truncated = true;
          return;
        }
        opts.onProgress?.(`${label}: page ${p}/${last}`);
        const pp = await readPage(page, listUrl(params, p, date));
        if (!pp) {
          truncated = true;
          return;
        }
        pagesRead += 1;
        const { n, pastWindow } = absorb(pp);
        if (pastWindow || n < PER_PAGE) return;
      }
      if (totalPages > MAX_PAGES_PER_FILTER) truncated = true;
    };

    // 1. Probe 24 months. Trustpilot's UI only advertises 12; last24months
    // sometimes works, sometimes is ignored (treated as all-time).
    opts.onProgress?.(`Opening ${slug}`);
    const raw24 = await readPage(page, listUrl({}, 1, "last24months"));
    const raw12 = await readPage(page, listUrl({}, 1, "last12months"));
    pagesRead += (raw24 ? 1 : 0) + (raw12 ? 1 : 0);

    let dateParam: string | null = "last12months";
    let horizonMonths: 12 | 24 = 12;
    let first = raw12 ?? raw24;
    if (raw24?.businessUnit && raw12?.businessUnit) {
      const all = raw24.businessUnit.numberOfReviews ?? 0;
      const c24 = raw24.filters?.pagination?.totalCount ?? 0;
      const c12 = raw12.filters?.pagination?.totalCount ?? 0;
      const treatedAsAllTime = all > 0 && c24 >= all * 0.9;
      const olderThanYear = oldestReviewMs(raw24) < Date.now() - 400 * 86_400_000;
      if (!treatedAsAllTime && (olderThanYear || (c24 > 0 && c12 > 0 && c24 > c12 * 1.08))) {
        dateParam = "last24months";
        horizonMonths = 24;
        first = raw24;
      }
    } else if (raw24?.businessUnit && !raw12) {
      first = raw24;
      dateParam = "last24months";
      horizonMonths = 24;
    }
    if (!first) {
      throw new Error(
        `Couldn't reach Trustpilot for ${slug}. The review page did not load.`,
      );
    }
    if (!first.businessUnit) {
      throw new Error(
        `${slug} has no Trustpilot profile. Try the exact domain Trustpilot lists (e.g. www.betus.com.pa).`,
      );
    }
    const displayName = first.businessUnit.displayName ?? slug;
    const trustScore = first.businessUnit.trustScore ?? null;
    const totalReviews = first.businessUnit.numberOfReviews ?? null;
    let starDistribution: StarCounts | null = null;
    const rs = first.filters?.reviewStatistics?.ratings;
    if (rs && (rs.one ?? rs.two ?? rs.three ?? rs.four ?? rs.five) != null) {
      starDistribution = {
        1: rs.one ?? 0,
        2: rs.two ?? 0,
        3: rs.three ?? 0,
        4: rs.four ?? 0,
        5: rs.five ?? 0,
      };
    }
    const windowTotal = first.filters?.pagination?.totalCount ?? null;
    const windowPages = first.filters?.pagination?.totalPages ?? 1;
    absorb(first);

    let windowStars: StarCounts | null = null;
    const coverage: GraceScrape["coverage"] = [];

    if (windowTotal != null && windowTotal <= PER_PAGE * MAX_PAGES_PER_FILTER) {
      // 2a. Small enough: plain walk gets everything.
      await walk({}, displayName, windowPages, 2, dateParam);
    } else {
      // 2b. Slice by star. Probe each star's page 1 for its exact count,
      // then walk its pages. Negative first — that's the actionable half.
      windowStars = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const star of [1, 2, 3, 4, 5] as const) {
        if (Date.now() > deadline) {
          truncated = true;
          break;
        }
        opts.onProgress?.(`${displayName}: ${star}★ reviews`);
        const pp = await readPage(page, listUrl({ stars: String(star) }, 1, dateParam));
        if (!pp) {
          truncated = true;
          continue;
        }
        pagesRead += 1;
        const count = pp.filters?.pagination?.totalCount ?? 0;
        const pages = pp.filters?.pagination?.totalPages ?? 1;
        windowStars[star] = count;
        const before = reviews.filter((r) => r.rating === star).length;
        const { n, pastWindow } = absorb(pp);
        if (!pastWindow && n >= PER_PAGE && pages > 1) {
          await walk({ stars: String(star) }, `${displayName} ${star}★`, pages, 2, dateParam);
        }
        const captured = reviews.filter((r) => r.rating === star).length;
        coverage.push({ star, total: count, captured: Math.max(captured, before) });
      }
    }

    // 3. Optional keyword deep-pull through Trustpilot's own search.
    const searched: string[] = [];
    for (const term of searchTerms) {
      if (Date.now() > deadline) {
        truncated = true;
        break;
      }
      opts.onProgress?.(`${displayName}: search "${term}"`);
      const pp = await readPage(page, listUrl({ search: term }, 1, dateParam));
      if (!pp) continue;
      pagesRead += 1;
      searched.push(term);
      const pages = pp.filters?.pagination?.totalPages ?? 1;
      const { n, pastWindow } = absorb(pp);
      if (!pastWindow && n >= PER_PAGE && pages > 1) {
        await walk({ search: term }, `${displayName} "${term}"`, pages, 2, dateParam);
      }
    }

    // 4. Older poker comments: Trustpilot's date filter tops out at 12 months
    // for most brands. Searching "poker" with no date, sliced by star, reaches
    // reviews from the year before. We still drop anything older than 24 months.
    if (Date.now() < deadline) {
      opts.onProgress?.(`${displayName}: older poker comments`);
      for (const star of [1, 2, 3, 4, 5] as const) {
        if (Date.now() > deadline) {
          truncated = true;
          break;
        }
        const pp = await readPage(page, listUrl({ search: "poker", stars: String(star) }, 1, null));
        if (!pp) continue;
        pagesRead += 1;
        const pages = pp.filters?.pagination?.totalPages ?? 1;
        const { n, pastWindow } = absorb(pp);
        if (!pastWindow && n >= PER_PAGE && pages > 1) {
          await walk(
            { search: "poker", stars: String(star) },
            `${displayName} poker ${star}★`,
            pages,
            2,
            null,
          );
        }
      }
      if (!searched.includes("poker")) searched.push("poker");
    }

    reviews.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

    return {
      slug,
      displayName,
      sourceUrl,
      window: opts.window,
      since: cutoff.toISOString(),
      fetchedAt: new Date().toISOString(),
      trustScore,
      totalReviews,
      starDistribution,
      windowTotal,
      windowStars,
      coverage,
      searched,
      reviews,
      pagesRead,
      truncated,
      horizonMonths,
    };
  } finally {
    await browser.close().catch(() => {});
    await releaseSession(session.id).catch(() => {});
  }
}
