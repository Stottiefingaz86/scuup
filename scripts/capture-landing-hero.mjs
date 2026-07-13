/**
 * Capture the landing hero from the static demo project (Winna vs Stake,
 * Rainbet, FanDuel). No brand blurring — these are the intended examples.
 *
 *   node scripts/capture-landing-hero.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright-core";

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const BASE = process.env.LANDING_CAPTURE_BASE ?? "http://localhost:3100";
const OUT = "public/landing/app-overview.png";

const EXEC =
  process.env.HOME +
  "/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const browser = await chromium.launch({ executablePath: EXEC, headless: true });
const page = await browser.newPage({
  viewport: { width: 1520, height: 940 },
  deviceScaleFactor: 2,
});

await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
await page.fill("#email", "admin@scuup.app");
await page.fill("#password", "Scuup-Admin-2026!");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
  timeout: 30000,
});

await page.goto(`${BASE}/projects/landing-demo/overview`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(8000);

const hasWinna = await page.locator("text=Winna").first().isVisible().catch(() => false);
if (!hasWinna) {
  console.error("Demo overview did not render — check landing-demo project.");
  await browser.close();
  process.exit(1);
}

await page.screenshot({ path: OUT });
console.log(`Saved ${OUT}`);
await browser.close();
