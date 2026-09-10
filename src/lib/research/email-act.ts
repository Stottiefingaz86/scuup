import type { Stagehand } from "@browserbasehq/stagehand";
import { checkAgentLoggedIn } from "../agent-login";
import { captureResearchShot } from "./capture-shot";
import {
  fetchInboxEmailsSince,
  pickActionableLink,
  type CapturedInboxEmail,
} from "./email-monitor";
import type { EmailWatchItem } from "./types";

type AgentPage = {
  waitForTimeout: (ms: number) => Promise<void>;
  goto?: (
    url: string,
    opts?: { waitUntil?: "domcontentloaded"; timeoutMs?: number }
  ) => Promise<unknown>;
  screenshot?: (opts?: {
    type?: "jpeg" | "png";
    quality?: number;
  }) => Promise<Buffer | Uint8Array>;
};

export type EmailActionRecord = {
  email: CapturedInboxEmail;
  actionTaken: NonNullable<EmailWatchItem["actionTaken"]>;
  actionResult: string;
  screenshotUrls: string[];
  stageId: string;
};

/**
 * Pull new inbox mail since `since`, skip already-seen ids, and for each
 * actionable message: enter OTP or open CTA link back on the brand site,
 * screenshot, and return evidence records.
 */
export async function syncAndActOnEmails(opts: {
  stagehand: Stagehand;
  page: AgentPage;
  email: string;
  siteUrl: string;
  since: Date;
  seenIds: Set<string>;
  stageId: string;
  trail?: string[];
}): Promise<EmailActionRecord[]> {
  const {
    stagehand,
    page,
    email,
    siteUrl,
    since,
    seenIds,
    stageId,
    trail = [],
  } = opts;

  let host: string | null = null;
  try {
    host = new URL(siteUrl).hostname;
  } catch {
    // ignore
  }

  let messages: CapturedInboxEmail[] = [];
  try {
    messages = await fetchInboxEmailsSince({
      toAddress: email,
      since,
      fromDomainHint: host,
      limit: 30,
    });
  } catch (e) {
    trail.push(
      `inbox sync failed: ${e instanceof Error ? e.message : String(e)}`
    );
    return [];
  }

  const fresh = messages.filter((m) => !seenIds.has(m.id));
  const records: EmailActionRecord[] = [];

  for (const mail of fresh) {
    seenIds.add(mail.id);
    trail.push(
      `email · ${mail.category} · ${mail.subject.slice(0, 72)} · from ${mail.from}`
    );

    const shots: string[] = [];
    let actionTaken: EmailActionRecord["actionTaken"] = "noted";
    let actionResult = "Logged for evidence";

    // Verify / OTP first
    if (mail.category === "verify" && mail.otp) {
      try {
        const res = await stagehand.act(
          "type the verification code %otp% into the code or OTP input on this page and submit or confirm it. If there are separate digit boxes, fill them left to right with the digits of %otp%.",
          { variables: { otp: mail.otp } }
        );
        if (res.success) {
          actionTaken = "otp_entered";
          actionResult = "OTP submitted on site";
          trail.push(`acted · OTP entered (${mail.otp.length} digits)`);
          await page.waitForTimeout(4000);
          const shot = await captureResearchShot(page);
          if (shot) shots.push(shot);
          if (await checkAgentLoggedIn(stagehand)) {
            actionResult = "OTP submitted — account activated";
          }
        } else {
          actionResult = `OTP act failed: ${res.message}`;
        }
      } catch (e) {
        actionResult = `OTP error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    // Open verify / promo / deposit CTA links back on the brand
    if (
      actionTaken === "noted" &&
      (mail.category === "verify" ||
        mail.category === "bonus" ||
        mail.category === "welcome" ||
        mail.category === "deposit_nudge" ||
        mail.links.length > 0)
    ) {
      const link =
        pickActionableLink(mail, host) ??
        (mail.category === "verify" || mail.category === "welcome"
          ? mail.links[0]
          : null);
      if (link && page.goto) {
        try {
          trail.push(`acted · opening ${link.slice(0, 64)}…`);
          await page.goto(link, {
            waitUntil: "domcontentloaded",
            timeoutMs: 25000,
          });
          await page.waitForTimeout(3500);
          const shot = await captureResearchShot(page);
          if (shot) shots.push(shot);
          actionTaken = "link_opened";
          const loggedIn = await checkAgentLoggedIn(stagehand);
          actionResult = loggedIn
            ? "Opened email link — logged in on site"
            : "Opened email link — documented landing page";
          // Return toward brand home if we landed on a dead thank-you page
          if (!loggedIn && host) {
            await page
              .goto(siteUrl, {
                waitUntil: "domcontentloaded",
                timeoutMs: 20000,
              })
              .catch(() => {});
            await page.waitForTimeout(2000);
            const homeShot = await captureResearchShot(page);
            if (homeShot) shots.push(homeShot);
          }
        } catch (e) {
          actionResult = `Link open failed: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
    }

    // Do NOT screenshot whatever page happens to be open — that attached
    // Bovada captures to Winna welcome mail during batch runs.
    // Only keep shots from intentional OTP / link actions above.

    records.push({
      email: mail,
      actionTaken,
      actionResult,
      screenshotUrls: shots,
      stageId,
    });
  }

  return records;
}
