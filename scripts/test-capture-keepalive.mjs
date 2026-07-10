// Smoke test: keepAlive session survives a CDP disconnect and a fresh
// process can re-attach via GET /sessions/{id} connectUrl.
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

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
    keepAlive: true,
  }),
});
if (!create.ok) {
  console.error("CREATE FAILED", create.status, await create.text());
  process.exit(1);
}
const session = await create.json();
console.log("created", session.id, "keepAlive:", session.keepAlive);

// First connection — navigate somewhere.
const b1 = await chromium.connectOverCDP(session.connectUrl);
const p1 = b1.contexts()[0]?.pages()[0] ?? (await b1.contexts()[0].newPage());
await p1.goto("https://example.com", { waitUntil: "domcontentloaded" });
console.log("first connection at:", p1.url());
await b1.close();
console.log("disconnected");

await new Promise((r) => setTimeout(r, 5000));

// Check status after disconnect.
const check = await fetch(`${API}/sessions/${session.id}`, { headers });
const state = await check.json();
console.log("status after disconnect:", state.status);

if (state.status === "RUNNING") {
  // Reconnect like a fresh serverless instance would.
  const b2 = await chromium.connectOverCDP(state.connectUrl);
  const p2 = b2.contexts()[0]?.pages()[0];
  console.log("reconnected, page url:", p2?.url());
  const cdp = await b2.contexts()[0].newCDPSession(p2);
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "jpeg",
    quality: 50,
  });
  console.log("screenshot after reconnect:", data.length, "bytes b64");
  await b2.close();
}

await fetch(`${API}/sessions/${session.id}`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    status: "REQUEST_RELEASE",
  }),
});
console.log("released");
