// Refresh src/lib/igaming-knowledge.json from iGaming Business in-depth
// reports. Fetches the reports listing, pulls each article, and asks OpenAI
// to distil citeable insights tagged by journey area / market.
//
// Run: node scripts/ingest-igaming-reports.mjs
import { readFileSync, writeFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const LISTING = "https://igamingbusiness.com/content-type/in-depth/reports/";
const LISTING_PAGES = Number(process.env.IGB_PAGES ?? 10);
const KNOWLEDGE_PATH = new URL("../src/lib/igaming-knowledge.json", import.meta.url);
const JOURNEYS = [
  "landing",
  "casino",
  "sports_betslip",
  "signup",
  "deposit",
  "withdraw",
  "loyalty_rewards",
  "support",
  "my_account",
];

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function fetchText(url) {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// Content that never helps CX scoring: salaries/recruitment, fines/AML,
// report-launch announcements, event calendars. Pruned once by hand —
// this keeps them from coming back on refresh.
const DENY =
  /(salary-survey|\/people\/|venetian|-aml-|prepares-to-release|releases-latam|betting-calendar|investment-review|illegal-gambling)/;

function articleLinks(listingHtml) {
  const links = new Set();
  for (const m of listingHtml.matchAll(
    /href="(https:\/\/igamingbusiness\.com\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/)"/g
  )) {
    const url = m[1];
    // Skip category/tag/nav pages — articles have a multi-segment slug path.
    if (/\/(content-type|category|tag|author|page)\//.test(url)) continue;
    if (DENY.test(url)) continue;
    if (url.split("/").filter(Boolean).length >= 4) links.add(url);
  }
  return [...links];
}

async function distil(url, text) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      input: [
        {
          role: "user",
          content: `You are building an iGaming competitive-intelligence knowledgebase for a CX-audit product that scores casino/sportsbook journeys (${JOURNEYS.join(", ")}).

Below is an industry article. Extract ONLY concrete, citeable facts useful for benchmarking operator CX: named operators with metrics (uptime %, overround, lost turnover), market/regulatory facts, retention/loyalty mechanics, player-behaviour findings. Skip marketing fluff, event announcements, and paywalled teasers with no substance.

Return JSON: {"worthKeeping": boolean, "title": string, "publisher": string, "date": "YYYY-MM-DD or best guess", "topics": string[], "insights": string[]}.
- topics: journey areas STRICTLY from the list above that these insights genuinely inform (be conservative — only tag a journey if an analyst scoring THAT journey would use the fact; never invent other journey names), plus "market:<Country>" tags for market-specific reports.
- insights: 1-5 self-contained sentences, each naming its numbers/operators so it can be quoted in a scoring prompt.
- worthKeeping=false if the page has no extractable substance, is a listing/hub page of headlines rather than a single article, or covers topics irrelevant to player-facing CX (salaries, M&A, fines, personnel).

URL: ${url}

ARTICLE TEXT:
${text.slice(0, 12000)}`,
        },
      ],
      text: { format: { type: "json_object" } },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const out = data.output
    ?.flatMap((o) => o.content ?? [])
    .find((c) => c.type === "output_text")?.text;
  return JSON.parse(out ?? "{}");
}

const existing = JSON.parse(readFileSync(KNOWLEDGE_PATH, "utf8"));
const byUrl = new Map(existing.sources.map((s) => [s.url, s]));

const links = new Set();
for (let p = 1; p <= LISTING_PAGES; p++) {
  const url = p === 1 ? LISTING : `${LISTING}page/${p}/`;
  try {
    const listing = await fetchText(url);
    const found = articleLinks(listing);
    for (const l of found) links.add(l);
    console.log(`listing page ${p}: ${found.length} links`);
  } catch (err) {
    console.log(`listing page ${p}: ${err.message} — stopping pagination`);
    break;
  }
}
console.log(`Found ${links.size} candidate articles across listing pages`);

for (const url of links) {
  if (byUrl.has(url)) {
    console.log(`skip (known): ${url}`);
    continue;
  }
  try {
    const html = await fetchText(url);
    // Real articles carry article:published_time; section hubs, topic
    // listings and dashboards don't — and their headline teasers distil
    // into junk "insights" that would pollute scoring prompts.
    const published = /property="article:published_time"\s+content="([^"]+)"/.exec(html)?.[1];
    if (!published) {
      console.log(`skip (not an article): ${url}`);
      continue;
    }
    const text = stripHtml(html);
    if (text.length < 800) {
      console.log(`skip (thin): ${url}`);
      continue;
    }
    const d = await distil(url, text);
    d.date = published.slice(0, 10);
    if (!d.worthKeeping || !d.insights?.length) {
      console.log(`skip (no substance): ${url}`);
      continue;
    }
    const id = url.split("/").filter(Boolean).pop();
    byUrl.set(url, {
      id,
      title: d.title,
      url,
      publisher: d.publisher || "iGaming Business",
      date: d.date,
      topics: d.topics ?? [],
      insights: d.insights,
    });
    console.log(`added: ${d.title} (${d.insights.length} insights)`);
  } catch (err) {
    console.warn(`error on ${url}: ${err.message}`);
  }
}

const next = {
  updatedAt: new Date().toISOString().slice(0, 10),
  sources: [...byUrl.values()].sort((a, b) => (a.date < b.date ? 1 : -1)),
};
writeFileSync(KNOWLEDGE_PATH, JSON.stringify(next, null, 2) + "\n");
console.log(`\nWrote ${next.sources.length} sources to src/lib/igaming-knowledge.json`);
