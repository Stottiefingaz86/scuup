/**
 * Smoke test: admin can create a report while others stay active.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const base = "http://localhost:3100";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

const { data: signIn, error: signErr } = await admin.auth.signInWithPassword({
  email: "admin@scuup.app",
  password: "Scuup-Admin-2026!",
});
if (signErr) throw signErr;

const cookie = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]}-auth-token=${encodeURIComponent(JSON.stringify(signIn.session))}`;

const stamp = Date.now().toString(36);
const project = {
  id: `proj-test-${stamp}`,
  name: "Smoke — Admin multi",
  market: "Global (US proxy)",
  products: ["Casino"],
  journeys: ["casino"],
  analysisMode: "Public Audit Mode",
  brands: [
    {
      id: `b-${stamp}`,
      name: "Smoke",
      url: "https://example.com",
      favicon: "",
      role: "own_brand",
      analyses: {},
    },
  ],
  sessions: [],
  status: "analyzing",
  createdAt: new Date().toISOString(),
};

const res = await fetch(`${base}/api/projects`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: cookie,
  },
  body: JSON.stringify({ project }),
});

const body = await res.json().catch(() => ({}));
console.log("admin create without replace:", res.status, body);
if (!res.ok) process.exit(1);

const replace = {
  ...project,
  id: `proj-test-${stamp}-b`,
  name: "Smoke — Replace flow",
  brands: [{ ...project.brands[0], id: `b-${stamp}-2` }],
};

const res2 = await fetch(`${base}/api/projects`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: cookie,
  },
  body: JSON.stringify({ project: replace, replaceActive: true }),
});

const body2 = await res2.json().catch(() => ({}));
console.log("replaceActive create:", res2.status, body2);
if (!res2.ok) process.exit(1);

console.log("ok");
