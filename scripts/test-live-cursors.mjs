// Two-browser test: owner + invited viewer on the same report at once.
// Verifies Supabase Realtime presence (facepile), live cursors, and the
// viewer's restricted sidebar.
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const stamp = Date.now().toString(36);
const PASSWORD = "E2e-test-12345!";
const users = [];

async function makeUser(label, fullName) {
  const email = `e2e-${label}-${stamp}@scuup-test.dev`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  users.push(data.user.id);
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } }
  );
  const { data: signin, error: serr } = await anon.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (serr) throw serr;
  return {
    email,
    cookie: `base64-${Buffer.from(JSON.stringify(signin.session)).toString("base64url")}`,
  };
}

const owner = await makeUser("owner", "Olive Owner");
const viewer = await makeUser("viewer", "Vic Viewer");

const projectId = `proj-live-${stamp}`;
const post = (path, body, cookie) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `sb-${ref}-auth-token=${cookie}` },
    body: JSON.stringify(body),
  });

const createRes = await post("/api/projects", {
  project: {
    id: projectId,
    name: "Live Cursor Test",
    market: "Brazil",
    products: ["casino"],
    journeys: [],
    analysisMode: "public",
    brands: [
      { id: `${projectId}-own`, name: "Winna", url: "https://winna.com", favicon: "", role: "own_brand", analyses: {} },
    ],
    sessions: [],
    status: "draft",
    createdAt: new Date().toISOString(),
  },
}, owner.cookie);
if (!createRes.ok) throw new Error(`project create failed ${createRes.status}`);

const inviteRes = await post(`/api/projects/${projectId}/members`, { email: viewer.email }, owner.cookie);
const invite = await inviteRes.json();
if (!inviteRes.ok) throw new Error(`invite failed: ${JSON.stringify(invite)}`);
const token = invite.inviteUrl.split("/invite/")[1];

const browser = await chromium.launch({ channel: "chrome", headless: true });
async function openAs(cookie, path) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    { name: `sb-${ref}-auth-token`, value: cookie, domain: "localhost", path: "/" },
  ]);
  const page = await context.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60000 });
  return page;
}

try {
  // Viewer accepts the invite, lands on the report.
  const viewerPage = await openAs(viewer.cookie, `/invite/${token}`);
  await viewerPage.waitForURL(`**/projects/${projectId}/report`, { timeout: 30000 });
  console.log("viewer landed:", viewerPage.url());

  const ownerPage = await openAs(owner.cookie, `/projects/${projectId}/report`);
  await ownerPage.waitForTimeout(4000); // realtime join

  // Owner wiggles the cursor over the report.
  const doc = ownerPage.locator(".report-document");
  const box = await doc.boundingBox();
  for (let i = 0; i < 10; i++) {
    await ownerPage.mouse.move(
      box.x + box.width * (0.3 + 0.04 * i),
      box.y + 220 + i * 8
    );
    await ownerPage.waitForTimeout(120);
  }
  await viewerPage.waitForTimeout(1500);

  const viewerShot = await viewerPage.screenshot();
  writeFileSync("/tmp/ui-viewer-live.png", viewerShot);

  const facepile = await viewerPage.getByText("2 viewing").count();
  console.log("viewer sees '2 viewing':", facepile > 0);
  const cursorLabel = await viewerPage.getByText("Olive Owner", { exact: true }).count();
  console.log("viewer sees owner's cursor label:", cursorLabel > 0);

  // Viewer's sidebar should only offer the Report.
  const navOverview = await viewerPage.getByRole("link", { name: "Overview" }).count();
  const sharedLabel = await viewerPage.getByText("Shared with you").count();
  console.log("viewer nav hides Overview:", navOverview === 0, "| shows 'Shared with you':", sharedLabel > 0);

  // And no invite input (not the owner).
  await viewerPage.getByRole("button", { name: "Invite team" }).click();
  await viewerPage.waitForTimeout(800);
  const inviteInput = await viewerPage.getByPlaceholder("teammate@company.com").count();
  console.log("viewer invite dialog is read-only:", inviteInput === 0);
  writeFileSync("/tmp/ui-viewer-dialog.png", await viewerPage.screenshot());

  const ownerShot = await ownerPage.screenshot();
  writeFileSync("/tmp/ui-owner-live.png", ownerShot);
} finally {
  await browser.close().catch(() => {});
  await admin.from("ps_projects").delete().eq("id", projectId);
  for (const id of users) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log("cleaned up");
}
