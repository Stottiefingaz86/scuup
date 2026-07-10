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
  seedTestPersona,
} from "./credentials-db";
import {
  buildSignupPersona,
  defaultTestPassword,
  personaVariables,
  type SignupPersona,
} from "./test-persona";

export interface SignupJob {
  brandId: string;
  status: "starting" | "running" | "success" | "failed";
  liveViewUrl: string | null;
  steps: string[];
  error: string | null;
  startedAt: number;
}

const store = globalThis as unknown as {
  __signupJobs?: Map<string, SignupJob>;
};
const jobs = (store.__signupJobs ??= new Map<string, SignupJob>());

export function getSignupJob(brandId: string): SignupJob | undefined {
  return jobs.get(brandId);
}

function push(job: SignupJob, step: string) {
  job.steps.push(step);
}

async function checkLoggedIn(stagehand: Stagehand): Promise<boolean> {
  try {
    const result = await stagehand.extract(
      "Answer with exactly LOGGED_IN or LOGGED_OUT. LOGGED_IN means a player avatar, account menu, or wallet balance for an authenticated user is visible. Prominent Sign Up / Register CTAs mean LOGGED_OUT."
    );
    return result.extraction.toUpperCase().includes("LOGGED_IN");
  } catch {
    return false;
  }
}

async function fillRegistrationStep(
  stagehand: Stagehand,
  vars: Record<string, string>
): Promise<void> {
  await stagehand.act(
    `On this registration or sign-up step, fill every visible empty field that matches the persona. Use: email %email%, password %password%, confirm password %password%, first name %firstName%, last name %lastName%, full name %fullName%, date of birth %dateOfBirthDisplay%, phone %phone%, mobile %phone%, address %addressLine1%, address line 2 %addressLine2%, city %city%, state or province %state%, postcode or zip %postalCode%, country %country%. Tick age-verification or terms checkboxes if required and visible. Only fill empty fields — do not submit yet.`,
    { variables: vars }
  );
}

/**
 * Agent-assisted signup: opens register, fills multi-step forms with the
 * market-specific persona, submits when possible. CAPTCHA / email verify
 * need the live view — same rescue flow as login.
 */
export async function startSignup(
  brandId: string,
  url: string,
  opts: {
    market: string;
    brandName: string;
    ownBrand?: boolean;
    requestedProxyCountry?: string | null;
  }
): Promise<{ liveViewUrl: string | null }> {
  const existing = jobs.get(brandId);
  if (existing && (existing.status === "starting" || existing.status === "running")) {
    return { liveViewUrl: existing.liveViewUrl };
  }

  let creds = await getCredentialsForLogin(brandId);
  if (!creds.password || !creds.persona) {
    await seedTestPersona(brandId, opts);
    creds = await getCredentialsForLogin(brandId);
  }

  const persona: SignupPersona =
    creds.persona ??
    buildSignupPersona({
      market: opts.market,
      brandName: opts.brandName,
      ownBrand: opts.ownBrand,
    });
  const password = creds.password ?? defaultTestPassword();
  const vars = personaVariables(persona, password);

  let contextId = creds.contextId;
  if (!contextId) {
    contextId = await createContext();
    await saveBrandContext(brandId, contextId);
  }

  const job: SignupJob = {
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
        timeout: 900,
        browserSettings: {
          viewport: { width: 1440, height: 900 },
          context: { id: contextId, persist: true },
        },
        ...proxyConfig(opts.requestedProxyCountry),
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

  void (async () => {
    try {
      const page =
        stagehand.context.activePage() ?? (await stagehand.context.newPage());
      await page
        .goto(url, { waitUntil: "domcontentloaded", timeoutMs: 30000 })
        .catch(() => {});
      await page.waitForTimeout(5000);
      push(job, "Site opened");

      if (await checkLoggedIn(stagehand)) {
        push(job, "Already logged in — skipping signup");
        await markLoggedIn(brandId);
        job.status = "success";
        return;
      }

      const openReg = await stagehand.act(
        "click Register, Sign Up, Join, or Create Account to open the registration form (not Log In)"
      );
      if (!openReg.success) {
        throw new Error(`Couldn't open registration: ${openReg.message}`);
      }
      push(job, "Registration form opened");
      await page.waitForTimeout(2500);

      for (let step = 1; step <= 6; step++) {
        await fillRegistrationStep(stagehand, vars);
        push(job, `Step ${step}: persona fields filled`);

        const advance = await stagehand.act(
          "If this is not the final submit screen, click Continue, Next, or Proceed. If this is the final step, click Create Account, Register, Sign Up, or Submit to complete registration."
        );
        if (!advance.success) {
          push(job, `Step ${step}: no advance button found — may be final or blocked`);
        }
        await page.waitForTimeout(4000);

        if (await checkLoggedIn(stagehand)) {
          push(job, "Registration complete — authenticated");
          await markLoggedIn(brandId);
          job.status = "success";
          return;
        }
      }

      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(5000);
        if (await checkLoggedIn(stagehand)) {
          push(job, "Authenticated after manual verification");
          await markLoggedIn(brandId);
          job.status = "success";
          return;
        }
      }

      throw new Error(
        "Signup didn't complete — finish CAPTCHA or email verification in the live view, then retry login."
      );
    } catch (e) {
      job.error = e instanceof Error ? e.message : String(e);
      job.status = "failed";
    } finally {
      await stagehand.close().catch(() => {});
    }
  })();

  return { liveViewUrl: job.liveViewUrl };
}
