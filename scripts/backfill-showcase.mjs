/**
 * Backfill ps_showcase_snapshots from all completed/archived projects.
 *   npx tsx scripts/backfill-showcase.mjs
 */
import fs from "node:fs";

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const { backfillShowcaseFromAllProjects } = await import(
  "../src/lib/showcase-db.ts"
);

const n = await backfillShowcaseFromAllProjects();
console.log(`Synced ${n} brand snapshot(s) from completed projects.`);
