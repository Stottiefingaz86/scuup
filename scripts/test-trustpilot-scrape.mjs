// Prove we can pull Trustpilot reviews through Browserbase.
// Run: node scripts/test-trustpilot-scrape.mjs stake.com
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const domain = process.argv[2] ?? "stake.com";
const API = "https://api.browserbase.com/v1";
const headers = {
  "X-BB-API-Key": process.env.BROWSERBASE_API_KEY,
  "Content-Type": "application/json",
};

const create = await fetch(`${API}/sessions`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    proxies: [{ type: "browserbase", geolocation: { country: "US" } }],
    timeout: 180,
  }),
});
if (!create.ok) throw new Error(await create.text());
const session = await create.json();

const browser = await chromium.connectOverCDP(session.connectUrl);
const page = browser.contexts()[0].pages()[0];

try {
  for (const p of [1, 2]) {
    const url = `https://www.trustpilot.com/review/${domain}?sort=recency${p > 1 ? `&page=${p}` : ""}`;
    await page
      .goto(url, { waitUntil: "domcontentloaded", timeout: 45000 })
      .catch((e) => console.log(`goto: ${e.message.split("\n")[0]}`));
    // Cloudflare interstitial: poll until the real page (with __NEXT_DATA__)
    // renders — Browserbase solves the challenge in the background.
    let data = null;
    for (let i = 0; i < 20 && !data; i++) {
      data = await page
        .evaluate(() => document.getElementById("__NEXT_DATA__")?.textContent ?? null)
        .catch(() => null);
      if (!data) await page.waitForTimeout(1500);
    }
    if (!data) {
      console.log(`page ${p}: NO __NEXT_DATA__ — title: ${await page.title()}`);
      continue;
    }
    const json = JSON.parse(data);
    const pp = json.props?.pageProps;
    const bu = pp?.businessUnit;
    const reviews = pp?.reviews ?? [];
    console.log(`\npage ${p}: ${url}`);
    console.log("businessUnit:", JSON.stringify({
      displayName: bu?.displayName,
      trustScore: bu?.trustScore,
      stars: bu?.stars,
      numberOfReviews: bu?.numberOfReviews,
    }));
    console.log("reviews on page:", reviews.length);
    if (p === 1 && reviews[0]) {
      const r = reviews[0];
      console.log("sample review keys:", Object.keys(r).join(", "));
      console.log("sample:", JSON.stringify({
        rating: r.rating,
        title: r.title,
        text: (r.text ?? "").slice(0, 150),
        date: r.dates?.publishedDate,
        reply: r.reply ? "yes" : "no",
        lang: r.language,
      }));
    }
  }
} finally {
  await browser.close().catch(() => {});
  await fetch(`${API}/sessions/${session.id}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      status: "REQUEST_RELEASE",
    }),
  }).catch(() => {});
}
