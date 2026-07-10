// End-to-end login reproduction against production using Browserbase.
// Creates a confirmed test user, logs in at /login, follows the redirect,
// then opens the account menu — logging console errors and final URLs.
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const BASE = process.env.E2E_BASE ?? "https://scuup.vercel.app";
const EMAIL = `e2e-${Date.now().toString(36)}@scuup-test.dev`;
const PASSWORD = "E2e-test-12345!";

const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);
const { data: created, error: cerr } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
});
if (cerr) throw cerr;
console.log("test user:", EMAIL, created.user.id);

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
    region: "eu-central-1",
    timeout: 300,
  }),
});
if (!create.ok) throw new Error(await create.text());
const session = await create.json();

const browser = await chromium.connectOverCDP(session.connectUrl);
const page = browser.contexts()[0].pages()[0];

page.on("console", (msg) => {
  if (msg.type() === "error") console.log("[console.error]", msg.text().slice(0, 300));
});
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
page.on("response", (res) => {
  if (res.status() >= 400) {
    console.log("[http]", res.status(), res.url().slice(0, 140));
  }
});

try {
  console.log("\n--- goto /login ---");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
  console.log("at:", page.url());

  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for the post-login redirect chain to settle.
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  console.log("after login:", page.url());
  const shot1 = await page.screenshot({ type: "jpeg", quality: 60 });
  writeFileSync("/tmp/e2e-after-login.jpg", shot1);

  // Navigate to landing and click the account chip.
  console.log("\n--- goto / (landing) ---");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 45000 });
  console.log("at:", page.url());
  const chip = page.getByRole("button", { name: "Open account menu" });
  const chipCount = await chip.count();
  console.log("account chip present:", chipCount);
  if (chipCount > 0) {
    await chip.first().click();
    await page.waitForTimeout(1200);
    const menuVisible = await page
      .getByRole("menuitem", { name: /dashboard/i })
      .isVisible()
      .catch(() => false);
    console.log("menu opened with Dashboard item:", menuVisible);
    const shot2 = await page.screenshot({ type: "jpeg", quality: 60 });
    writeFileSync("/tmp/e2e-menu.jpg", shot2);
    if (menuVisible) {
      await page.getByRole("menuitem", { name: /dashboard/i }).click();
      await page.waitForTimeout(2500);
      console.log("after Dashboard click:", page.url());
      const shot3 = await page.screenshot({ type: "jpeg", quality: 60 });
      writeFileSync("/tmp/e2e-after-dashboard.jpg", shot3);
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
  await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
  console.log("\ncleaned up test user + session");
}
