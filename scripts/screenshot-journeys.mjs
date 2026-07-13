// Visual check of a project page on localhost: log in as the admin test
// account, open the page and screenshot it (top/mid/low scroll positions).
// Run: node scripts/screenshot-journeys.mjs [projectId] [slug] [settleMs]
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const BASE = "http://localhost:3100";
const PROJECT = process.argv[2] ?? "proj-mrf9ncvx";
const SLUG = process.argv[3] ?? "journeys";
const SETTLE_MS = Number(process.argv[4] ?? 2500);
const EXEC = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const browser = await chromium.launch({ executablePath: EXEC, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
  await page.fill("#email", "admin@scuup.app");
  await page.fill("#password", "Scuup-Admin-2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  console.log("logged in, at:", page.url());

  // domcontentloaded, not networkidle: pages that auto-run long agent
  // requests (VoC scrape) keep a fetch in flight for minutes.
  await page.goto(`${BASE}/projects/${PROJECT}/${SLUG}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(SETTLE_MS);
  console.log(`${SLUG} page:`, page.url());

  writeFileSync(
    `/tmp/${SLUG}-top.png`,
    await page.screenshot({ type: "png" })
  );
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(600);
  writeFileSync(
    `/tmp/${SLUG}-mid.png`,
    await page.screenshot({ type: "png" })
  );
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(600);
  writeFileSync(
    `/tmp/${SLUG}-low.png`,
    await page.screenshot({ type: "png" })
  );
  console.log(`saved /tmp/${SLUG}-{top,mid,low}.png`);
} finally {
  await browser.close();
}
