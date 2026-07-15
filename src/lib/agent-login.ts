import type { Stagehand } from "@browserbasehq/stagehand";
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

/** Open login, fill stored credentials, submit, and poll for auth. */
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
  const loginId = creds.email?.trim() || creds.username?.trim() || "";
  if (!loginId || !creds.password) return false;

  const trail = opts?.trail;
  const shots = opts?.shots;
  const capture = opts?.capture;

  trail?.push("trying login with stored test credentials");
  try {
    if (opts?.dismissCookies !== false && page.evaluate) {
      await preparePageAfterNavigation(page as LoginPage & { evaluate: (expr: string) => Promise<unknown> }, stagehand);
    }

    const open = await stagehand.act(
      "click Log In or Sign In (not Register or Sign Up) to open the login form"
    );
    if (!open.success) return false;
    await page.waitForTimeout(2500);
    if (capture && shots) shots.push(await capture());

    const fillId = await stagehand.act(
      "type %loginId% into the email or username field of the login form",
      { variables: { loginId } }
    );
    if (!fillId.success) return false;

    const fillPass = await stagehand.act(
      "type %password% into the password field of the login form",
      { variables: { password: creds.password } }
    );
    if (!fillPass.success) return false;

    const submit = await stagehand.act(
      "click the Log In or Sign In button to submit the login form"
    );
    if (!submit.success) return false;
    trail?.push("login submitted with stored test credentials");

    for (let i = 0; i < 18; i++) {
      await page.waitForTimeout(i === 0 ? 4000 : 5000);
      if (await checkAgentLoggedIn(stagehand)) {
        trail?.push("authenticated with stored test credentials");
        if (capture && shots) shots.push(await capture());
        return true;
      }
    }
    if (capture && shots) shots.push(await capture());
    trail?.push("login submitted but session still looks logged out");
    return false;
  } catch {
    trail?.push("login attempt failed");
    return false;
  }
}
