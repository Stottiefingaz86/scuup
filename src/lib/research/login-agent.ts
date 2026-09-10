import type { Stagehand } from "@browserbasehq/stagehand";
import { completeAgentEmailVerification } from "../agent-email-verify";
import { checkAgentLoggedIn } from "../agent-login";
import { DEFAULT_TEST_EMAIL } from "../constants";
import { preparePageAfterNavigation } from "../dismiss-site-cookies";
import { defaultTestPassword } from "../test-persona";
import { fastFillLoginCredentials } from "./fast-fill";
import {
  attachRedirectCounter,
  countVisibleErrors,
  observeStageFriction,
} from "./instrumentation";
import type { JourneyStageTracker } from "./stage-tracker";
import { normalizeFrictionType } from "./friction";
import { STAGE_OWNERS } from "./journeys";
import type { ResearchPersona } from "./types";

type AgentPage = NonNullable<
  Awaited<ReturnType<Stagehand["context"]["activePage"]>>
>;

async function annotate(
  stagehand: Stagehand,
  tracker: JourneyStageTracker,
  stageId: string,
  evidence: string,
  extra: Record<string, unknown> = {}
) {
  const obs = await observeStageFriction(
    stagehand,
    tracker.stage(stageId)?.label ?? stageId
  );
  tracker.end(stageId, {
    evidence,
    owner: STAGE_OWNERS[stageId],
    friction: obs.friction ?? undefined,
    userImpact: obs.userImpact ?? undefined,
    frictionType: normalizeFrictionType(obs.frictionType),
    severity: obs.severity,
    ...extra,
  });
}

/** Returning player: entry → login → OTP → success → resume play. */
export async function runReturningLoginFlow(
  stagehand: Stagehand,
  page: AgentPage,
  tracker: JourneyStageTracker,
  opts: {
    brandUrl: string;
    persona: ResearchPersona | null;
  }
): Promise<{ loggedIn: boolean }> {
  const email = (opts.persona?.email?.trim() || DEFAULT_TEST_EMAIL).toLowerCase();
  let password = "";
  try {
    password = opts.persona?.password?.trim() || defaultTestPassword();
  } catch {
    password = process.env.TEST_ACCOUNT_PASSWORD?.trim() || "";
  }

  if (!password) {
    throw new Error("Password required for returning login run");
  }

  // Entry
  tracker.begin("entry");
  const redirects = attachRedirectCounter(page);
  tracker.push(`Opening ${opts.brandUrl}`);
  await page
    .goto(opts.brandUrl, { waitUntil: "domcontentloaded", timeoutMs: 30000 })
    .catch(() => {});
  await preparePageAfterNavigation(page, stagehand);
  await tracker.wait(page, 2500, "entry");
  tracker.addStep("entry", 1);
  const entryRedirects = redirects.count();
  redirects.detach();
  await annotate(stagehand, tracker, "entry", "Site opened", {
    redirects: entryRedirects,
  });

  if (await checkAgentLoggedIn(stagehand)) {
    tracker.begin("login");
    tracker.end("login", {
      steps: 0,
      owner: STAGE_OWNERS.login,
      evidence: "Already authenticated",
      severity: "low",
    });
    tracker.begin("authentication");
    tracker.end("authentication", { steps: 0, owner: STAGE_OWNERS.authentication });
    tracker.begin("success");
    tracker.end("success", {
      steps: 0,
      owner: STAGE_OWNERS.success,
      evidence: "Logged in",
    });
  } else {
    // Login
    tracker.begin("login");
    const loginSince = new Date(Date.now() - 10_000);
    const open = await stagehand.act(
      "click Log In or Sign In (not Register) to open the login form"
    );
    if (open.success) tracker.addStep("login", 1);
    await tracker.wait(page, 2000, "login");

    let filled = await fastFillLoginCredentials(page, { email, password });
    if (!filled.password || !filled.email) {
      await stagehand.act(
        "type %email% into the email or username field and %password% into the password field",
        { variables: { email, password } }
      );
      filled = await fastFillLoginCredentials(page, { email, password });
    }
    if (!filled.password) {
      throw new Error("Password field still empty — cannot log in");
    }
    tracker.addStep("login", 2);
    tracker.push("Login email + password filled via DOM");
    const submit = await stagehand.act(
      "click the Log In, Sign In, or Submit button to attempt login"
    );
    if (submit.success) tracker.addStep("login", 1);
    await tracker.wait(page, 4000, "login");
    const errs = await countVisibleErrors(page);
    await annotate(stagehand, tracker, "login", `Credentials submitted as ${email}`, {
      errorCount: errs,
    });

    // Authentication / OTP
    tracker.begin("authentication");
    let authSteps = 0;
    if (!(await checkAgentLoggedIn(stagehand))) {
      tracker.push("Checking for OTP / 2FA");
      const verify = await completeAgentEmailVerification({
        stagehand,
        page,
        email,
        siteUrl: opts.brandUrl,
        since: loginSince,
        trail: [],
        timeoutMs: 75_000,
      });
      if (verify.acted) authSteps += 1;
      await tracker.wait(page, 3000, "authentication");
    }
    const loggedAfterAuth = await checkAgentLoggedIn(stagehand);
    await annotate(
      stagehand,
      tracker,
      "authentication",
      loggedAfterAuth ? "Passed security step" : "OTP/2FA incomplete",
      {
        steps: authSteps,
        severity: loggedAfterAuth ? null : "critical",
        friction: loggedAfterAuth ? undefined : "Could not complete OTP / 2FA",
      }
    );

    tracker.begin("success");
    if (!loggedAfterAuth) {
      tracker.end("success", {
        steps: 0,
        owner: STAGE_OWNERS.success,
        friction: "Not logged in",
        severity: "critical",
        evidence: "Failed",
      });
      tracker.skip("resume", "Login failed");
      return { loggedIn: false };
    }
    tracker.end("success", {
      steps: 0,
      owner: STAGE_OWNERS.success,
      evidence: "Authenticated",
    });
  }

  // Resume
  tracker.begin("resume");
  const resume = await stagehand.act(
    "navigate toward Casino, Games, or the player's last intended play area"
  );
  if (resume.success) tracker.addStep("resume", 1);
  await tracker.wait(page, 3000, "resume");
  await annotate(stagehand, tracker, "resume", "Returned toward play");

  return { loggedIn: true };
}
