import type { Stagehand } from "@browserbasehq/stagehand";
import { checkAgentLoggedIn } from "./agent-login";
import {
  inboxConfigured,
  waitForVerificationEmail,
  type VerificationEmail,
} from "./verification-inbox";

type VerifyPage = {
  waitForTimeout: (ms: number) => Promise<void>;
  goto?: (
    url: string,
    opts?: { waitUntil?: "domcontentloaded"; timeoutMs?: number }
  ) => Promise<unknown>;
};

export type EmailVerifyResult = {
  /** True when OTP was typed or a confirm link was opened. */
  acted: boolean;
  method: "otp" | "link" | null;
  mail: VerificationEmail | null;
  loggedIn: boolean;
};

/**
 * Poll the shared test inbox (scuup678@gmail.com via IMAP), then
 * enter the OTP on the current page or open the confirmation link in the
 * same Browserbase session.
 */
export async function completeAgentEmailVerification(opts: {
  stagehand: Stagehand;
  page: VerifyPage;
  email: string;
  siteUrl: string;
  since: Date;
  trail?: string[];
  timeoutMs?: number;
  /** Called after a successful OTP submit or link open (e.g. screenshot). */
  afterAct?: () => Promise<void>;
}): Promise<EmailVerifyResult> {
  const {
    stagehand,
    page,
    email,
    siteUrl,
    since,
    trail = [],
    timeoutMs = 90_000,
    afterAct,
  } = opts;

  if (!inboxConfigured() || !email) {
    trail.push(
      inboxConfigured()
        ? "no email address for inbox poll"
        : "Gmail IMAP not configured — cannot auto-verify"
    );
    return { acted: false, method: null, mail: null, loggedIn: false };
  }

  let host: string | null = null;
  try {
    host = new URL(siteUrl).hostname;
  } catch {
    // Alias-only matching.
  }

  trail.push(`polling inbox for verification mail to ${email}`);
  const mail = await waitForVerificationEmail(
    { toAddress: email, since, fromDomainHint: host },
    timeoutMs
  );

  if (!mail) {
    trail.push(
      `no verification email within ${Math.round(timeoutMs / 1000)}s`
    );
    return { acted: false, method: null, mail: null, loggedIn: false };
  }

  trail.push(
    `verification email from ${mail.from}` +
      (mail.otp ? ` (OTP ${mail.otp.length} digits)` : "") +
      (mail.subject ? ` — ${mail.subject.slice(0, 80)}` : "")
  );

  if (mail.otp) {
    try {
      const res = await stagehand.act(
        "type the verification code %otp% into the code or OTP input on this page and submit or confirm it. If there are separate digit boxes, fill them left to right with the digits of %otp%.",
        { variables: { otp: mail.otp } }
      );
      if (res.success) {
        trail.push("entered emailed OTP and submitted");
        await page.waitForTimeout(5000);
        await afterAct?.().catch(() => {});
        const loggedIn = await checkAgentLoggedIn(stagehand);
        if (loggedIn) {
          trail.push("account activated after OTP");
          return { acted: true, method: "otp", mail, loggedIn: true };
        }
        // OTP may have activated without full logged-in chrome yet.
        return { acted: true, method: "otp", mail, loggedIn: false };
      }
      trail.push(`OTP act failed: ${res.message}`);
    } catch (e) {
      trail.push(
        `OTP entry error: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  for (const link of mail.links.slice(0, 2)) {
    if (!page.goto) break;
    try {
      trail.push(`opening verification link ${link.slice(0, 64)}…`);
      await page.goto(link, {
        waitUntil: "domcontentloaded",
        timeoutMs: 20000,
      });
      await page.waitForTimeout(4000);
      await afterAct?.().catch(() => {});
      const loggedIn = await checkAgentLoggedIn(stagehand);
      trail.push(
        loggedIn
          ? "opened confirm link — account activated"
          : "opened confirm link"
      );
      return { acted: true, method: "link", mail, loggedIn };
    } catch {
      // Try next candidate.
    }
  }

  return {
    acted: mail.otp != null,
    method: mail.otp ? "otp" : null,
    mail,
    loggedIn: false,
  };
}
