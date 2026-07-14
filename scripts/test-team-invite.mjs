// End-to-end test of the report team invite flow against a local dev server.
// Creates an owner + viewer account, a project, invites the viewer, accepts
// the invite, verifies viewer read access + comments, then removes the seat.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const anon = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } }
  );

const PASSWORD = "E2e-test-12345!";
const stamp = Date.now().toString(36);
const users = [];

async function makeUser(label) {
  const email = `e2e-${label}-${stamp}@scuup-test.dev`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: label === "owner" ? "Olive Owner" : "Vic Viewer" },
  });
  if (error) throw error;
  users.push(data.user.id);
  const { data: signin, error: serr } = await anon().auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (serr) throw serr;
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(
    JSON.stringify(signin.session)
  ).toString("base64url")}`;
  return { email, id: data.user.id, cookie };
}

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function api(user, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Cookie: user.cookie,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
    redirect: "manual",
  });
  let body = null;
  try {
    body = await res.clone().json();
  } catch {}
  return { res, body };
}

const owner = await makeUser("owner");
const viewer = await makeUser("viewer");
console.log("owner:", owner.email, "\nviewer:", viewer.email, "\n");

const projectId = `proj-e2e-${stamp}`;
try {
  // Owner creates a project.
  const { res: createRes } = await api(owner, "/api/projects", {
    method: "POST",
    body: JSON.stringify({
      project: {
        id: projectId,
        name: "E2E Invite Test",
        market: "Brazil",
        products: ["casino"],
        journeys: ["landing"],
        analysisMode: "public",
        brands: [
          {
            id: `${projectId}-own`,
            name: "TestBrand",
            url: "https://example.com",
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
  check("owner creates project", createRes.ok, `status ${createRes.status}`);

  // Viewer cannot see it yet.
  const before = await api(viewer, "/api/projects");
  check(
    "viewer can't see project before invite",
    !before.body.projects.some((p) => p.id === projectId)
  );

  // Viewer cannot invite.
  const viewerInvite = await api(viewer, `/api/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify({ email: "x@y.dev" }),
  });
  check("non-member can't invite", viewerInvite.res.status === 403);

  // Owner invites viewer (free plan seat 1).
  const invite = await api(owner, `/api/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify({ email: viewer.email }),
  });
  check("owner invites viewer", invite.res.ok, `status ${invite.res.status}`);
  check("invite returns link", Boolean(invite.body?.inviteUrl));

  // Free plan: second invite should hit the seat limit.
  const second = await api(owner, `/api/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify({ email: "second@scuup-test.dev" }),
  });
  check("free plan blocks 2nd seat", second.res.status === 402, `status ${second.res.status}`);

  // Duplicate invite rejected.
  const dupe = await api(owner, `/api/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify({ email: viewer.email }),
  });
  check("duplicate invite rejected", [402, 409].includes(dupe.res.status));

  // Viewer accepts via the invite link (page redirects to the report).
  const token = invite.body.inviteUrl.split("/invite/")[1];
  const accept = await fetch(`${BASE}/invite/${token}`, {
    headers: { Cookie: viewer.cookie },
    redirect: "manual",
  });
  const location = accept.headers.get("location") ?? "";
  check(
    "invite accept redirects to report",
    accept.status >= 300 && accept.status < 400 && location.includes(`/projects/${projectId}/report`),
    `status ${accept.status} → ${location}`
  );

  // Viewer now sees the project as read-only.
  const after = await api(viewer, "/api/projects");
  const sharedProject = after.body.projects.find((p) => p.id === projectId);
  check("viewer sees shared project", Boolean(sharedProject));
  check("shared project marked viewer", sharedProject?.access === "viewer");

  // Owner's own list marks it owner.
  const ownerList = await api(owner, "/api/projects");
  check(
    "owner list marked owner",
    ownerList.body.projects.find((p) => p.id === projectId)?.access === "owner"
  );

  // Members list shows admin + active viewer with plan seats.
  const members = await api(owner, `/api/projects/${projectId}/members`);
  const memberEmails = (members.body?.members ?? []).map((m) => `${m.role}:${m.email}:${m.status}`);
  check(
    "members list has admin + active viewer",
    memberEmails.includes(`admin:${owner.email}:active`) &&
      memberEmails.includes(`viewer:${viewer.email}:active`),
    memberEmails.join(", ")
  );
  check("seat usage reported", members.body?.used === 1 && members.body?.inviteLimit === 1);

  // Viewer records a view + comments.
  const view = await api(viewer, `/api/projects/${projectId}/view`, { method: "POST" });
  check("viewer records read receipt", view.res.ok);

  const comment = await api(viewer, `/api/projects/${projectId}/comments`, {
    method: "POST",
    body: JSON.stringify({ sectionId: "summary", body: "Great section — one question on scoring." }),
  });
  check("viewer posts comment", comment.res.ok, `status ${comment.res.status}`);

  const ownerComments = await api(owner, `/api/projects/${projectId}/comments`);
  check(
    "owner reads viewer's comment",
    ownerComments.body?.comments?.some((c) => c.sectionId === "summary")
  );

  // Read receipt shows in members list.
  const members2 = await api(owner, `/api/projects/${projectId}/members`);
  const viewerRow = members2.body.members.find((m) => m.email === viewer.email);
  check("read receipt on member row", Boolean(viewerRow?.viewedAt), viewerRow?.viewedAt ?? "");

  // Viewer cannot delete the project or archive it.
  const viewerDelete = await api(viewer, `/api/projects/${projectId}`, { method: "DELETE" });
  check("viewer can't delete project", viewerDelete.res.status === 403);
  const viewerArchive = await api(viewer, `/api/projects/${projectId}/archive`, {
    method: "POST",
    body: JSON.stringify({ archived: true }),
  });
  check("viewer can't archive project", viewerArchive.res.status === 403);

  // Owner deletes the viewer's comment (moderation).
  const commentId = comment.body.comment.id;
  const modDelete = await api(owner, `/api/projects/${projectId}/comments/${commentId}`, {
    method: "DELETE",
  });
  check("owner moderates comment", modDelete.res.ok);

  // Owner removes the seat; viewer loses access.
  const removed = await api(owner, `/api/projects/${projectId}/members/${viewerRow.id}`, {
    method: "DELETE",
  });
  check("owner removes member", removed.res.ok);
  const afterRemoval = await api(viewer, "/api/projects");
  check(
    "viewer loses access after removal",
    !afterRemoval.body.projects.some((p) => p.id === projectId)
  );
} finally {
  await admin.from("ps_projects").delete().eq("id", projectId);
  for (const id of users) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log(`\ncleaned up. ${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
}
