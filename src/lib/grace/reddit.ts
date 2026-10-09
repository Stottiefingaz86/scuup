import "server-only";

import { chromium, type Page } from "playwright-core";
import { createSession, releaseSession } from "@/lib/browserbase";
import { brandTokensFor } from "./analysis";
import { PULL_DAYS } from "./trustpilot";
import type { GraceReview } from "./types";
import { redditSubreddit } from "./types";

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API = "https://oauth.reddit.com";
const BRAND_SUBS = [
  "gambling",
  "onlinegambling",
  "sportsbook",
  "sportsbetting",
  "poker",
  "onlinepoker",
  "Poker_Sportsbooks",
  "slots",
  "casino",
];

interface TokenCache {
  access: string;
  until: number;
}

let token: TokenCache | null = null;

function userAgent(): string {
  return process.env.REDDIT_USER_AGENT?.trim() || "web:grace-voc:0.1 (by /u/scuup)";
}

function apiCredentials(): { id: string; secret: string } | null {
  const id = process.env.REDDIT_CLIENT_ID?.trim() ?? "";
  const secret = process.env.REDDIT_CLIENT_SECRET?.trim() ?? "";
  return id && secret ? { id, secret } : null;
}

export function mentionsBrand(text: string, tokens: string[]): boolean {
  const hay = text.toLowerCase();
  return tokens.some((t) => t.length >= 3 && hay.includes(t.toLowerCase()));
}

function brandQuery(tokens: string[]): string {
  const quoted = [...new Set(tokens.map((t) => t.trim()).filter((t) => t.length >= 3))]
    .slice(0, 5)
    .map((t) => `"${t.replace(/"/g, "")}"`);
  return quoted.join(" OR ") || tokens[0] || "brand";
}

