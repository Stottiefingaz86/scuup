// Visual check of the report invite/comments UI against local dev.
// Creates a test owner + draft project, then screenshots the report page,
// the invite dialog, and a posted section comment using local Chrome.
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
const EMAIL = `e2e-ui-${stamp}@scuup-test.dev`;
const PASSWORD = "E2e-test-12345!";

const { data: created, error } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { full_name: "Christopher Hunt" },
});
if (error) throw error;

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } }
);
const { data: signin, error: serr } = await anon.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
});
if (serr) throw serr;
const cookieValue = `base64-${Buffer.from(JSON.stringify(signin.session)).toString("base64url")}`;

const projectId = `proj-ui-${stamp}`;
const createRes = await fetch(`${BASE}/api/projects`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: `sb-${ref}-auth-token=${cookieValue}`,
  },
  body: JSON.stringify({
    project: {
      id: projectId,
      name: "Winna — Brazil",
      market: "Brazil",
      products: ["casino"],
      journeys: ["landing"],
      analysisMode: "public",
      brands: [
        {
          id: `${projectId}-own`,
          name: "Winna",
          url: "https://winna.com",
          favicon: "",
          role: "own_brand",
          analyses: {},
        },
      ],
      sessions: [],
      status: "draft",
      createdAt: new Date().toISOString(),
    },
  }),
});
if (!createRes.ok) throw new Error(`project create failed: ${createRes.status}`);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
await context.addCookies([
  {
    name: `sb-${ref}-auth-token`,
    value: cookieValue,
    domain: "localhost",
    path: "/",
  },
]);
const page = await context.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

try {
  await page.goto(`${BASE}/projects/${projectId}/report`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(1500);
  writeFileSync("/tmp/ui-report.png", await page.screenshot());
  console.log("report page:", page.url());

  // Invite dialog.
  await page.getByRole("button", { name: "Invite team" }).click();
  await page.waitForTimeout(800);
  await page.getByPlaceholder("teammate@company.com").fill("designer@team.com");
  writeFileSync("/tmp/ui-invite-dialog.png", await page.screenshot());
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await page.waitForTimeout(1500);
  writeFileSync("/tmp/ui-invite-sent.png", await page.screenshot());
  console.log("invite dialog captured");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // Section comment.
  await page.getByRole("button", { name: "Comment" }).first().click();
  await page.waitForTimeout(400);
  await page
    .getByPlaceholder("Add a comment…")
    .fill("Can we double-check the ranking methodology before the QBR?");
  await page.getByTitle("Post comment").click();
  await page.waitForTimeout(1200);
  writeFileSync("/tmp/ui-comment.png", await page.screenshot());
  console.log("comment captured");
} finally {
  await browser.close().catch(() => {});
  await admin.from("ps_projects").delete().eq("id", projectId);
  await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
  console.log("cleaned up");
}
