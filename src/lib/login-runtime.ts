import { Stagehand } from "@browserbasehq/stagehand";
import {
  createContext,
  getLiveViewUrl,
  proxyConfig,
  withSessionRetry,
} from "./browserbase";
import {
  getCredentialsForLogin,
  markLoggedIn,
  saveBrandContext,
} from "./credentials-db";
import { preparePageAfterNavigation } from "./dismiss-site-cookies";
import { checkAgentLoggedIn, performAgentLogin } from "./agent-login";

export interface LoginJob {
  brandId: string;
  status: "starting" | "running" | "success" | "failed";
  liveViewUrl: string | null;
  steps: string[];
  error: string | null;
  startedAt: number;
}

/** Survive HMR in dev by stashing jobs on globalThis. */
const store = globalThis as unknown as {
  __loginJobs?: Map<string, LoginJob>;
};
const jobs = (store.__loginJobs ??= new Map<string, LoginJob>());

export function getLoginJob(brandId: string): LoginJob | undefined {
  return jobs.get(brandId);
}

function push(job: LoginJob, step: string) {
  job.steps.push(step);
}

/**
 * Agent-driven login: opens the site with the brand's persistent context,
 * fills the stored credentials (passed as Stagehand variables so secrets
 * never enter a prompt), and persists the logged-in cookie state back to
 * the context. The live view URL lets the user rescue captchas/2FA.
 */
export async function startLogin(
  brandId: string,
  url: string,
  requestedProxyCountry?: string | null
): Promise<{ liveViewUrl: string | null }> {
  const existing = jobs.get(brandId);
  if (existing && (existing.status === "starting" || existing.status === "running")) {
    return { liveViewUrl: existing.liveViewUrl };
  }

  const creds = await getCredentialsForLogin(brandId);
  if (!creds.password || !(creds.email || creds.username)) {
    throw new Error(
      "No stored credentials for this brand — add an email/username and password first."
    );
  }

  let contextId = creds.contextId;
  if (!contextId) {
    contextId = await createContext();
    await saveBrandContext(brandId, contextId);
  }

  const job: LoginJob = {
    brandId,
    status: "starting",
    liveViewUrl: null,
    steps: [],
    error: null,
    startedAt: Date.now(),
  };
  jobs.set(brandId, job);

  // Retry on Browserbase's 5-creates-per-minute burst limit.
  const stagehand = await withSessionRetry(async () => {
    const sh = new Stagehand({
      env: "BROWSERBASE",
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      model: {
        modelName: `openai/${process.env.OPENAI_MODEL ?? "gpt-5.4-mini"}`,
        apiKey: process.env.OPENAI_API_KEY,
      },
      browserbaseSessionCreateParams: {
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        region: (process.env.BROWSERBASE_REGION ?? "eu-central-1") as "eu-central-1",
        timeout: 600,
        browserSettings: {
          viewport: { width: 1440, height: 900 },
          context: { id: contextId, persist: true },
        },
        ...proxyConfig(requestedProxyCountry),
      },
      verbose: 0,
      disablePino: true,
    });
    await sh.init();
    return sh;
  });
  const sessionId = stagehand.browserbaseSessionID;
  if (sessionId) {
    job.liveViewUrl = await getLiveViewUrl(sessionId).catch(() => null);
  }
  job.status = "running";

  // The login itself runs in the background; the client polls job status
  // and can embed the live view to rescue captchas or 2FA prompts.
  void (async () => {
    try {
      const page =
        stagehand.context.activePage() ?? (await stagehand.context.newPage());
      await page
        .goto(url, { waitUntil: "domcontentloaded", timeoutMs: 30000 })
        .catch(() => {});
      await preparePageAfterNavigation(page, stagehand);
      await page.waitForTimeout(4500);
      push(job, "Site opened");

      // Already logged in from a previous context session?
      const already = await checkAgentLoggedIn(stagehand);
      if (already) {
        push(job, "Session already authenticated from saved context");
        await markLoggedIn(brandId);
        job.status = "success";
        return;
      }

      const loggedIn = await performAgentLogin(
        stagehand,
        page,
        {
          email: creds.email,
          username: creds.username,
          password: creds.password!,
        },
        { dismissCookies: false }
      );

      if (!loggedIn) {
        throw new Error(
          "Login didn't complete — a captcha, 2FA prompt, or wrong credentials may be blocking it. Open the live view and finish the login manually, then retry."
        );
      }

      push(job, "Authenticated — session saved to the brand's browser context");
      await markLoggedIn(brandId);
      job.status = "success";
    } catch (e) {
      job.error = e instanceof Error ? e.message : String(e);
      job.status = "failed";
    } finally {
      // Closing persists cookies back to the context (persist: true).
      await stagehand.close().catch(() => {});
    }
  })();

  return { liveViewUrl: job.liveViewUrl };
}