export function brandPlain(tokens: string[]): string {
  return tokens.find((t) => t.length >= 3)?.replace(/"/g, "") || tokens[0] || "brand";
}

export function asReview(row: {
  id: string;
  title: string;
  text: string;
  date: string;
  author: string;
  likes: number;
  url?: string;
  source?: GraceReview["source"];
  subreddit?: string;
}): GraceReview {
  const source = row.source ?? "reddit";
  const id = row.id.includes(":") ? row.id : `${source}:${row.id}`;
  const subreddit = row.subreddit?.replace(/^r\//i, "").trim() || redditSubreddit({ url: row.url } as GraceReview);
  return {
    id,
    rating: 0,
    title: row.title.trim(),
    text: row.text.trim(),
    date: row.date,
    author: source === "reddit" && !row.author.startsWith("u/") ? `u/${row.author}` : row.author,
    country: null,
    verified: false,
    likes: row.likes,
    reply: null,
    replyDate: null,
    language: null,
    source,
    url: row.url,
    subreddit,
  };
}

export function redditSearchUrls(tokens: string[]): string[] {
  const brand = brandPlain(tokens);
  const quoted = `"${brand}"`;
  return [
    `https://www.reddit.com/search/?q=${encodeURIComponent(quoted)}&type=link&sort=new&t=year`,
    `https://www.reddit.com/search/?q=${encodeURIComponent(quoted)}&type=comment&sort=new&t=year`,
    ...BRAND_SUBS.map(
      (sub) =>
        `https://www.reddit.com/r/${sub}/search/?q=${encodeURIComponent(brand)}&restrict_sr=1&sort=new&t=year`,
    ),
  ];
}

/* ------------------------------------------------------------------ */
/* Official API (used only when Reddit app keys exist)                 */
/* ------------------------------------------------------------------ */

async function accessToken(): Promise<string> {
  if (token && token.until > Date.now() + 30_000) return token.access;
  const creds = apiCredentials();
  if (!creds) throw new Error("Reddit API keys are not set.");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.id}:${creds.secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent(),
    },
    body: "grant_type=client_credentials",
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Reddit auth failed (${res.status}).`);
  const data = JSON.parse(body) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Reddit auth returned no token.");
  token = {
    access: data.access_token,
    until: Date.now() + Math.max(60, (data.expires_in ?? 3600) - 60) * 1000,
  };
  return token.access;
}

interface RedditChild {
  kind?: string;
  data?: {
    id?: string;
    author?: string;
    created_utc?: number;
    score?: number;
    title?: string;
    selftext?: string;
    body?: string;
    permalink?: string;
    url?: string;
    link_title?: string;
    link_id?: string;
    subreddit?: string;
    stickied?: boolean;
    removed_by_category?: string | null;
    replies?: "" | Listing;
  };
}

interface Listing {
  data?: { children?: RedditChild[]; after?: string | null };
}

async function listing(
  path: string,
  params: Record<string, string>,
  pages = 2,
): Promise<{ children: RedditChild[]; pagesRead: number }> {
  const access = await accessToken();
  const children: RedditChild[] = [];
  let after: string | null = null;
  let pagesRead = 0;
  for (let i = 0; i < pages; i++) {
    const q = new URLSearchParams({ limit: "100", raw_json: "1", ...params });
    if (after) q.set("after", after);
    const res = await fetch(`${API}${path}?${q.toString()}`, {
      headers: { Authorization: `Bearer ${access}`, "User-Agent": userAgent() },
    });
    pagesRead += 1;
    if (res.status === 429) break;
    if (!res.ok) throw new Error(`Reddit search failed (${res.status}).`);
    const json = (await res.json()) as Listing;
    const batch = json.data?.children ?? [];
    children.push(...batch);
    after = json.data?.after ?? null;
    if (!after || batch.length < 25) break;
  }
  return { children, pagesRead };
}

function fromApiChild(child: RedditChild, tokens: string[], cutoff: number): GraceReview | null {
  const d = child.data;
  if (!d?.id || !d.created_utc) return null;
  if (d.stickied || d.removed_by_category) return null;
  const created = d.created_utc * 1000;
  if (created < cutoff) return null;
  const title = (d.title ?? d.link_title ?? "").trim();
  const text = (d.selftext ?? d.body ?? "").trim();
  if (!title && !text) return null;
  if (/^(\[deleted\]|\[removed\])$/.test(text) || d.author === "[deleted]") return null;
  if (child.kind === "t1") {
    if (!mentionsBrand(text, tokens)) return null;
  } else if (!mentionsBrand(`${title}\n${text}`, tokens)) {
    return null;
  }
  const permalink = d.permalink ? `https://www.reddit.com${d.permalink}` : d.url;
  return asReview({
    id: `${child.kind ?? "t3"}:${d.id}`,
    title,
    text,
    date: new Date(created).toISOString(),
    author: d.author || "Reddit",
    likes: typeof d.score === "number" ? d.score : 0,
    url: permalink,
    subreddit: d.subreddit,
  });
}

async function pullViaApi(opts: {
  tokens: string[];
  cutoff: number;
}): Promise<{ reviews: GraceReview[]; searched: string[]; pagesRead: number }> {
  const brand = brandQuery(opts.tokens);
  const reviews: GraceReview[] = [];
  const seen = new Set<string>();
  const searched = [brand];
  let pagesRead = 0;

  const absorb = (children: RedditChild[]) => {
    for (const child of children) {
      const row = fromApiChild(child, opts.tokens, opts.cutoff);
      if (!row || seen.has(row.id)) continue;
      seen.add(row.id);
      reviews.push(row);
    }
  };

  const posts = await listing("/search", { q: brand, sort: "new", t: "year", type: "link" });
  pagesRead += posts.pagesRead;
  absorb(posts.children);
  const comments = await listing("/search", { q: brand, sort: "new", t: "year", type: "comment" });
  pagesRead += comments.pagesRead;
  absorb(comments.children);
  for (const sub of BRAND_SUBS) {
    const local = await listing(`/r/${sub}/search`, {
      q: brand,
      sort: "new",
      t: "year",
      restrict_sr: "true",
      type: "link",
    });
    pagesRead += local.pagesRead;
    absorb(local.children);
    searched.push(`r/${sub}`);
  }
  return { reviews, searched, pagesRead };
}

/* ------------------------------------------------------------------ */
/* Public search pages (Browserbase) — no Reddit app keys              */
/* ------------------------------------------------------------------ */

interface HtmlHit {
  id: string;
  title: string;
  text: string;
  date: string;
  author: string;
  likes: number;
  url: string;
  subreddit?: string;
}

function redditJsonSearchUrls(tokens: string[]): string[] {
  const brand = brandPlain(tokens);
  const q = (value: string) => encodeURIComponent(value);
  return [
    `https://www.reddit.com/search.json?q=${q(brand)}&sort=new&t=year&type=link&limit=100&raw_json=1`,
    `https://www.reddit.com/search.json?q=${q(brand)}&sort=new&t=year&type=comment&limit=100&raw_json=1`,
    ...BRAND_SUBS.map(
      (sub) =>
        `https://www.reddit.com/r/${sub}/search.json?q=${q(brand)}&restrict_sr=1&sort=new&t=year&limit=100&raw_json=1`,
    ),
  ];
}

async function dismissRedditChrome(page: Page) {
  const guest = page.getByRole("link", { name: /continue without an account/i });
  if (await guest.count()) await guest.first().click().catch(() => {});
  const close = page.locator('button[aria-label="Close"], button:has-text("Not now")').first();
  if (await close.count()) await close.click().catch(() => {});
}

async function gotoRedditJson(page: Page, url: string): Promise<unknown | null> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(400);
    const text = await page.evaluate(() => document.body.innerText.trim());
    if (!text || text.startsWith("<") || !/^[[{]/.test(text)) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function flattenChildren(children: RedditChild[]): RedditChild[] {
  const out: RedditChild[] = [];
  const walk = (nodes: RedditChild[]) => {
    for (const node of nodes) {
      if (!node?.kind || node.kind === "more") continue;
      out.push(node);
      const replies = node.data?.replies;
      if (replies && typeof replies === "object") {
        walk(replies.data?.children ?? []);
      }
    }
  };
  walk(children);
  return out;
}

function listingChildren(json: unknown): RedditChild[] {
  if (Array.isArray(json)) {
    return json.flatMap((part) => listingChildren(part));
  }
  const listing = json as Listing | undefined;
  return flattenChildren(listing?.data?.children ?? []);
}

function postIdFromChild(child: RedditChild): string {
  const permalink = child.data?.permalink ?? child.data?.url ?? "";
  const fromLink = permalink.match(/comments\/([a-z0-9]+)/i)?.[1];
  if (fromLink) return fromLink;
  const linkId = child.data?.link_id?.replace(/^t3_/, "");
  if (linkId) return linkId;
  if (child.kind === "t3" && child.data?.id) return child.data.id;
  return "";
}

async function scrapeRedditSearch(opts: {
  tokens: string[];
  cutoff: number;
}): Promise<{ reviews: GraceReview[]; searched: string[]; pagesRead: number }> {
  const brand = brandPlain(opts.tokens);
  const searched = [brand, ...BRAND_SUBS.map((s) => `r/${s}`)];
  const session = await createSession(undefined, undefined, "US");
  const browser = await chromium.connectOverCDP(session.connectUrl);
  try {
    const page = browser.contexts()[0].pages()[0];
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
    const reviews = await collectRedditDeep(page, opts.tokens, opts.cutoff);
    return { reviews, searched, pagesRead: redditJsonSearchUrls(opts.tokens).length };
  } finally {
    await browser.close().catch(() => {});
    await releaseSession(session.id).catch(() => {});
  }
}

function parseRedditAge(raw: string, now = Date.now()): number | null {
  const text = raw.toLowerCase().replace(/\./g, "").trim();
  if (!text) return null;
  if (/^(just now|now|moments ago)$/.test(text)) return now;
  const unix = Number(text);
  if (Number.isFinite(unix) && unix > 1_000_000_000) {
    return unix > 10_000_000_000 ? unix : unix * 1000;
  }
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return parsed;
  const m = text.match(/(\d+)\s*(second|sec|minute|min|hour|hr|day|week|mo|month|yr|year)s?\s*ago/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2];
  const ms =
    unit.startsWith("sec") ? 1000 :
    unit.startsWith("min") ? 60_000 :
    unit.startsWith("hour") || unit === "hr" ? 3_600_000 :
    unit === "day" ? 86_400_000 :
    unit === "week" ? 7 * 86_400_000 :
    unit.startsWith("mo") ? 30.44 * 86_400_000 :
    365.25 * 86_400_000;
  return now - n * ms;
}

async function extractRedditSearchHits(page: Page, url: string): Promise<HtmlHit[]> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(800);
  await dismissRedditChrome(page);
  await page.waitForSelector('a[href*="/comments/"]', { timeout: 20_000 }).catch(() => {});
  await page.mouse.wheel(0, 2400).catch(() => {});
  await page.waitForTimeout(600);
  const blocked = await page.locator("text=/whoa there|blocked|unusual traffic/i").count();
  if (blocked) throw new Error("Reddit blocked the search page. Try again in a few minutes.");
  const hits = await page.evaluate(() => {
        const out: {
          id: string;
          title: string;
          text: string;
          date: string;
          author: string;
          likes: number;
          url: string;
          subreddit: string;
        }[] = [];
        const abs = (href: string) => {
          if (!href) return "";
          if (href.startsWith("http")) return href.replace("old.reddit.com", "www.reddit.com");
          return `https://www.reddit.com${href}`;
        };
        const idFrom = (href: string) => {
          const m = href.match(/comments\/([a-z0-9]+)/i);
          return m?.[1] ?? "";
        };
        const subFrom = (href: string) => href.match(/\/r\/([^/?#]+)/i)?.[1] ?? "";
        const push = (partial: {
          title?: string;
          href?: string;
          date?: string;
          author?: string;
          text?: string;
          likes?: number;
          subreddit?: string;
        }) => {
          const href = abs(partial.href ?? "");
          const id = idFrom(href);
          const title = (partial.title ?? "").trim();
          const text = (partial.text ?? "").trim();
          if (!id || (!title && !text)) return;
          if (out.some((r) => r.id === id)) return;
          out.push({
            id,
            title,
            text,
            date: partial.date ?? "",
            author: (partial.author ?? "Reddit").replace(/^u\//, ""),
            likes: partial.likes ?? 0,
            url: href,
            subreddit: partial.subreddit || subFrom(href),
          });
        };
        for (const el of document.querySelectorAll(".search-result, .thing.link, .thing.comment")) {
          const titleA =
            el.querySelector<HTMLAnchorElement>("a.search-title") ||
            el.querySelector<HTMLAnchorElement>("a.title") ||
            el.querySelector<HTMLAnchorElement>("a.search-link");
          const time = el.querySelector("time");
          const ago = el.querySelector("faceplate-timeago, time");
          push({
            title: titleA?.textContent ?? "",
            href: titleA?.getAttribute("href") ?? "",
            date:
              time?.getAttribute("datetime") ||
              ago?.getAttribute("ts") ||
              ago?.getAttribute("datetime") ||
              time?.getAttribute("title") ||
              ago?.textContent ||
              "",
            author: el.querySelector(".search-author a, a.author")?.textContent ?? "",
            text: el.querySelector(".search-result-body, .md, .search-expando")?.textContent ?? "",
            likes: Number((el.querySelector(".search-score, .score")?.textContent ?? "").replace(/[^\d-]/g, "")) || 0,
            subreddit: el.querySelector('a[href^="/r/"]')?.textContent?.replace(/^r\//, "") ?? "",
          });
        }
        for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href*="/comments/"]')) {
          const href = a.getAttribute("href") ?? "";
          if (!/\/comments\/[a-z0-9]+/i.test(href)) continue;
          if ((a.textContent ?? "").trim().length < 8) continue;
          const wrap = a.closest("article, search-telemetry-tracker, faceplate-tracker, div") ?? a.parentElement;
          const time = wrap?.querySelector("time, faceplate-timeago") ?? a.parentElement?.querySelector("time, faceplate-timeago");
          push({
            title: a.textContent ?? "",
            href,
            date:
              time?.getAttribute("datetime") ||
              time?.getAttribute("ts") ||
              time?.getAttribute("title") ||
              time?.textContent ||
              "",
            author: wrap?.querySelector('a[href*="/user/"], a[href*="/u/"]')?.textContent ?? "",
            text: wrap?.textContent?.slice(0, 600) ?? "",
          });
        }
        return out;
      });
  return hits;
}

export async function collectRedditFromPage(
  page: Page,
  url: string,
  tokens: string[],
  cutoff: number,
): Promise<GraceReview[]> {
  const hits = await extractRedditSearchHits(page, url);
  const reviews: GraceReview[] = [];
  for (const hit of hits) {
    const when = parseRedditAge(hit.date);
    if (when == null || when < cutoff) continue;
    if (!mentionsBrand(`${hit.title}\n${hit.text}\n${hit.url}`, tokens)) continue;
    reviews.push(
      asReview({
        ...hit,
        date: new Date(when).toISOString(),
        id: `t3:${hit.id}`,
        subreddit: hit.subreddit,
      }),
    );
  }
  return reviews;
}

async function hydrateRedditThread(
  page: Page,
  id: string,
  tokens: string[],
  cutoff: number,
): Promise<GraceReview[]> {
  const json = await gotoRedditJson(
    page,
    `https://www.reddit.com/comments/${id}.json?limit=80&raw_json=1&sort=new`,
  );
  if (json) {
    return listingChildren(json)
      .map((child) => fromApiChild(child, tokens, cutoff))
      .filter((row): row is GraceReview => Boolean(row));
  }

  await page.goto(`https://www.reddit.com/comments/${id}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await dismissRedditChrome(page);
  await page.waitForTimeout(700);
  const hits = await page.evaluate(() => {
    const out: HtmlHit[] = [];
    const post = document.querySelector("shreddit-post");
    const title =
      post?.getAttribute("post-title") ||
      document.querySelector("h1")?.textContent?.trim() ||
      document.title;
    const href = location.href;
    const idMatch = href.match(/comments\/([a-z0-9]+)/i)?.[1] ?? "";
    const sub =
      post?.getAttribute("subreddit-prefixed-name")?.replace(/^r\//, "") ||
      href.match(/\/r\/([^/?#]+)/i)?.[1] ||
      "";
    const ts =
      post?.getAttribute("created-timestamp") ||
      post?.querySelector("faceplate-timeago")?.getAttribute("ts") ||
      document.querySelector("faceplate-timeago")?.getAttribute("ts") ||
      document.querySelector("time")?.getAttribute("datetime") ||
      "";
    const text =
      document.querySelector("[id$='-post-rtjson-content'], [slot='text-body'], .expando .md")?.textContent ?? "";
    const author = post?.getAttribute("author") || "Reddit";
    if (idMatch) {
      out.push({
        id: `t3:${idMatch}`,
        title: title.trim(),
        text: text.trim().slice(0, 800),
        date: ts,
        author,
        likes: Number(post?.getAttribute("score") ?? 0) || 0,
        url: href,
        subreddit: sub,
      });
    }
    for (const comment of document.querySelectorAll("shreddit-comment")) {
      const cid = (comment.getAttribute("thingid") || comment.getAttribute("comment-id") || "").replace(/^t1_/, "");
      const body = (comment.querySelector("[id$='-comment-rtjson-content'], [slot='comment']")?.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim();
      if (!cid || body.length < 12) continue;
      out.push({
        id: `t1:${cid}`,
        title: title.trim(),
        text: body.slice(0, 800),
        date:
          comment.querySelector("faceplate-timeago")?.getAttribute("ts") ||
          comment.querySelector("time")?.getAttribute("datetime") ||
          "",
        author: comment.getAttribute("author") || "Reddit",
        likes: Number(comment.getAttribute("score") ?? 0) || 0,
        url: `${href.replace(/\/$/, "")}/${cid}/`,
        subreddit: sub,
      });
    }
    return out;
  });

  const reviews: GraceReview[] = [];
  for (const hit of hits) {
    const when = parseRedditAge(hit.date);
    if (when == null || when < cutoff) continue;
    const isComment = hit.id.startsWith("t1:");
    if (isComment && !mentionsBrand(hit.text, tokens)) continue;
    if (!isComment && !mentionsBrand(`${hit.title}\n${hit.text}`, tokens)) continue;
    reviews.push(
      asReview({
        ...hit,
        date: new Date(when).toISOString(),
      }),
    );
  }
  return reviews;
}

/** Search the public site, then open each thread for dates, subreddit, and comments. */
export async function collectRedditDeep(
  page: Page,
  tokens: string[],
  cutoff: number,
): Promise<GraceReview[]> {
  const reviews: GraceReview[] = [];
  const seen = new Set<string>();
  const postIds = new Set<string>();

  const absorb = (row: GraceReview | null) => {
    if (!row || seen.has(row.id)) return;
    seen.add(row.id);
    reviews.push(row);
  };

  for (const url of redditSearchUrls(tokens).slice(0, 5)) {
    try {
      const hits = await extractRedditSearchHits(page, url);
      for (const hit of hits) {
        if (hit.id) postIds.add(hit.id);
        const when = parseRedditAge(hit.date);
        if (when == null || when < cutoff) continue;
        if (!mentionsBrand(`${hit.title}\n${hit.text}\n${hit.url}`, tokens)) continue;
        absorb(
          asReview({
            ...hit,
            date: new Date(when).toISOString(),
            id: `t3:${hit.id}`,
            subreddit: hit.subreddit,
          }),
        );
      }
    } catch (e) {
      console.error("[grace/reddit] search page failed", url, e);
    }
  }

  const threads = [...postIds].slice(0, 24);
  for (const id of threads) {
    try {
      for (const row of await hydrateRedditThread(page, id, tokens, cutoff)) absorb(row);
    } catch (e) {
      console.error("[grace/reddit] thread failed", id, e);
    }
  }

  console.log("[grace/reddit] deep", { searchHits: postIds.size, threads: threads.length, reviews: reviews.length });
  reviews.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return reviews;
}

export async function pullRedditMentions(opts: {
  slug: string;
  displayName: string;
  days?: number;
}): Promise<{ reviews: GraceReview[]; searched: string[]; pagesRead: number }> {
  const tokens = brandTokensFor(opts.slug, opts.displayName);
  const cutoff = Date.now() - (opts.days ?? PULL_DAYS) * 86_400_000;

  if (apiCredentials()) {
    try {
      const viaApi = await pullViaApi({ tokens, cutoff });
      if (viaApi.reviews.length) {
        viaApi.reviews.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
        return { ...viaApi, reviews: viaApi.reviews.slice(0, 240) };
      }
    } catch {
      /* fall through to the public search pull */
    }
  }

  const scraped = await scrapeRedditSearch({ tokens, cutoff });
  scraped.reviews.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return { ...scraped, reviews: scraped.reviews.slice(0, 240) };
}
