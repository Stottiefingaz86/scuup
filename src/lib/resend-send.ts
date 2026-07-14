const DEFAULT_FROM = "Scuup <onboarding@resend.dev>";

export type ResendSendResult =
  | { ok: true; id?: string }
  | { ok: false; reason: "missing_api_key" | "missing_recipient" | "send_failed"; detail?: string };

/** Sends a transactional email via Resend. */
export async function resendSend(opts: {
  from?: string;
  to: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<ResendSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key" };
  }
  if (!opts.to.length || !opts.to.every((addr) => addr.trim())) {
    return { ok: false, reason: "missing_recipient" };
  }

  const from =
    opts.from ??
    process.env.CONTACT_FROM_EMAIL ??
    process.env.INVITE_FROM_EMAIL ??
    DEFAULT_FROM;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        replyTo: opts.replyTo,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[resend]", res.status, detail);
      return { ok: false, reason: "send_failed", detail };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown error";
    console.error("[resend]", detail);
    return { ok: false, reason: "send_failed", detail };
  }
}
