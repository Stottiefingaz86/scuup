// Reproduce what the proxy does on /dashboard for each real user:
// listProjects → appHomePath. Times each query and reports payload sizes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const { data: users, error: uerr } = await db.auth.admin.listUsers();
if (uerr) throw uerr;
console.log(
  "users:",
  users.users.map((u) => `${u.email} (${u.id.slice(0, 8)})`)
);

for (const table of [
  "ps_projects",
  "ps_brands",
  "ps_analyses",
  "ps_sessions",
  "ps_action_plans",
]) {
  const t0 = Date.now();
  const { data, error } = await db.from(table).select("*");
  const ms = Date.now() - t0;
  if (error) {
    console.log(`${table}: ERROR ${error.message} (${ms}ms)`);
  } else {
    const bytes = JSON.stringify(data).length;
    console.log(
      `${table}: ${data.length} rows, ${(bytes / 1024).toFixed(1)} KB (${ms}ms)`
    );
  }
}

for (const u of users.users) {
  const t0 = Date.now();
  const { data: projects, error } = await db
    .from("ps_projects")
    .select("*")
    .eq("user_id", u.id)
    .order("created_at", { ascending: false });
  console.log(
    `\n${u.email}: ${error ? "ERR " + error.message : projects.length + " projects"} (${Date.now() - t0}ms)`
  );
  for (const p of projects ?? []) {
    console.log(`  ${p.id} status=${p.status} market=${p.market}`);
  }
}
