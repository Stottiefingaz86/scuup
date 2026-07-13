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
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForSelector("text=Rainbet", { timeout: 30000 });
await page.waitForSelector("text=FanDuel", { timeout: 30000 });

const theme = await page.evaluate(() => {
  const bg = getComputedStyle(document.documentElement)
    .getPropertyValue("--background")
    .trim();
  // Old navy theme used oklch(0.185 0.04 277) — blue hue ~275–277.
  const isNavy =
    /0\.04\s+27[0-9]/.test(bg) ||
    /0\.04\s+2[56][0-9]/.test(bg) ||
    /265|277/.test(bg);
  return { bg, isNavy };
});
if (theme.isNavy) {
  console.error(
    `Theme still looks navy (${theme.bg}) — restart dev server and retry.`
  );
  await browser.close();
  process.exit(1);
}

const hasWinna = await page.locator("text=Winna").first().isVisible().catch(() => false);
if (!hasWinna) {
  console.error("Demo overview did not render — check landing-demo project.");
  await browser.close();
  process.exit(1);
}

const hasBetonline = await page
  .locator("text=Betonline")
  .first()
  .isVisible()
  .catch(() => false);
if (hasBetonline) {
  console.error("Betonline still visible — check landing-demo brands.");
  await browser.close();
  process.exit(1);
}

await page.screenshot({ path: OUT });
console.log(`Saved ${OUT}`);
await browser.close();
