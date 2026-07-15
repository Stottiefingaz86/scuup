import type { Stagehand } from "@browserbasehq/stagehand";
import { DEFAULT_TEST_EMAIL } from "./constants";
import { preparePageAfterNavigation } from "./dismiss-site-cookies";

type LoginPage = {
  waitForTimeout: (ms: number) => Promise<void>;
  evaluate?: (expr: string) => Promise<unknown>;
};

export type AgentLoginCredentials = {
  email?: string | null;
  username?: string | null;
  password: string;
};

/** Evidence-based logged-in check: account UI in header, not marketing CTAs. */
export async function checkAgentLoggedIn(stagehand: Stagehand): Promise<boolean> {
  try {
    const result = await stagehand.extract(
      "Answer with exactly LOGGED_IN or LOGGED_OUT. LOGGED_IN means a player avatar, account menu, deposit button, or wallet balance for an authenticated user is visible. Prominent Sign Up / Register CTAs mean LOGGED_OUT."
    );
    return result.extraction.toUpperCase().includes("LOGGED_IN");
  } catch {
    return false;
  }
}

/** "wrong email or password" style rejection visible on the page — no point
 * polling 90s for auth when the site already said no. */
const LOGIN_ERROR_RE =
  /(email|e-mail|username|password|credentials|login|account).{0,80}(incorrect|not correct|invalid|wrong|not recognised|not recognized|doesn'?t match|does not match|not found|no account|try again)/i;

async function loginErrorVisible(page: LoginPage): Promise<boolean> {
  if (!page.evaluate) return false;
  try {
    const text = String(
      await page.evaluate("document.body?.innerText ?? ''")
    ).slice(0, 20000);
    return LOGIN_ERROR_RE.test(text);
  } catch {
    return false;
  }
}

/** Login ids to try in order: the stored email, then the base inbox when the
 * stored one is a Gmail plus-alias (old seeds used stottiefingaz+brand@),
 * then the username. Accounts may exist under either address. */
export function loginIdCandidates(creds: AgentLoginCredentials): string[] {
  const ids: string[] = [];
  const push = (v?: string | null) => {
    const t = v?.trim();
    if (t && !ids.includes(t)) ids.push(t);
  };
  push(creds.email);
  const aliasMatch = creds.email?.trim().match(/^([^+@]+)\+[^@]*(@.+)$/);
  if (aliasMatch) push(`${aliasMatch[1]}${aliasMatch[2]}`);
  // The unified inbox is always worth one attempt — accounts registered
  // manually or by earlier agent runs live under it.
  push(DEFAULT_TEST_EMAIL);
  push(creds.username);
  return ids;
}

async function attemptLogin(
  stagehand: Stagehand,
  page: LoginPage,
  loginId: string,
  password: string,
  isRetry: boolean,
  trail?: string[]
): Promise<"success" | "rejected" | "failed"> {
  if (!isRetry) {
    const open = await stagehand.act(
      "click Log In or Sign In (not Register or Sign Up) to open the login form"
    );
    if (!open.success) return "failed";
    await page.waitForTimeout(2500);
  }

  const fillId = await stagehand.act(
    "clear the email or username field of the login form and type %loginId% into it, replacing any existing text",
    { variables: { loginId } }
  );
  if (!fillId.success) return "failed";

  const fillPass = await stagehand.act(
    "clear the password field of the login form and type %password% into it",
    { variables: { password } }
  );
  if (!fillPass.success) return "failed";

  const submit = await stagehand.act(
    "click the Log In or Sign In button to submit the login form"
  );
  if (!submit.success) return "failed";
  trail?.push(`login submitted as ${loginId}`);

  // Poll for auth; bail early when the site shows a credentials error so
  // the next candidate id gets a turn inside the run's time budget.
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(i === 0 ? 4000 : 5000);
    if (await checkAgentLoggedIn(stagehand)) return "success";
    if (i >= 1 && (await loginErrorVisible(page))) {
      trail?.push(`site rejected the credentials for ${loginId}`);
      return "rejected";
    }
  }
  return "failed";
}

/** Open login and sign in with the stored credentials, retrying alternate
 * login ids (base Gmail inbox, username) when the site rejects the first. */
export async function performAgentLogin(
  stagehand: Stagehand,
  page: LoginPage,
  creds: AgentLoginCredentials,
  opts?: {
    trail?: string[];
    shots?: string[];
    capture?: () => Promise<string>;
    dismissCookies?: boolean;
  }
): Promise<boolean> {
  const candidates = loginIdCandidates(creds);
  if (candidates.length === 0 || !creds.password) return false;

  const trail = opts?.trail;
  const shots = opts?.shots;
  const capture = opts?.capture;

  trail?.push("trying login with stored test credentials");
  try {
    if (opts?.dismissCookies !== false && page.evaluate) {
      await preparePageAfterNavigation(
        page as LoginPage & { evaluate: (expr: string) => Promise<unknown> },
        stagehand
      );
    }

    // At most 2 candidates keeps the worst case inside the run budget.
    const tryIds = candidates.slice(0, 2);
    for (let c = 0; c < tryIds.length; c++) {
      const outcome = await attemptLogin(
        stagehand,
        page,
        tryIds[c],
        creds.password,
        c > 0,
        trail
      );
      if (outcome === "success") {
        trail?.push("authenticated with stored test credentials");
        if (capture && shots) shots.push(await capture());
        return true;
      }
      if (outcome === "failed") break;
      // "rejected": the form is still open with an error — retry inline
      // with the next id.
    }

    if (capture && shots) shots.push(await capture());
    trail?.push("login attempts exhausted — session still logged out");
    return false;
  } catch {
    trail?.push("login attempt failed");
    return false;
  }
}
