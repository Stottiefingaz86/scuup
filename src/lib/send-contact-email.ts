import { resendSend } from "./resend-send";

/** Sends a landing-page contact form submission via Resend. */
export async function sendContactEmail(opts: {
  name: string;
  email: string;
  company?: string;
  message: string;
}): Promise<boolean> {
  const to = process.env.CONTACT_TO_EMAIL?.trim();
  if (!to) {
    console.error("[contact] CONTACT_TO_EMAIL is not configured");
    return false;
  }

  const companyLine = opts.company
    ? `<p style="font-size:14px;color:#555;margin:0 0 8px"><strong>Company:</strong> ${escapeHtml(opts.company)}</p>`
    : "";

  const text = [
    "New contact form submission",
    "",
    `Name: ${opts.name}`,
    `Email: ${opts.email}`,
    opts.company ? `Company: ${opts.company}` : null,
    "",
    "Message:",
    opts.message,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await resendSend({
    to: [to],
    replyTo: opts.email,
    subject: `Scuup contact: ${opts.name}`,
    text,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="font-size:18px;margin:0 0 16px">New contact form submission</h2>
        <p style="font-size:14px;color:#555;margin:0 0 8px"><strong>Name:</strong> ${escapeHtml(opts.name)}</p>
        <p style="font-size:14px;color:#555;margin:0 0 8px"><strong>Email:</strong> ${escapeHtml(opts.email)}</p>
        ${companyLine}
        <p style="font-size:14px;color:#555;margin:16px 0 8px"><strong>Message:</strong></p>
        <p style="font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap;margin:0">${escapeHtml(opts.message)}</p>
      </div>`,
  });

  return result.ok;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
