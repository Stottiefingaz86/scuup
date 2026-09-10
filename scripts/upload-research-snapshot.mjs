/**
 * Upload the exported research snapshot + local evidence JPEGs to Supabase.
 * Does not reshape report JSON — only rewrites /api/evidence/* to public URLs.
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const snapshotPath = path.join(root, ".data/research-snapshot.json");
const evidenceDir = path.join(root, ".evidence");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY required");
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const projects = JSON.parse(await readFile(snapshotPath, "utf8"));
if (!Array.isArray(projects)) throw new Error("snapshot is not an array");

const names = new Set();
const collect = (v) => {
  if (typeof v === "string") {
    const m = v.match(/^\/api\/evidence\/([a-z0-9-]+\.jpg)$/);
    if (m) names.add(m[1]);
  } else if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === "object") Object.values(v).forEach(collect);
};
collect(projects);

const urlByName = new Map();
let uploaded = 0;
for (const name of names) {
  const body = await readFile(path.join(evidenceDir, name));
  const { error } = await db.storage.from("evidence").upload(name, body, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`${name}: ${error.message}`);
  }
  const { data } = db.storage.from("evidence").getPublicUrl(name);
  urlByName.set(name, data.publicUrl);
  uploaded += 1;
}

const rewrite = (v) => {
  if (typeof v === "string") {
    const m = v.match(/^\/api\/evidence\/([a-z0-9-]+\.jpg)$/);
    return m ? (urlByName.get(m[1]) ?? v) : v;
  }
  if (Array.isArray(v)) return v.map(rewrite);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v).map(([k, val]) => [k, rewrite(val)]),
    );
  }
  return v;
};

const rewritten = rewrite(projects);
const { error } = await db.from("research_workspace").upsert({
  id: "default",
  projects: rewritten,
  updated_at: new Date().toISOString(),
});
if (error) throw new Error(error.message);

const runs = rewritten.reduce((n, p) => n + (p.runs?.length ?? 0), 0);
console.log(
  JSON.stringify({
    projects: rewritten.length,
    runs,
    images: uploaded,
  }),
);
