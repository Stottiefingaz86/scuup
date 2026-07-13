// Visual check of the archive/delete report flow on localhost.
// Run: node scripts/verify-archive-delete.mjs [projectId]
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const BASE = "http://localhost:3100";
const PROJECT = process.argv[2] ?? "proj-mrf9ncvx";
const EXEC = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const browser = await chromium.launch({ executablePath: EXEC, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

async function shot(name) {
  writeFileSync(`/tmp/archive-${name}.png`, await page.screenshot({ type: "png" }));
  console.log(`saved /tmp/archive-${name}.png`);
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
  await page.fill("#email", "admin@scuup.app");
  await page.fill("#password", "Scuup-Admin-2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });

  await page.goto(`${BASE}/projects/${PROJECT}/overview`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(2500);

  // 1. Open the project switcher — should show the "This report" section.
  await page.click('[data-slot="dropdown-menu-trigger"]');
  await page.waitForTimeout(600);
  await shot("1-menu");

  // 2. Open the archive confirm dialog.
  await page.getByText("Archive report", { exact: true }).click();
  await page.waitForTimeout(600);
  await shot("2-archive-dialog");

  // 3. Confirm archive — banner should appear.
  await page.getByRole("button", { name: "Archive report" }).click();
  await page.waitForTimeout(1500);
  await shot("3-archived-banner");

  // 4. Reactivate should fail while other reports are still active.
  await page.getByRole("button", { name: "Reactivate" }).click();
  await page.waitForTimeout(1500);
  await shot("4-reactivate-blocked");

  // 5. Delete confirm dialog (don't confirm).
  await page.click('[data-slot="dropdown-menu-trigger"]');
  await page.waitForTimeout(400);
  await page.getByText("Delete report", { exact: true }).click();
  await page.waitForTimeout(600);
  await shot("5-delete-dialog");
} finally {
  await browser.close();
}
