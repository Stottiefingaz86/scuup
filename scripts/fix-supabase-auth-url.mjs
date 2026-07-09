#!/usr/bin/env node
/**
 * One-time fix: set Supabase Auth Site URL + redirect allow list for production.
 *
 * Usage:
 *   1. Create a personal access token: https://supabase.com/dashboard/account/tokens
 *   2. Run: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/fix-supabase-auth-url.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PRODUCTION_ORIGIN = "https://scuup.vercel.app";
const REDIRECT_ALLOW_LIST = [
  `${PRODUCTION_ORIGIN}/auth/callback`,
  `${PRODUCTION_ORIGIN}/**`,
  "http://localhost:3000/auth/callback",
  "http://localhost:3000/**",
].join(",");

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // optional
  }
}

loadEnvLocal();

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!token) {
  console.error(
    "Missing SUPABASE_ACCESS_TOKEN.\n" +
      "Create one at https://supabase.com/dashboard/account/tokens then re-run:\n" +
      "  SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/fix-supabase-auth-url.mjs"
  );
  process.exit(1);
}
if (!supabaseUrl) {
  console.error("Missing SUPABASE_URL in .env.local");
  process.exit(1);
}

const ref = new URL(supabaseUrl).hostname.split(".")[0];

async function main() {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const getRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers,
  });
  if (!getRes.ok) {
    console.error("Could not read auth config:", getRes.status, await getRes.text());
    process.exit(1);
  }
  const before = await getRes.json();
  console.log("Current site_url:", before.site_url);
  console.log("Current uri_allow_list:", before.uri_allow_list);

  const patchRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      site_url: PRODUCTION_ORIGIN,
      uri_allow_list: REDIRECT_ALLOW_LIST,
    }),
  });
  if (!patchRes.ok) {
    console.error("Could not update auth config:", patchRes.status, await patchRes.text());
    process.exit(1);
  }
  const after = await patchRes.json();
  console.log("\nUpdated site_url:", after.site_url);
  console.log("Updated uri_allow_list:", after.uri_allow_list);
  console.log("\nDone. Resend verification emails from the app — old links still point at localhost.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
