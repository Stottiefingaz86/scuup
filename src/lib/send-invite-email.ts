import { resendSend } from "./resend-send";

/** Best-effort invite email via Resend. Without RESEND_API_KEY the invite
 * still works — the owner copies the link from the invite dialog. */
export async function sendInviteEmail(opts: {
  to: string;
  inviterName: string;
  reportName: string;
  inviteUrl: string;
}): Promise<boolean> {
  const result = await resendSend({
    to: [opts.to],
    subject: `${opts.inviterName} invited you to review "${opts.reportName}" on Scuup`,
    text: [
      `${opts.inviterName} shared "${opts.reportName}" with you on Scuup.`,
      "You'll have read access to the full report and can leave comments.",
      "",
      opts.inviteUrl,
    ].join("\n"),
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="font-size:18px;margin:0 0 12px">You've been invited to a competitor CX report</h2>
        <p style="font-size:14px;color:#555;line-height:1.6">
          ${opts.inviterName} shared <strong>${opts.reportName}</strong> with you on Scuup.
          You'll have read access to the full report and can leave comments.
        </p>
        <a href="${opts.inviteUrl}"
           style="display:inline-block;margin:16px 0;padding:10px 20px;background:#3ecf8e;color:#0a0a0a;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
          Open the report
        </a>
        <p style="font-size:12px;color:#999">
          If the button doesn't work, paste this link into your browser:<br/>
          ${opts.inviteUrl}
        </p>
      </div>`,
  });
  return result.ok;
}
