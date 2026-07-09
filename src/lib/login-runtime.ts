import { Stagehand } from "@browserbasehq/stagehand";
import { createContext, getLiveViewUrl, proxyCountryFor } from "./browserbase";
import {
  getCredentialsForLogin,
  markLoggedIn,
  saveBrandContext,
} from "./credentials-db";

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

  const proxyCountry = proxyCountryFor(requestedProxyCountry);
  const stagehand = new Stagehand({
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
      ...(proxyCountry
        ? {
            proxies: [
              { type: "browserbase" as const, geolocation: { country: proxyCountry } },
            ],
          }
        : {}),
    },
    verbose: 0,
    disablePino: true,
  });

  await stagehand.init();
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
      await page.waitForTimeout(6000);
      push(job, "Site opened");

      // Already logged in from a previous context session?
      const already = await checkLoggedIn(stagehand);
      if (already) {
        push(job, "Session already authenticated from saved context");
        await markLoggedIn(brandId);
        job.status = "success";
        return;
      }

      const loginId = creds.email ?? creds.username!;
      const open = await stagehand.act(
        "click the log in / sign in button to open the login form (not sign up / register)"
      );
      if (!open.success) {
        throw new Error(`Couldn't open the login form: ${open.message}`);
      }
      push(job, "Login form opened");
      await page.waitForTimeout(2500);

      const fill = await stagehand.act(
        "type %loginId% into the email or username field of the login form",
        { variables: { loginId } }
      );
      if (!fill.success) throw new Error(`Couldn't fill login id: ${fill.message}`);

      const pass = await stagehand.act(
        "type %password% into the password field of the login form",
        { variables: { password: creds.password! } }
      );
      if (!pass.success) throw new Error(`Couldn't fill password: ${pass.message}`);
      push(job, "Credentials entered");

      const submit = await stagehand.act(
        "submit the login form (click the log in button inside the form)"
      );
      if (!submit.success) throw new Error(`Couldn't submit login: ${submit.message}`);
      push(job, "Login submitted — waiting for the site to authenticate");

      // Give the site time to authenticate; captchas/2FA can be solved by
      // the user in the live view while we poll for a logged-in state.
      let loggedIn = false;
      for (let i = 0; i < 24; i++) {
        await page.waitForTimeout(5000);
        loggedIn = await checkLoggedIn(stagehand);
        if (loggedIn) break;
      }
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

/** Evidence-based logged-in check: look for account UI, not marketing. */
async function checkLoggedIn(stagehand: Stagehand): Promise<boolean> {
  try {
    const result = await stagehand.extract(
      "Answer with exactly LOGGED_IN or LOGGED_OUT. LOGGED_IN means a player avatar, account menu, or wallet balance for an authenticated user is visible in the header. Prominent Sign Up / Log In / Register buttons mean LOGGED_OUT."
    );
    return result.extraction.toUpperCase().includes("LOGGED_IN");
  } catch {
    return false;
  }
}
