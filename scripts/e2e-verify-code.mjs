// E2E: the new code-entry verification. Logs in as a fresh user on
// production, generates a real OTP via the admin API (same token the email
// would carry), submits it to /api/auth/verify-code from the browser
// session, and confirms the gate opens.
import { readFileSync } from "node:fs";
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
console.log("test user:", EMAIL);

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

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  console.log("logged in, at:", page.url());

  const before = await page.evaluate(async () => {
    const r = await fetch("/api/auth/verification");
    return r.json();
  });
  console.log("verified before:", before.emailVerified);

  // Same OTP the verification email would contain.
  const { data: link, error: lerr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
  });
  if (lerr) throw lerr;
  const otp = link.properties.email_otp;
  console.log("generated otp:", otp);

  const wrong = await page.evaluate(async () => {
    const r = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "000000" }),
    });
    return { status: r.status, body: await r.json() };
  });
  console.log("wrong code →", wrong.status, wrong.body.error?.slice(0, 60));

  const right = await page.evaluate(async (code) => {
    const r = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    return { status: r.status, body: await r.json() };
  }, otp);
  console.log("right code →", right.status, JSON.stringify(right.body));

  const after = await page.evaluate(async () => {
    const r = await fetch("/api/auth/verification");
    return r.json();
  });
  console.log("verified after:", after.emailVerified);

  if (!after.emailVerified) {
    console.error("FAIL: still unverified after correct code");
    process.exitCode = 1;
  } else {
    console.log("PASS: code entry verifies without any redirect");
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
  console.log("cleaned up");
}
