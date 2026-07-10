// Switch the verification email to a code-first template: the user types
// the code into the app instead of clicking a link (the link remains as a
// fallback). Also shortens the OTP to 6 digits.
// Usage: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/set-otp-email-template.mjs
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN required");
const ref = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];

const TEMPLATE = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
<h2 style="margin:0 0 8px;font-size:20px">Scuup<span style="color:#2563eb">.</span></h2>
<p style="font-size:15px;line-height:1.6">Enter this code in Scuup to confirm your email:</p>
<p style="margin:20px 0;font-size:34px;font-weight:700;letter-spacing:8px;font-family:SFMono-Regular,Menlo,Consolas,monospace;color:#111">{{ .Token }}</p>
<p style="font-size:13px;color:#666;line-height:1.6">Prefer a link? <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email" style="color:#2563eb">Confirm in the browser</a> instead.<br/>If you didn't request this, you can ignore this email.</p>
</div>`;

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/config/auth`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mailer_otp_length: 6,
      mailer_subjects_magic_link: "{{ .Token }} is your Scuup code",
      mailer_templates_magic_link_content: TEMPLATE,
    }),
  }
);
if (!res.ok) {
  console.error("PATCH failed:", res.status, await res.text());
  process.exit(1);
}
const after = await res.json();
console.log("otp length:", after.mailer_otp_length);
console.log("subject:", after.mailer_subjects_magic_link);
console.log("template updated:", after.mailer_templates_magic_link_content.includes("{{ .Token }}"));
