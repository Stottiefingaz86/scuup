import "server-only";

import { chromium, type Page } from "playwright-core";
import { createSession, releaseSession } from "@/lib/browserbase";
import { brandTokensFor } from "./analysis";
import {
  asReview,
  brandPlain,
  collectRedditDeep,
  mentionsBrand,
} from "./reddit";
import { PULL_DAYS } from "./trustpilot";
import type { GraceReview, GraceSource } from "./types";

function twoPlusTwoUrls(tokens: string[]): string[] {
  const brand = brandPlain(tokens);
  const q = encodeURIComponent(brand);
  return [
    `https://forumserver.twoplustwo.com/search.php?do=process&query=${q}&showposts=1`,
    `https://forumserver.twoplustwo.com/search.php?do=process&query=${q}&showposts=0`,
    `https://forumserver.twoplustwo.com/28/discussion-poker-sites/`,
  ];
}

async function collectGenericHits(
  page: Page,
  url: string,
  tokens: string[],
  cutoff: number,
  source: GraceSource,
): Promise<GraceReview[]> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(1000);
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return source;
    }
  })();
  const hits = await page.evaluate((hostname: string) => {
    const out: { id: string; title: string; text: string; date: string; author: string; likes: number; url: string }[] = [];
    const abs = (href: string) => {
      if (!href) return "";
      if (href.startsWith("http")) return href;
      try {
        return new URL(href, location.href).toString();
      } catch {
        return href;
      }
    };
    const seen = new Set<string>();
    const push = (href: string, title: string, text: string, date: string, author: string) => {
      const link = abs(href);
      const key = link || title;
      if (!key || seen.has(key)) return;
      if (title.trim().length < 8 && text.trim().length < 40) return;
      seen.add(key);
      out.push({
        id: key.slice(-80),
        title: title.trim().slice(0, 180),
        text: text.trim().slice(0, 800),
        date,
        author: author.trim() || hostname,
        likes: 0,
        url: link || location.href,
      });
    };
    for (const a of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
      const href = a.getAttribute("href") ?? "";
      const title = (a.textContent ?? "").replace(/\s+/g, " ").trim();
      if (title.length < 12 || title.length > 200) continue;
      if (/^(log in|sign up|register|home|next|prev|search)$/i.test(title)) continue;
      const wrap = a.closest("li, tr, article, .post, .thread, .comment, .message") ?? a.parentElement;
      const time = wrap?.querySelector("time");
      const body = (wrap?.querySelector(".postcontent, .post-content, .message, .comment-body, td")?.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim();
      push(
        href,
        title,
        body,
        time?.getAttribute("datetime") || time?.getAttribute("title") || "",
        wrap?.querySelector(".username, .author, a[href*='member']")?.textContent ?? "",
      );
    }
    if (!out.length) {
      const title = document.querySelector("h1")?.textContent?.trim() ?? document.title;
      const text = (document.querySelector("article, .postcontent, main")?.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 800);
      if (title) push(location.href, title, text, "", hostname);
    }
    return out.slice(0, 80);
  }, host);

  const reviews: GraceReview[] = [];
  for (const hit of hits) {
    const when = Date.parse(hit.date);
    if (Number.isFinite(when) && when < cutoff) continue;
    if (!Number.isFinite(when)) continue;
    if (!mentionsBrand(`${hit.title}\n${hit.text}\n${hit.url}`, tokens)) continue;
    reviews.push(
      asReview({
        ...hit,
        date: new Date(when).toISOString(),
        source,
        author: hit.author,
      }),
    );
  }
  return reviews;
}

export async function pullExtraMentions(opts: {
  slug: string;
  displayName: string;
  urls?: string[];
  days?: number;
  reddit?: boolean;
  twoplustwo?: boolean;
}): Promise<{ reviews: GraceReview[]; searched: string[]; pagesRead: number }> {
  const tokens = brandTokensFor(opts.slug, opts.displayName);
  const cutoff = Date.now() - (opts.days ?? PULL_DAYS) * 86_400_000;
  const extraUrls = (opts.urls ?? [])
    .map((u) => u.trim())
    .filter((u) => {
      try {
        const parsed = new URL(u);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    })
    .slice(0, 8);
  const wantReddit = opts.reddit !== false;
  const wantTwo = opts.twoplustwo !== false;

  const session = await createSession(undefined, undefined, "US");
  const browser = await chromium.connectOverCDP(session.connectUrl);
  const reviews: GraceReview[] = [];
  const seen = new Set<string>();
  const searched = [
    ...(wantReddit ? ["reddit"] : []),
    ...(wantTwo ? ["twoplustwo"] : []),
    ...extraUrls,
  ];
  let pagesRead = 0;

  const absorb = (rows: GraceReview[]) => {
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      reviews.push(row);
    }
  };

  try {
    const page = browser.contexts()[0].pages()[0];
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    if (wantReddit) {
      try {
        const reddit = await collectRedditDeep(page, tokens, cutoff);
        absorb(reddit);
        pagesRead += 1;
      } catch (e) {
        console.error("[grace/sources] reddit failed", e);
      }
    }

    if (wantTwo) {
      for (const url of twoPlusTwoUrls(tokens)) {
        try {
          absorb(await collectGenericHits(page, url, tokens, cutoff, "twoplustwo"));
          pagesRead += 1;
        } catch (e) {
          console.error("[grace/sources] 2+2 page failed", url, e);
        }
      }
    }

    for (const url of extraUrls) {
      try {
        absorb(await collectGenericHits(page, url, tokens, cutoff, "web"));
        pagesRead += 1;
      } catch (e) {
        console.error("[grace/sources] custom page failed", url, e);
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await releaseSession(session.id).catch(() => {});
  }

  reviews.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return { reviews: reviews.slice(0, 400), searched, pagesRead };
}
