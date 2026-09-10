import { Stagehand } from "@browserbasehq/stagehand";
import { completeAgentEmailVerification } from "../agent-email-verify";
import { checkAgentLoggedIn } from "../agent-login";
import {
  createContext,
  getLiveViewUrl,
  proxyConfig,
  releaseSession,
  withSessionRetry,
} from "../browserbase";
import {
  knownServedMarkets,
  looksGeoBlocked,
  proxyMarketForBrand,
} from "../brand-markets";
import { DEFAULT_TEST_EMAIL, MARKET_PROXY_COUNTRY } from "../constants";
import { preparePageAfterNavigation } from "../dismiss-site-cookies";
import {
  captureDepositQr,
  isValidBtcAddress,
  pageLooksLikeCashier,
  scrapeBtcAddressFromDom,
  siteShowsDepositCredited,
  walkToDepositAddress,
} from "./deposit-agent";
import { persistShots } from "../evidence-storage";
import { pickTopFriction, normalizeFrictionType } from "./friction";
import {
  attachRedirectCounter,
  countVisibleErrors,
  countVisibleFormFields,
  observeStageFriction,
} from "./instrumentation";
import { emptyStagesFor, STAGE_OWNERS } from "./journeys";
import { isSkippedStage } from "./teardown-summary";
import { runFeatureScan } from "./feature-scan";
import { runReturningLoginFlow } from "./login-agent";
import { runCasinoPlayFlow, type LobbyFeatures } from "./play-agent";
import {
  countEmptyVisibleInputs,
  detectFormatValidationFriction,
  fastClickCreateAccount,
  fastFillLoginCredentials,
  fastFillPersonaFields,
  fastSubmitLogin,
  fastOpenLogin,
  fastOpenRegistration,
  fastLogoutIfAuthed,
  pageLooksLoggedInChrome,
  dismissDistractingModals,
  onCasinoDistraction,
  loginFormVisible,
  fastTickRequiredCheckboxes,
  inspectRegistrationCheckboxes,
  inspectRegistrationSubmitUi,
  loginOtpPromptVisible,
  readLoginError,
  recoverFromHelpOrLegalPage,
  turnstileLooksSolved,
} from "./fast-fill";
import { JourneyStageTracker } from "./stage-tracker";
import {
  buildSignupPersona,
  defaultTestPassword,
  personaVariables,
} from "../test-persona";
import { inboxConfigured, waitForDepositEmail } from "../verification-inbox";
import {
  createDepositAction,
  createSmsAssistAction,
  getOpenDepositActionForBrand,
  getResearchActionByJobId,
  listResearchActions,
  patchResearchAction,
} from "./action-store";
import {
  captchaChallengeVisible,
  recaptchaSolved,
  solveCaptchaAfterSubmit,
  solveCaptchaIfPresent,
  waitForBrowserbaseCaptcha,
} from "./captcha";
import { captureResearchShot, waitForPaintedContent } from "./capture-shot";
import { syncAndActOnEmails, type EmailActionRecord } from "./email-act";
import { extractUsernameFromEmails } from "./account-username";
import { capturedToWatchItem, fetchInboxEmailsSince } from "./email-monitor";
import { defaultAddressForMarket } from "./persona-address";
import { resolveResearchSignupEmail } from "./signup-email";
import type {
  BrandFeatureScan,
  EmailWatchItem,
  JourneyKind,
  JourneyMetrics,
  JourneyStageResult,
  DepositWatchEntry,
  PostDepositObservation,
  PostSignupObservation,
  ResearchDevice,
  ResearchPersona,
  TopFriction,
} from "./types";
import {
  balanceIsZero,
  chainStatusLabel,
  checkBtcAddressOnChain,
  classifyDestination,
  classifyScreen,
  clickPaymentSentButton,
  type ChainStatus,
  describeNextStepGuidance,
  headerLooksLikeTether,
  inspectPostDepositScreen,
  readHeaderBalance,
  postDepositOkrFlags,
  selectBitcoinDisplayCurrency,
  summarizePostDepositEmails,
  type PostDepositScreen,
} from "./post-deposit";
import {
  dismissOpenChat,
  inspectWelcomeTouch,
  isPersonalized,
  pageLooksLikeOpenChat,
  pageLooksLikeWelcomePopup,
  welcomeTouchLabel,
} from "./post-signup";

export type TeardownStage =
  | "registration"
  | "verification"
  | "deposit"
  | "deposit_confirmed"
  | "first_bet";

export type ResearchTeardownStatus =
  | "starting"
  | "running"
  | "awaiting_payment"
  | "awaiting_sms"
  | "confirming_payment"
  | "paused"
  | "success"
  | "failed";

export interface ResearchTeardownJob {
  id: string;
  status: ResearchTeardownStatus;
  liveViewUrl: string | null;
  steps: string[];
  stages: JourneyStageResult[];
  metrics: JourneyMetrics;
  error: string | null;
  authenticated: boolean;
  depositConfirmed: boolean;
  firstBetPlaced: boolean;
  startedAt: number;
  runId: string;
  projectId: string;
  brandId: string;
  brandName: string;
  brandUrl: string;
  actionId: string | null;
  sessionOpen: boolean;
  topFriction: TopFriction[];
  /** Signup address used for this job (plus-alias). */
  signupEmail: string | null;
  /** Password actually used at signup / login — the client persists it per brand. */
  signupPassword: string | null;
  /** Brand-issued login handle (BetOnline account id), if we know it. */
  signupUsername: string | null;
  /** Casino lobby affordances seen during discovery (search, favourites, rows). */
  lobby: LobbyFeatures | null;
  /** Post-journey feature scan (off the stopwatch). */
  features: BrandFeatureScan | null;
  /** Visible error copy when a login attempt failed. */
  loginError?: string | null;
  /** Every monitored email + agent action for this run. */
  emails: EmailWatchItem[];
  seenEmailIds: string[];
  /** What the brand did the moment funds landed (redirect, popup, emails). */
  postDeposit: PostDepositObservation | null;
  /** Cashier frame taken when signup redirected straight into deposit. */
  cashierHandoffShot?: string | null;
  /** Market the residential proxy egresses from (may differ from project). */
  proxyMarket?: string;
  /** Greeting / welcome touch seen after the account exists. */
  postSignup: PostSignupObservation | null;
  signupConfirmedAt?: number | null;
  /** T+n snapshots between "I've paid" and funds landing. */
  depositWatch: DepositWatchEntry[];
  /** Verified BTC address this run asked the human to pay. */
  depositAddress?: string | null;
  /** When the human said "I've paid" (ISO) — resume needs it. */
  paidAt?: string | null;
  /** Test run: deposit wait skipped, no funds sent. */
  depositSkipped?: boolean;
  pauseRequested?: boolean;
}

export interface StartResearchTeardownInput {
  runId: string;
  projectId: string;
  brandId: string;
  brandName: string;
  brandUrl: string;
  market: string;
  device: ResearchDevice;
  kind: JourneyKind;
  persona: ResearchPersona | null;
  throughStage?: TeardownStage;
  /**
   * Where to begin. `deposit` logs into an existing account (post-signup)
   * and walks cashier — never opens registration.
   */
  startAt?:
    | "registration"
    | "deposit"
    | "deposit_confirmation"
    | "play"
    /** Log in and only run the post-journey feature scan. */
    | "features";
  /** Resume a paused deposit watch: which address, when the human paid. */
  resumeWatch?: { depositAddress: string | null; paidAt: string } | null;
  /** Resume without waiting for funds (test) — record the screen and move on. */
  forceAhead?: boolean;
  /**
   * `startAt: "play"` on a *funded* account: the deposit already landed, so
   * redo casino discovery → game launch → first bet for real and keep the
   * seeded deposit stages as they were.
   */
  replayPlay?: boolean;
  /** Stages / watch timeline from the paused session, so nothing is lost. */
  seedStages?: JourneyStageResult[] | null;
  seedDepositWatch?: DepositWatchEntry[] | null;
  /** Previously saved brand signup email (plus-alias). */
  accountEmail?: string | null;
  /** Password used at signup for this brand — login must reuse it. */
  accountPassword?: string | null;
}

const store = globalThis as unknown as {
  __researchTeardownJobs?: Map<string, ResearchTeardownJob>;
  __researchPaymentWait?: Map<
    string,
    {
      resolve: (mode: PaymentSignal) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >;
  __researchSmsWait?: Map<
    string,
    {
      resolve: (code: string) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >;
  __researchSessionHandles?: Map<
    string,
    { sessionId?: string; close: () => Promise<void> }
  >;
};
const jobs = (store.__researchTeardownJobs ??= new Map());
const paymentWaits = (store.__researchPaymentWait ??= new Map());
const smsWaits = (store.__researchSmsWait ??= new Map());
const sessionHandles = (store.__researchSessionHandles ??= new Map());

const PAYMENT_WAIT_MS = 45 * 60_000;
const SMS_WAIT_MS = 30 * 60_000;

const STAGE_RANK: Record<TeardownStage, number> = {
  registration: 1,
  verification: 2,
  deposit: 3,
  deposit_confirmed: 4,
  first_bet: 5,
};

function emptyMetrics(): JourneyMetrics {
  return {
    totalTimeSec: null,
    totalActions: null,
    totalScreens: null,
    totalFormFields: null,
    totalWaitSec: null,
    redirects: null,
    errors: null,
    depositToFirstBetSec: null,
    depositToFirstBetClicks: null,
  };
}

function stageRank(stage: TeardownStage): number {
  return STAGE_RANK[stage] ?? 0;
}

/** "paid" = human sent BTC · "skip" = test · "pause" = stop and close browser. */
export type PaymentSignal = "paid" | "skip" | "pause";

function waitForManualPayment(jobId: string): Promise<PaymentSignal> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      paymentWaits.delete(jobId);
      reject(new Error("Timed out waiting for you to send payment (45 min)"));
    }, PAYMENT_WAIT_MS);
    paymentWaits.set(jobId, { resolve, reject, timer });
  });
}

export function signalPaymentSent(
  jobId: string,
  mode: PaymentSignal = "paid",
): boolean {
  const wait = paymentWaits.get(jobId);
  const action = getResearchActionByJobId(jobId);
  if (action) {
    patchResearchAction(
      action.id,
      mode === "skip"
        ? {
            status: "cancelled",
            notes: "Skipped for a test run — no funds sent",
          }
        : { status: "payment_sent", paymentSentAt: new Date().toISOString() },
    );
  }
  if (!wait) return false;
  clearTimeout(wait.timer);
  paymentWaits.delete(jobId);
  wait.resolve(mode);
  return true;
}

async function abortResearchBrowser(jobId: string): Promise<void> {
  const handle = sessionHandles.get(jobId);
  sessionHandles.delete(jobId);
  if (handle?.sessionId) await releaseSession(handle.sessionId);
  await handle?.close().catch(() => {});
}

function releaseJobWaits(jobId: string) {
  const pay = paymentWaits.get(jobId);
  if (pay) {
    clearTimeout(pay.timer);
    paymentWaits.delete(jobId);
    pay.resolve("pause");
  }
  const sms = smsWaits.get(jobId);
  if (sms) {
    clearTimeout(sms.timer);
    smsWaits.delete(jobId);
    sms.reject(new Error("Stopped by you"));
  }
}

/**
 * Stop now. Always releases the Browserbase session — even if Pause was
 * already clicked and the current step is still hanging (SMS, inbox, login).
 * Waiting for that step is what kept billing.
 */
export function pauseResearchJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job) return false;
  if (job.status === "success" || job.status === "failed") {
    if (sessionHandles.has(jobId)) void abortResearchBrowser(jobId);
    return false;
  }
  job.pauseRequested = true;
  job.status = "paused";
  job.sessionOpen = false;
  job.steps.push("Stopped — browser session released now");
  releaseJobWaits(jobId);
  void abortResearchBrowser(jobId);
  return true;
}

/** True when the human hit Pause — park the job and stop further stages. */
function stopIfPaused(
  job: ResearchTeardownJob,
  tracker: JourneyStageTracker,
): boolean {
  if (!job.pauseRequested) return false;
  if (job.status !== "paused") {
    job.status = "paused";
    job.sessionOpen = false;
    tracker.push("Paused by you — browser closing");
  }
  return true;
}

/**
 * Human dismissed the deposit request — fail the paused job so its browser
 * closes instead of sitting open for 45 min waiting for money.
 */
export function cancelPaymentWait(jobId: string, reason: string): boolean {
  const wait = paymentWaits.get(jobId);
  const job = jobs.get(jobId);
  if (job && job.status === "awaiting_payment") {
    // The runner's catch only closes the browser when status is no longer
    // awaiting_payment — flip it so the rejected wait tears the session down.
    job.status = "failed";
  }
  if (!wait) return false;
  clearTimeout(wait.timer);
  paymentWaits.delete(jobId);
  wait.reject(new Error(reason));
  return true;
}

function waitForSmsCode(jobId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      smsWaits.delete(jobId);
      reject(new Error("Timed out waiting for SMS code (30 min)"));
    }, SMS_WAIT_MS);
    smsWaits.set(jobId, { resolve, reject, timer });
  });
}

/** Human pasted the SMS OTP — resume the paused agent. */
export function signalSmsCode(jobId: string, code: string): boolean {
  const cleaned = code.replace(/\s+/g, "").trim();
  if (!cleaned) return false;
  const wait = smsWaits.get(jobId);
  const action = getResearchActionByJobId(jobId);
  if (action?.kind === "sms_assist") {
    patchResearchAction(action.id, {
      status: "code_submitted",
      smsCode: cleaned,
    });
  }
  if (!wait) return false;
  clearTimeout(wait.timer);
  smsWaits.delete(jobId);
  wait.resolve(cleaned);
  return true;
}

export function getResearchTeardownJob(
  id: string,
): ResearchTeardownJob | undefined {
  return jobs.get(id);
}

type AgentPage = NonNullable<
  Awaited<ReturnType<Stagehand["context"]["activePage"]>>
>;

/** True when the page is asking for an SMS / mobile OTP (not email). */
async function detectSmsChallenge(page: AgentPage): Promise<boolean> {
  try {
    const hit = await page.evaluate(`(() => {
      const text = (document.body?.innerText || "").slice(0, 6000).toLowerCase();
      const smsCopy =
        /sms|text message|sent (a |an )?(code|otp) to (your )?(phone|mobile)|mobile (verification|code|number)|phone (verification|code)|enter (the )?(code|otp).{0,40}(phone|mobile|sms)|we (texted|sent).{0,30}(code|otp)/i.test(
          text
        );
      if (!smsCopy) return false;
      // Prefer pages that also have a short code input
      const inputs = [...document.querySelectorAll("input")].filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return false;
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden") return false;
        const meta = (
          (el.getAttribute("name") || "") +
          " " +
          (el.getAttribute("placeholder") || "") +
          " " +
          (el.getAttribute("autocomplete") || "") +
          " " +
          (el.getAttribute("inputmode") || "") +
          " " +
          (el.getAttribute("aria-label") || "")
        ).toLowerCase();
        return (
          /otp|code|sms|pin|one.?time|verification/.test(meta) ||
          el.getAttribute("inputmode") === "numeric" ||
          (el.getAttribute("maxlength") && Number(el.getAttribute("maxlength")) <= 8)
        );
      });
      return inputs.length > 0 || smsCopy;
    })()`);
    return Boolean(hit);
  } catch {
    return false;
  }
}

/** Bovada and similar: SMS is optional — "verify later" / "skip for now". */
async function clickSkipSmsIfPresent(page: AgentPage): Promise<boolean> {
  try {
    return Boolean(
      await page.evaluate(`(() => {
        const labels = [
          "verify later",
          "verify later?",
          "skip for now",
          "skip this step",
          "skip verification",
          "do this later",
          "i'll do this later",
          "not now",
        ];
        const nodes = [
          ...document.querySelectorAll("button, a, [role='button'], [role='link']"),
        ];
        for (const el of nodes) {
          const r = el.getBoundingClientRect();
          if (r.width < 20 || r.height < 10) continue;
          const s = getComputedStyle(el);
          if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) {
            continue;
          }
          const t = (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim().toLowerCase();
          if (t.length > 48) continue;
          if (labels.some((l) => t === l || t.includes(l))) {
            el.click();
            return true;
          }
        }
        return false;
      })()`),
    );
  } catch {
    return false;
  }
}

async function enterSmsCodeOnPage(
  stagehand: Stagehand,
  code: string,
): Promise<boolean> {
  const res = await stagehand.act(
    "type the SMS verification code %code% into the code / OTP / PIN fields on this page (fill digit boxes left to right if split), then click Verify, Confirm, Continue, or Submit — do not open Help or Terms",
    { variables: { code } },
  );
  return Boolean(res.success);
}

/**
 * Prefer skip/verify-later when the site offers it (locked +1 country codes
 * make a non-US number useless). Otherwise pause for a human SMS paste.
 */
async function handleSmsChallenge(opts: {
  job: ResearchTeardownJob;
  tracker: JourneyStageTracker;
  stagehand: Stagehand;
  page: AgentPage;
  input: StartResearchTeardownInput;
  phoneHint: string;
}): Promise<boolean> {
  const skipped = await clickSkipSmsIfPresent(opts.page);
  if (skipped) {
    opts.tracker.push("Skipped SMS — site offered verify later");
    await opts.tracker.wait(opts.page, 2000, "verification");
    return checkAgentLoggedIn(opts.stagehand);
  }
  await pauseForSmsAssist(opts);
  return checkAgentLoggedIn(opts.stagehand);
}

/**
 * Bovada "next login steps" — try the same email/password instead of
 * waiting for mail that often never arrives.
 */
async function tryLoginWithSignupCredentials(
  stagehand: Stagehand,
  page: AgentPage,
  tracker: JourneyStageTracker,
  email: string,
  password: string,
): Promise<boolean> {
  if (await checkAgentLoggedIn(stagehand)) return true;
  if (!password) return false;
  tracker.push(`Trying login as ${email} — no confirmation mail yet`);
  const opened = await fastOpenLogin(page);
  await tracker.wait(page, 1200, "verification");
  if (!(await loginFormVisible(page))) {
    await stagehand
      .act(
        "click Log In or Sign In (not Register / Sign Up) to open the login form",
      )
      .catch(() => {});
    await tracker.wait(page, 1200, "verification");
  }
  if (!(await loginFormVisible(page))) {
    tracker.push(
      `Login form not visible after ${opened || "no"} Log In click`,
    );
    return false;
  }
  let filled = await fastFillLoginCredentials(page, { email, password });
  if (!filled.email || !filled.password) {
    await stagehand
      .act(
        "type %email% and %password% into the Log In form — do not click Register",
        { variables: { email, password } },
      )
      .catch(() => {});
    filled = await fastFillLoginCredentials(page, { email, password });
  }
  if (!filled.password) {
    tracker.push("Login password field still empty");
    return false;
  }
  const submitted = await fastSubmitLogin(page);
  if (!submitted) {
    await stagehand
      .act("click the Log In or Sign In button to submit — not Create Account")
      .catch(() => {});
  }
  await tracker.wait(page, 3500, "verification");
  const ok = await checkAgentLoggedIn(stagehand);
  tracker.push(ok ? "Logged in with signup credentials" : "Login did not succeed");
  return ok;
}

/**
 * Site wants an SMS OTP we cannot read — notify human and pause until they paste it.
 */
async function pauseForSmsAssist(opts: {
  job: ResearchTeardownJob;
  tracker: JourneyStageTracker;
  stagehand: Stagehand;
  page: AgentPage;
  input: StartResearchTeardownInput;
  phoneHint: string;
}): Promise<string> {
  const { job, tracker, stagehand, page, input, phoneHint } = opts;
  const action = createSmsAssistAction({
    projectId: input.projectId,
    brandId: input.brandId,
    brandName: input.brandName,
    brandUrl: input.brandUrl,
    jobId: job.id,
    liveViewUrl: job.liveViewUrl,
    phoneHint: phoneHint || null,
    smsPrompt: phoneHint
      ? `SMS code sent to ${phoneHint}. Paste it below so the agent can continue signup.`
      : "SMS code required. Paste the code from your phone so the agent can continue.",
  });
  job.actionId = action.id;
  job.status = "awaiting_sms";
  job.sessionOpen = true;
  tracker.push(
    `Waiting for SMS — check Notifications (phone ${phoneHint || "on persona"})`,
  );
  const shot = await captureResearchShot(page);
  if (shot) {
    tracker.push("SMS challenge screenshot captured");
  }
  const code = await waitForSmsCode(job.id);
  job.status = "running";
  tracker.push("SMS code received — entering on site");
  tracker.addStep("verification", 1);
  await enterSmsCodeOnPage(stagehand, code);
  await tracker.wait(page, 4000, "verification");
  const actionAfter = getResearchActionByJobId(job.id);
  if (actionAfter?.kind === "sms_assist") {
    patchResearchAction(actionAfter.id, {
      status: "confirmed",
      confirmedAt: new Date().toISOString(),
      confirmedVia: "manual",
    });
  }
  return code;
}

/**
 * Per-stage screenshot stream. Frames are appended in capture order and
 * published to the live stage immediately. A DOM fingerprint (URL + visible
 * text + input states) skips frames where nothing on screen changed, so retries
 * and settle-waits don't produce runs of identical screenshots.
 */
type StageShotStream = {
  shots: string[];
  /** Capture if the screen changed since the last frame. */
  push: (label?: string, opts?: { force?: boolean }) => Promise<string | null>;
  /** Mark the current screen as seen without capturing. */
  skipCurrent: () => Promise<void>;
};

const SHOT_FINGERPRINT_SCRIPT = `(() => {
  // Scope to the open modal/form when there is one — casino homepages behind
  // it have live tickers (jackpots, bets) that change every second.
  const dlg = [...document.querySelectorAll("[role='dialog'], dialog[open], form")].find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 200 && r.height > 120;
  });
  const root = dlg || document.body;
  const text = (root?.innerText || "").replace(/\\d+/g, "#").replace(/\\s+/g, " ").slice(0, 20000);
  // Visible inputs only — hidden captcha / CSRF token fields (cf-turnstile-
  // response, g-recaptcha-response) fill in silently and made two identical
  // frames hash differently.
  const inputs = [...document.querySelectorAll("input, select, textarea")]
    .filter((el) => {
      const t = (el.type || "").toLowerCase();
      if (t === "hidden") return false;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      const cs = getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden";
    })
    .map((el) => {
      const t = (el.type || el.tagName).toLowerCase();
      const on = t === "checkbox" || t === "radio" ? (el.checked ? "1" : "0") : String((el.value || "").length);
      return t + ":" + on;
    })
    .join(",");
  const s = location.pathname + "|" + text + "|" + inputs;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h + ":" + text.length + ":" + inputs.length;
})()`;

async function screenFingerprint(page: AgentPage): Promise<string | null> {
  try {
    const v = await page.evaluate(SHOT_FINGERPRINT_SCRIPT);
    return typeof v === "string" && v ? v : null;
  } catch {
    return null;
  }
}

function createShotStream(
  page: AgentPage,
  tracker: JourneyStageTracker,
  stageId: string,
  seed: string[] = [],
  opts?: { maxShots?: number; fullPage?: boolean },
): StageShotStream {
  const shots = [...new Set(seed)];
  let lastFp: string | null = null;
  const seenImages = new Set<string>();
  const maxShots =
    opts?.maxShots ??
    (stageId === "registration" || stageId === "verification" ? 12 : 24);
  // Journey cards show a small hero — viewport only (never 20kpx fullPage).
  const fullPage = opts?.fullPage === true;
  const publish = () => {
    const st = tracker.stage(stageId);
    if (st) st.screenshotUrls = [...shots];
  };
  if (shots.length) publish();
  return {
    shots,
    async push(label, opts) {
      const force = opts?.force === true;
      if (!force && shots.length >= maxShots) return null;
      const fp = force ? null : await screenFingerprint(page);
      if (!force && fp && fp === lastFp) return null;
      let dupImage = false;
      let shot = await captureResearchShot(page, {
        fullPage,
        skipIf: force
          ? undefined
          : (h) => {
              dupImage = seenImages.has(h);
              if (!dupImage) seenImages.add(h);
              return dupImage;
            },
      });
      // Blank/pre-paint — wait and try once more; don't lock fingerprint on empty.
      if (!shot && !dupImage) {
        await page.waitForTimeout(1500);
        shot = await captureResearchShot(page, { fullPage });
      }
      if (dupImage) {
        if (fp) lastFp = fp;
        return null;
      }
      if (!shot) return null;
      lastFp = fp ?? (await screenFingerprint(page));
      if (!shots.includes(shot)) shots.push(shot);
      publish();
      if (label) tracker.push(label);
      return shot;
    },
    async skipCurrent() {
      lastFp = await screenFingerprint(page);
    },
  };
}

async function finalizeStage(
  stagehand: Stagehand,
  tracker: JourneyStageTracker,
  stageId: string,
  evidence: string,
  extra: Partial<JourneyStageResult> = {},
  page?: AgentPage | null | StageShotStream,
) {
  // Screenshot FIRST — LLM friction extract is slow and delayed landing evidence
  // until registration had already started.
  let screenshotUrls: string[] | undefined;
  if (page && "push" in page) {
    // Stage stream: closing frame only if the screen changed; order is capture order.
    await page.push();
    screenshotUrls = page.shots.length ? [...page.shots] : undefined;
  } else {
    const shot = page ? await captureResearchShot(page) : null;
    const existing = [...new Set(extra.screenshotUrls ?? [])];
    const all =
      shot && !existing.includes(shot) ? [...existing, shot] : existing;
    screenshotUrls = all.length ? all : undefined;
  }

  // Publish the stage end + shot immediately so the UI can poll it.
  tracker.end(stageId, {
    owner: STAGE_OWNERS[stageId],
    evidence,
    ...extra,
    ...(screenshotUrls ? { screenshotUrls } : {}),
  });

  // Skip LLM friction on early stages — it was adding 10–30s before registration.
  if (stageId === "landing" || stageId === "first_touch") {
    if (extra.friction) {
      const stage = tracker.stage(stageId);
      if (stage) {
        stage.friction = extra.friction;
        stage.severity = extra.severity ?? stage.severity;
      }
    }
    return;
  }

  // Friction notes are nice-to-have — enrich after the shot is already stored.
  const obs = await observeStageFriction(
    stagehand,
    tracker.stage(stageId)?.label ?? stageId,
  );
  const stage = tracker.stage(stageId);
  if (stage && (obs.friction || obs.severity)) {
    stage.friction = extra.friction ?? obs.friction ?? stage.friction;
    stage.userImpact = extra.userImpact ?? obs.userImpact ?? stage.userImpact;
    stage.frictionType =
      extra.frictionType ??
      normalizeFrictionType(obs.frictionType) ??
      stage.frictionType;
    if (extra.severity !== undefined) stage.severity = extra.severity;
    else if (obs.severity) stage.severity = obs.severity;
  }
}

function appendEmailRecords(
  job: ResearchTeardownJob,
  records: EmailActionRecord[],
  signupSince: Date,
) {
  for (const r of records) {
    if (!job.seenEmailIds.includes(r.email.id)) {
      job.seenEmailIds.push(r.email.id);
    }
    // Only keep screenshots that belong to this brand's site (or no URL check).
    const screenshotUrls = r.screenshotUrls.filter(Boolean);
    const item = capturedToWatchItem(r.email, job.brandId, signupSince, {
      actionTaken: r.actionTaken,
      actionResult: r.actionResult,
      stageId: r.stageId,
      screenshotUrls,
      runId: job.runId,
    });
    const idx = job.emails.findIndex((e) => e.id === item.id);
    if (idx >= 0) {
      const prev = job.emails[idx]!;
      // Don't let a later brand job overwrite another brand's email row.
      if (prev.brandId && prev.brandId !== job.brandId) {
        continue;
      }
      job.emails[idx] = {
        ...prev,
        ...item,
        // Keep prior evidence shots; append new ones from this brand only.
        screenshotUrls: [
          ...new Set([
            ...(prev.screenshotUrls ?? []),
            ...(item.screenshotUrls ?? []),
          ]),
        ],
      };
    } else {
      job.emails.push(item);
    }
  }
  if (!job.signupUsername) {
    const fromMail = extractUsernameFromEmails(job.emails);
    if (fromMail) job.signupUsername = fromMail;
  }
}

async function monitorInboxPass(
  job: ResearchTeardownJob,
  stagehand: Stagehand,
  page: AgentPage,
  email: string,
  brandUrl: string,
  since: Date,
  stageId: string,
) {
  const seen = new Set(job.seenEmailIds);
  const records = await syncAndActOnEmails({
    stagehand,
    page,
    email,
    siteUrl: brandUrl,
    since,
    seenIds: seen,
    stageId,
    trail: job.steps,
  });
  job.seenEmailIds = [...seen];
  appendEmailRecords(job, records, since);
  return records;
}

/** Fetch new mail into the job without clicking OTPs/links (safe mid-registration). */
async function pollInboxEvidenceOnly(
  job: ResearchTeardownJob,
  email: string,
  brandUrl: string,
  since: Date,
  stageId: string,
) {
  let host: string | null = null;
  try {
    host = new URL(brandUrl).hostname;
  } catch {
    /* ignore */
  }
  try {
    const messages = await fetchInboxEmailsSince({
      toAddress: email,
      since,
      fromDomainHint: host,
      limit: 80,
    });
    for (const m of messages) {
      if (job.seenEmailIds.includes(m.id)) continue;
      job.seenEmailIds.push(m.id);
      const item = capturedToWatchItem(m, job.brandId, since, {
        actionTaken: "noted",
        actionResult: "captured during run",
        stageId,
        screenshotUrls: [],
        runId: job.runId,
      });
      if (!job.emails.some((e) => e.id === item.id)) {
        job.emails.push(item);
        job.steps.push(
          `Email captured: ${item.subject.slice(0, 60)}${
            item.otpPresent ? " (OTP)" : ""
          }`,
        );
      }
    }
  } catch (e) {
    job.steps.push(`Inbox poll: ${e instanceof Error ? e.message : "failed"}`);
  }
}

function resolveVars(
  persona: ResearchPersona | null,
  market: string,
  brandName: string,
  accountEmail?: string | null,
  accountPassword?: string | null,
): { vars: Record<string, string>; email: string; password: string } {
  const base = buildSignupPersona({ market, brandName, ownBrand: true });
  // Prefer saved persona; otherwise CA/US research address (not UK Baker St).
  const addressFallback = defaultAddressForMarket(market);
  // Unique +alias per brand so sites don't reject "already registered".
  // Mail still lands in the shared IMAP inbox.
  const email = resolveResearchSignupEmail({
    brandName,
    brandAccountEmail: accountEmail,
    personaEmail: persona?.email,
  });
  // Login: brand-saved password from signup. Signup: persona / env default.
  const password =
    accountPassword?.trim() ||
    persona?.password?.trim() ||
    (() => {
      try {
        return defaultTestPassword();
      } catch {
        return "";
      }
    })();
  if (!password) {
    throw new Error(
      "No password — set persona password or TEST_ACCOUNT_PASSWORD",
    );
  }
  const usMarket = /united states|us \(rest|offshore|us-tx/i.test(market);
  // Project persona is often Canadian. Bovada country is United States —
  // a CA postal (T2P 8Y9) fails ZIP validation. Brand geo wins.
  const useBrandAddress = usMarket || addressFallback.country === "United States";
  const merged = {
    ...base,
    email,
    dateOfBirth: persona?.dateOfBirth?.trim() || base.dateOfBirth,
    phone: useBrandAddress
      ? addressFallback.phone || base.phone
      : persona?.phone?.trim() || addressFallback.phone || base.phone,
    country: useBrandAddress
      ? addressFallback.country
      : persona?.country?.trim() || addressFallback.country,
    addressLine1: useBrandAddress
      ? addressFallback.addressLine1
      : persona?.addressLine1?.trim() || addressFallback.addressLine1,
    city: useBrandAddress
      ? addressFallback.city
      : persona?.city?.trim() || addressFallback.city,
    postalCode: useBrandAddress
      ? addressFallback.postalCode
      : persona?.postalCode?.trim() || addressFallback.postalCode,
    state: useBrandAddress
      ? addressFallback.state || base.state
      : persona?.state?.trim() || addressFallback.state || base.state,
  };
  // DOB display: NA markets/addresses → MM/DD/YYYY. Fast-fill still re-reads
  // the field placeholder and reformats — that is the source of truth on-site.
  const iso = merged.dateOfBirth || base.dateOfBirth;
  const [y, m, d] = iso.split("-");
  if (y && m && d) {
    const country = (merged.country || "").toLowerCase();
    const na =
      /canada|united states|usa/.test(country) ||
      /canada|united states|us \(rest|offshore/i.test(market);
    merged.dateOfBirthDisplay = na
      ? `${m}/${d}/${y}`
      : base.dateOfBirthDisplay || `${d}/${m}/${y}`;
  }
  return { vars: personaVariables(merged, password), email, password };
}

async function fillRegistrationStep(
  stagehand: Stagehand,
  page: AgentPage,
  vars: Record<string, string>,
): Promise<{ filled: number; kinds: string[] }> {
  const fast = await fastFillPersonaFields(page, vars);
  const kinds = fast.kinds.join(" ");
  const missingDob = !/dateOfBirth/i.test(kinds);
  const missingZip = !/postalCode/i.test(kinds);
  // Only use the LLM for leftovers — never for every character of name fields.
  if (fast.filled < 3 || missingDob || missingZip) {
    await stagehand.act(
      `Fill any still-empty registration fields using: email %email%, password %password%, first name %firstName%, last name %lastName%, full name %fullName%, date of birth %dateOfBirthDisplay%, phone %phone%, address %addressLine1%, city %city%, state %state%, postcode %postalCode%, country %country%. For date of birth, match the placeholder format exactly (e.g. if the field says MM/DD/YYYY use month/day/year — do not use DD/MM/YYYY). Paste whole values — do not type slowly. Do NOT open Terms, Privacy, Help, or Support links. Do not submit.`,
      { variables: vars },
    );
  }
  return fast;
}

/** Tick age/terms consent if present; if not, ignore and continue. */
async function handleRegistrationCheckboxes(
  page: AgentPage,
  tracker: JourneyStageTracker,
  stagehand?: Stagehand,
): Promise<boolean> {
  const { ticked, already } = await fastTickRequiredCheckboxes(page);
  if (ticked > 0) {
    tracker.addStep("registration", 1);
    tracker.push(`Ticked ${ticked} consent checkbox(es)`);
    return true;
  }
  // Already checked — do NOT call Stagehand. A second "tick the square" act
  // on Rainbet often hits the modal Close (×) and dumps us on the homepage.
  if (already) return true;

  // Still see acknowledge / age text but DOM tick missed — one agent attempt, then ignore.
  let hasUncheckedConsent = false;
  try {
    hasUncheckedConsent = Boolean(
      await page.evaluate(`(() => {
        const t = (document.body?.innerText || "").slice(0, 8000);
        if (!/over the age of\\s*18|acknowledge that i am|agree to the terms and conditions/i.test(t)) {
          return false;
        }
        // If a consent checkbox is already on, skip the agent.
        const boxes = [
          ...document.querySelectorAll('input[type="checkbox"], [role="checkbox"]'),
        ];
        for (const el of boxes) {
          const meta = (
            (el.getAttribute("aria-label") || "") +
            " " +
            (el.closest("label")?.textContent || "")
          ).toLowerCase();
          if (!/agree|terms|age|18|acknowledge|accept/i.test(meta)) continue;
          if (el instanceof HTMLInputElement && el.checked) return false;
          if (el.getAttribute("aria-checked") === "true") return false;
        }
        return true;
      })()`),
    );
  } catch {
    hasUncheckedConsent = false;
  }

  if (hasUncheckedConsent && stagehand) {
    const act = await stagehand.act(
      "If there is an unchecked square checkbox next to 'I acknowledge that I am over the age of 18' or Terms and Conditions, click ONLY that empty square so it becomes checked. NEVER click the Terms, Privacy, or Help text/links. NEVER click Create Account. NEVER click Close, X, or outside the dialog. If the checkbox is already checked or missing, do nothing at all.",
    );
    if (act.success) {
      tracker.addStep("registration", 1);
      tracker.push("Ticked age/terms consent via agent");
      return true;
    }
  }
  // No checkbox / already checked / not needed — continue quietly.
  return false;
}

/** reCAPTCHA / bot check — Browserbase solves; we wait and record as journey step. */
async function handleRegistrationCaptcha(
  page: AgentPage,
  stagehand: Stagehand,
  tracker: JourneyStageTracker,
  job?: ResearchTeardownJob,
): Promise<"ok" | "blocked"> {
  if (!(await captchaChallengeVisible(page))) return "ok";
  const shot = await captureResearchShot(page);
  const result = await waitForBrowserbaseCaptcha(page, stagehand, {
    push: (m) => tracker.push(m),
    shouldAbort: () => Boolean(job?.pauseRequested),
  });
  tracker.addStep("registration", 1);
  if (result === "solved" || result === "absent") {
    if (shot) {
      /* evidence stays on registration stage via finalize later */
    }
    return "ok";
  }
  tracker.push(
    result === "timeout"
      ? "Captcha still blocking after wait — open live view if needed"
      : "Captcha solver failed — open live view to finish I'm not a robot",
  );
  return "blocked";
}

async function submitRegistrationForm(
  stagehand: Stagehand,
  page: AgentPage,
): Promise<boolean> {
  // Prefer a real DOM click — Stagehand often reports success without pressing Create Account.
  // When Turnstile already shows Success!, force-click even if the button looks disabled.
  const force = true; // Create Account only — Sign Up is never targeted while the form is open.
  if (await fastClickCreateAccount(page, { force })) return true;
  for (const phrasing of [
    "Click the blue Create Account button at the bottom of the registration form to submit. Do NOT click Sign Up in the header. Do NOT click Close or X. Do NOT open Terms or Help.",
    "Click Create Account at the bottom of this dialog to submit the registration. Do not close the dialog.",
  ]) {
    const res = await stagehand.act(phrasing);
    if (res.success) return true;
  }
  return fastClickCreateAccount(page, { force: true });
}

/**
 * Fill/terms already done. Click Create Account → wait for Cloudflare to
 * appear → tick it → Create Account again. Do not touch captcha before the
 * first submit (Rainbet loads Turnstile after that click).
 */
async function hammerCreateAccountUntilDone(
  stagehand: Stagehand,
  page: AgentPage,
  tracker: JourneyStageTracker,
  attempts = 3,
  onShot?: () => Promise<void>,
  /** Positive proof of signup; without it a closed form is NOT success. */
  confirmed?: () => Promise<boolean>,
  job?: ResearchTeardownJob,
): Promise<boolean> {
  const formGoneIsDone = async () => (confirmed ? await confirmed() : true);
  const abort = () => Boolean(job?.pauseRequested);

  for (let i = 0; i < attempts; i++) {
    if (job && stopIfPaused(job, tracker)) return false;
    if (await checkAgentLoggedIn(stagehand)) return true;
    if (!(await registrationFormStillOpenFast(page))) return formGoneIsDone();

    // Consent should already be done before hammer — do not re-run the
    // checkbox agent here (it closes Rainbet's modal when the box is checked).

    // Rainbet only: Turnstile sits on the form and Create Account is a no-op
    // until it shows Success. Other brands (Winna, BetOnline) submit first or
    // use their own captcha path — do not block them here.
    const rainbet = /rainbet\.com/i.test(
      typeof page.url === "function" ? page.url() : job?.brandUrl ?? "",
    );
    if (rainbet && !(await recaptchaSolved(page))) {
      const pre = await solveCaptchaIfPresent(page, stagehand, {
        push: (m) => tracker.push(m),
        shouldAbort: abort,
      });
      if (job && stopIfPaused(job, tracker)) return false;
      if (pre === "timeout" || pre === "errored") {
        tracker.push("Cloudflare not solved — skipping Create Account this pass");
        continue;
      }
    }

    if (i === 0 && onShot) await onShot();
    tracker.push(
      `Submit attempt ${i + 1}/${attempts} — clicking Create Account`,
    );
    const formStillUp = await registrationFormStillOpenFast(page);
    if (!formStillUp) {
      await waitForPostSignupRedirect(page, tracker);
      return formGoneIsDone();
    }
    const domClicked = await fastClickCreateAccount(page, { force: true });
    if (!domClicked) {
      if (!(await registrationFormStillOpenFast(page))) {
        await waitForPostSignupRedirect(page, tracker);
        return formGoneIsDone();
      }
      await stagehand
        .act(
          "Click the Create Account button at the bottom of the registration dialog to submit. Do NOT click Sign Up in the page header. Do NOT click Close or X. Do NOT open Terms, Help, or chat.",
        )
        .catch(() => {});
    }
    // Submitted (or just did). Do not click again — let the brand redirect.
    await waitForPostSignupRedirect(page, tracker);
    if (onShot) await onShot();
    if (!(await registrationFormStillOpenFast(page))) return formGoneIsDone();
    if (!(await loggedOutHeaderVisible(page))) return true;

    // Give Cloudflare time to paint, then tick, then submit again.
    tracker.push("Waiting for Cloudflare after Create Account…");
    const after = await solveCaptchaAfterSubmit(page, stagehand, {
      push: (m) => tracker.push(m),
      shouldAbort: abort,
      appearMs: 15_000,
    });
    if (job && stopIfPaused(job, tracker)) return false;
    if (onShot) await onShot();

    if (after === "solved") {
      tracker.push("Cloudflare solved — clicking Create Account again");
      tracker.addStep("registration", 1);
      const again = await fastClickCreateAccount(page, { force: true });
      if (!again) {
        await stagehand
          .act(
            "Cloudflare shows Success. Click the Create Account button at the bottom of the registration dialog now to submit. Do not click header Sign Up. Do not open Terms or Help.",
          )
          .catch(() => {});
      }
      await tracker.wait(page, 3000, "registration");
      if (onShot) await onShot();
    } else if (after === "absent") {
      // No captcha appeared — maybe submit already went through.
      tracker.push("No Cloudflare widget after submit — checking result");
    }

    if (await checkAgentLoggedIn(stagehand)) return true;
    if (confirmed && (await confirmed())) return true;
    if (!(await registrationFormStillOpenFast(page))) return formGoneIsDone();
  }
  if (await checkAgentLoggedIn(stagehand)) return true;
  if (!(await registrationFormStillOpenFast(page))) return formGoneIsDone();
  return false;
}

/**
 * Welcome-touch watcher. Brands like Winna fire a personalised chat greeting
 * a minute or two after signup — capture it once (frame + text), then close
 * it so the panel doesn't sit over the cashier and eat the deposit clicks.
 */
async function checkWelcomeTouch(
  job: ResearchTeardownJob,
  tracker: JourneyStageTracker,
  page: AgentPage,
  vars: Record<string, string>,
): Promise<boolean> {
  if (job.postSignup?.welcome.seen) {
    tracker.idleWatcher = null;
    return true;
  }
  const hit = await inspectWelcomeTouch(page);
  if (!hit) return false;
  // Text only — never dismiss/click. On Winna that launches Paul.
  const afterSec = job.signupConfirmedAt
    ? Math.max(0, Math.round((Date.now() - job.signupConfirmedAt) / 1000))
    : null;
  job.postSignup = {
    welcome: {
      seen: true,
      channel: hit.channel,
      text: hit.text,
      sender: hit.sender,
      personalized: isPersonalized(hit.text, vars),
      ctas: hit.ctas,
      afterSec,
      dismissed: null,
    },
    screenshotUrls: job.postSignup?.screenshotUrls ?? [],
  };
  tracker.push(`Welcome touch: ${welcomeTouchLabel(job.postSignup)}`);
  tracker.idleWatcher = null;
  return true;
}

/** Arm the watcher from the moment the account exists; check right away too. */
async function armWelcomeWatch(
  job: ResearchTeardownJob,
  tracker: JourneyStageTracker,
  page: AgentPage,
  vars: Record<string, string>,
) {
  if (job.signupConfirmedAt) return;
  job.signupConfirmedAt = Date.now();
  job.postSignup = {
    welcome: {
      seen: false,
      channel: null,
      text: null,
      sender: null,
      personalized: false,
      ctas: [],
      afterSec: null,
      dismissed: null,
    },
    screenshotUrls: [],
  };
  tracker.idleWatcher = (p) =>
    checkWelcomeTouch(job, tracker, p as AgentPage, vars).then(() => {});
  // One look at whatever is already on screen. Do not wait for chat to open.
  await checkWelcomeTouch(job, tracker, page, vars);
}

/**
 * Geo wall check. A geo-blocked run is not a journey — every later stage
 * would be fiction — so we stop here with the markets that do work.
 */
async function assertNotGeoBlocked(
  page: AgentPage,
  tracker: JourneyStageTracker,
  job: ResearchTeardownJob,
  stageId: string,
  shots?: StageShotStream,
) {
  let text = "";
  try {
    text = String(
      await page.evaluate("document.body?.innerText ?? ''").catch(() => ""),
    );
  } catch {
    return;
  }
  if (!looksGeoBlocked(text)) return;
  const served = knownServedMarkets(job.brandUrl);
  const from = job.proxyMarket ?? "the project market";
  // Don't abort when we're already routing from a market we know the brand
  // serves — Rainbet T&Cs match GEO_BLOCK_RE and caused a false "geo-blocked
  // from Canada / serves Canada" loop.
  if (from !== "the project market" && served.includes(from)) {
    tracker.push(
      `Geo-wall copy on page, but proxy is ${from} (served market) — continuing`,
    );
    return;
  }
  if (shots) await shots.push();
  const hint = served.length
    ? `${job.brandName} serves: ${served.join(", ")}`
    : `${job.brandName} isn't in the curated market table yet — add it to brand-markets.ts`;
  const msg = `Geo-blocked from ${from}. ${hint}`;
  tracker.push(msg);
  const st = tracker.stage(stageId);
  if (st) {
    st.friction = msg;
    st.severity = "critical";
    st.frictionType = "remove";
  }
  throw new Error(msg);
}

/** Registration form gone and a payment-method screen is up. */
async function landedInCashier(page: AgentPage): Promise<boolean> {
  if (await registrationFormStillOpenFast(page)) return false;
  // A logged-out homepage with a crypto promo also mentions deposit/bitcoin —
  // that is not a cashier. Require no Login+Register header pair.
  if (await loggedOutHeaderVisible(page)) return false;
  return pageLooksLikeCashier(page);
}

/** Header shows both Login and Register/Sign up → nobody is logged in. */
async function loggedOutHeaderVisible(page: AgentPage): Promise<boolean> {
  try {
    return Boolean(
      await page.evaluate(`(() => {
        const els = [...document.querySelectorAll("a, button, [role='button']")];
        let login = false, register = false;
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0 || r.top > 260) continue;
          const t = (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim().toLowerCase();
          if (!t || t.length > 24) continue;
          if (/^(log ?in|sign ?in)$/.test(t)) login = true;
          if (/^(register|sign ?up|join( now)?|create (an )?account)( →|→)?$/.test(t)) register = true;
        }
        return login && register;
      })()`),
    );
  } catch {
    return false;
  }
}

/** Bovada red banner — not proof they emailed. Often a silent decline. */
async function accountCreationIssueVisible(page: AgentPage): Promise<boolean> {
  try {
    return Boolean(
      await page.evaluate(`(() => {
        const t = (document.body?.innerText || "").slice(0, 8000).toLowerCase();
        return /issue with your account creation/.test(t) ||
          /check your email for next login/.test(t);
      })()`),
    );
  } catch {
    return false;
  }
}

/**
 * Positive proof the signup went through: success/verify copy on screen, or
 * a verify/welcome email already in the job. A closed modal alone is not proof
 * — the agent may have clicked outside it.
 * Bovada's "issue with account creation / check email" banner is NOT success.
 */
async function signupConfirmed(
  stagehand: Stagehand,
  page: AgentPage,
  job: ResearchTeardownJob,
): Promise<boolean> {
  if (
    job.emails.some((e) => e.category === "verify" || e.category === "welcome")
  ) {
    return true;
  }
  if (await accountCreationIssueVisible(page)) return false;
  try {
    const onScreen = Boolean(
      await page.evaluate(`(() => {
        const t = (document.body?.innerText || "").slice(0, 12000);
        return /account (has been |was )?(created|registered)|registration (successful|complete)|thanks for (signing up|registering)|verify your (email|account)|we('ve| have) sent (you )?(an? )?(email|link|code)|confirmation (email|link)|enter the (code|otp|verification)/i.test(t);
      })()`),
    );
    if (onScreen) return true;
  } catch {
    /* fall through */
  }
  return checkAgentLoggedIn(stagehand);
}

/** Open Register and prove the form is on screen — never trust LLM act alone. */
async function openRegistrationForm(
  stagehand: Stagehand,
  page: AgentPage,
  tracker: JourneyStageTracker,
  brandUrl: string,
): Promise<boolean> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    if (await onCasinoDistraction(page)) {
      tracker.push(
        `Casino/bet UI in the way (attempt ${attempt}) — closing and returning to brand`,
      );
      await dismissDistractingModals(page);
      await tracker.wait(page, 600, "registration");
      if ((await onCasinoDistraction(page)) && typeof page.goto === "function") {
        await page
          .goto(brandUrl, { waitUntil: "domcontentloaded", timeoutMs: 30000 })
          .catch(() => {});
        await preparePageAfterNavigation(page, stagehand);
        await tracker.wait(page, 1200, "registration");
      }
    }

    if (await registrationFormStillOpenFast(page)) return true;

    await dismissDistractingModals(page);
    // Bovada /join is a blank page — never navigate there. Leave it if we
    // already landed on it, then use Join now / hamburger only.
    const hrefNow = String(
      await page.evaluate("location.href").catch(() => ""),
    );
    if (
      /\/join\/?(\?|#|$)/i.test(hrefNow) &&
      typeof page.goto === "function" &&
      !(await registrationFormStillOpenFast(page))
    ) {
      tracker.push("Left /join (not a real register URL) — back to homepage");
      await page
        .goto(brandUrl, { waitUntil: "domcontentloaded", timeoutMs: 30000 })
        .catch(() => {});
      await preparePageAfterNavigation(page, stagehand);
      await tracker.wait(page, 1200, "registration");
    }
    // 1) On-page Join now / Register. 2) If that click is a dud, hamburger.
    const via = attempt === 1 ? "cta" : "menu";
    const dom = await fastOpenRegistration(page, { via });
    if (dom) {
      tracker.push(
        via === "menu"
          ? `Opened hamburger — ${dom}`
          : `Opened registration via DOM (${dom})`,
      );
    }
    await tracker.wait(page, 2000, "registration");
    await waitForPaintedContent(page, { minChars: 40, maxMs: 6_000 });

    if (await onCasinoDistraction(page)) {
      tracker.push("Opened a bet/casino modal instead of Register — recovering");
      continue;
    }
    if (await registrationFormStillOpenFast(page)) return true;

    if (via === "cta") {
      tracker.push("Landing Join now did not open the form — hamburger → Register now");
      const menu = await fastOpenRegistration(page, { via: "menu" });
      if (menu) tracker.push(`Hamburger Join (${menu})`);
      await tracker.wait(page, 2000, "registration");
      await waitForPaintedContent(page, { minChars: 40, maxMs: 6_000 });
      if (await registrationFormStillOpenFast(page)) return true;
    }

    tracker.push(`DOM Register miss — agent fallback (attempt ${attempt})`);
    await stagehand
      .act(
        via === "menu"
          ? "The hamburger menu is open. Click the item labelled Register now (or Register / Sign Up). Do not go to /join. Do not click bets, games, or Terms."
          : "Click Join now on the page if it opens a form. If it does not, open the hamburger menu and click Register now. Never go to /join. Do not click bets, games, or Terms.",
      )
      .catch(() => {});
    await tracker.wait(page, 2000, "registration");
    await waitForPaintedContent(page, { minChars: 40, maxMs: 6_000 });
    if (await onCasinoDistraction(page)) {
      tracker.push("Opened a bet/casino modal instead of Register — recovering");
      continue;
    }
    if (await registrationFormStillOpenFast(page)) return true;

    // Prior Browserbase session still signed in — no Register button.
    if (await pageLooksLoggedInChrome(page)) {
      tracker.push(
        `Already signed in (attempt ${attempt}) — logging out to register fresh`,
      );
      await fastLogoutIfAuthed(page);
      await tracker.wait(page, 1500, "registration");
    }
  }
  return registrationFormStillOpenFast(page);
}

/** Registration modal vanished without proof — bring it back and try again. */
async function reopenRegistration(
  stagehand: Stagehand,
  page: AgentPage,
  tracker: JourneyStageTracker,
  brandUrl?: string,
): Promise<boolean> {
  tracker.push("Form closed with no confirmation — reopening registration");
  return openRegistrationForm(
    stagehand,
    page,
    tracker,
    brandUrl ||
      (typeof page.url === "function"
        ? page.url().split("?")[0] || page.url()
        : "https://rainbet.com"),
  );
}

/**
 * Post-signup cashier frame: recorded once, shown as the first Deposit frame
 * and noted on Registration as evidence of the redirect.
 */
async function stashCashierHandoff(
  job: ResearchTeardownJob,
  page: AgentPage,
  tracker: JourneyStageTracker,
) {
  if (job.cashierHandoffShot) return;
  const shot = await captureResearchShot(page);
  if (!shot) return;
  job.cashierHandoffShot = shot;
  const dep = tracker.stage("deposit");
  if (dep) dep.screenshotUrls = [shot];
  tracker.push("Account created → redirected straight into cashier");
}

/**
 * Hands off after Create Account: no Stagehand, no chat, no clicks.
 * Wait for the brand to redirect, then capture whatever page that is.
 */
async function waitForPostSignupRedirect(
  page: AgentPage,
  tracker: JourneyStageTracker,
): Promise<void> {
  const startHref = String(
    await page.evaluate("location.href").catch(() => ""),
  );
  tracker.push("Hands off — waiting for the site to redirect");
  // Do not use tracker.wait here: idleWatcher must not touch the page.
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(500);
    tracker.addWait("registration", 1);
    const href = String(
      await page.evaluate("location.href").catch(() => ""),
    );
    const formOpen = await registrationFormStillOpenFast(page);
    const loggedOut = await loggedOutHeaderVisible(page);
    if (!formOpen && (href !== startHref || !loggedOut)) {
      await page.waitForTimeout(800);
      tracker.addWait("registration", 1);
      tracker.push("Redirect settled");
      return;
    }
  }
  tracker.push("Redirect wait timed out — capturing this page");
}

/**
 * After Create Account: wait for the brand's redirect, then wait for the
 * welcome popup to paint on the lobby (do not click chat). Then capture.
 */
async function captureSuccessScreen(
  page: AgentPage,
  tracker: JourneyStageTracker,
  stream: StageShotStream,
) {
  await waitForPostSignupRedirect(page, tracker);
  tracker.push("Lobby up — waiting for the welcome popup to load");
  let popup = await pageLooksLikeWelcomePopup(page);
  for (let i = 0; i < 20 && !popup; i++) {
    await page.waitForTimeout(600);
    tracker.addWait("registration", 1);
    popup = await pageLooksLikeWelcomePopup(page);
  }
  tracker.push(
    popup
      ? "Welcome popup on the lobby — capturing"
      : "Welcome popup did not appear — capturing the lobby",
  );
  await page.waitForTimeout(400);
  await stream.push("Post-signup page", { force: true });
}

/** Fast DOM check — avoids a Stagehand extract on every retry. */
async function registrationFormStillOpenFast(
  page: AgentPage,
): Promise<boolean> {
  try {
    return Boolean(
      await page.evaluate(`(() => {
        const text = (document.body?.innerText || "").slice(0, 8000).toLowerCase();
        // Bovada: form stays on screen under "check your email for next login".
        if (/issue with your account creation|check your email for next login/.test(text)) {
          return false;
        }
        const hasCreate =
          /create(\\s+an?)?\\s+account|sign\\s*up|register/.test(text);
        // Security-step page (BetOnline): no fields, just a captcha + Create
        // Account. Still very much "form open" — we haven't submitted yet.
        if (
          hasCreate &&
          /i'?m not a robot|additional security step|confirm that you'?re not a robot/.test(text)
        ) {
          return true;
        }
        // Visible fields only — a hidden login form in the DOM must not
        // make a successful signup look like "form still open".
        const fields = document.querySelectorAll(
          "input[type='password'], input[type='email'], input[name*='password' i], input[name*='email' i]"
        );
        let hasFields = false;
        for (const el of fields) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { hasFields = true; break; }
        }
        return hasCreate && hasFields;
      })()`),
    );
  } catch {
    return true;
  }
}

/** True when the Create Account / Register form is still the main UI. */
async function registrationFormStillOpen(
  stagehand: Stagehand,
  page: AgentPage,
): Promise<boolean> {
  const fast = await registrationFormStillOpenFast(page);
  if (!fast) return false;
  try {
    const href = String(await page.evaluate("location.href").catch(() => ""));
    if (/help\.|\/terms|\/privacy|support\./i.test(href)) return false;
    return true;
  } catch {
    return true;
  }
}

async function runSignupFlow(
  job: ResearchTeardownJob,
  tracker: JourneyStageTracker,
  stagehand: Stagehand,
  page: AgentPage,
  input: StartResearchTeardownInput,
  vars: Record<string, string>,
  email: string,
  through: TeardownStage,
): Promise<void> {
  tracker.begin("first_touch");
  tracker.push("First touch: direct URL (research run, no affiliate hop)");
  tracker.end("first_touch", {
    steps: 1,
    owner: STAGE_OWNERS.first_touch,
    evidence: "Direct navigation",
    severity: null,
  });

  tracker.begin("landing");
  tracker.push(`Opening ${input.brandUrl}`);
  const landingRedirects = attachRedirectCounter(page);
  await page
    .goto(input.brandUrl, {
      waitUntil: "domcontentloaded",
      timeoutMs: 30000,
    })
    .catch(() => {});
  await preparePageAfterNavigation(page, stagehand);
  await waitForPaintedContent(page, { minChars: 80, maxMs: 12_000 });
  const landingShots = createShotStream(page, tracker, "landing", [], {
    maxShots: 4,
  });
  await tracker.wait(page, 800, "landing");
  if (!(await landingShots.push())) {
    await tracker.wait(page, 2000, "landing");
    await landingShots.push();
  }
  tracker.addStep("landing", 1);
  const landingSwitches = landingRedirects.count();
  landingRedirects.detach();
  await assertNotGeoBlocked(page, tracker, job, "landing", landingShots);
  await finalizeStage(
    stagehand,
    tracker,
    "landing",
    "Homepage loaded",
    { redirects: landingSwitches },
    landingShots,
  );

  // Fresh signup always opens Register — never trust a persisted Browserbase
  // context / LLM "LOGGED_IN" guess and skip the form.
  // Rainbet's lobby has a live-bets feed; LLM "click Register / Join" often
  // opens a bet result modal instead — DOM open + verify the form.
  tracker.begin("registration");
  const opened = await openRegistrationForm(
    stagehand,
    page,
    tracker,
    input.brandUrl,
  );
  const alreadyIn =
    !opened && (await pageLooksLoggedInChrome(page));
  if (!opened && !alreadyIn) {
    throw new Error(
      "Couldn't open registration — landed on casino/bet UI or Register control missing",
    );
  }
  if (alreadyIn) {
    tracker.push("Still signed in after logout try — continuing from the lobby");
  }
  tracker.addStep("registration", 1);
  tracker.push("Registration form opened");
  await tracker.wait(page, 800, "registration");
  // Every frame goes straight onto the live stage so the UI shows the whole
  // registration flow as it happens — in order, no repeats of the same screen.
  // Brands like BetOnline drop the player straight into the cashier after
  // Create Account — that frame belongs to Deposit, not Registration.
  const regShots = createShotStream(page, tracker, "registration");
  const pushRegShot = async () => {
    if (await landedInCashier(page)) {
      await stashCashierHandoff(job, page, tracker);
      return;
    }
    await regShots.push();
  };
  let landingCaptured = false;
  const captureLanding = async () => {
    if (landingCaptured) return;
    landingCaptured = true;
    tracker.idleWatcher = null;
    await captureSuccessScreen(page, tracker, regShots);
  };
  // Retry until we have a real form frame (not blank navy).
  for (let i = 0; i < 3 && regShots.shots.length === 0; i++) {
    await pushRegShot();
    if (regShots.shots.length === 0) await tracker.wait(page, 1200, "registration");
  }
  // Bovada-style: homepage renders, but Register lands on a geo wall.
  await assertNotGeoBlocked(page, tracker, job, "registration", regShots);

  const signupSince = new Date(Date.now() - 15_000);
  let maxFields = 0;
  let errorHits = 0;
  let submittedOk = alreadyIn;
  let formatFriction: string | null = null;
  let issueBanner = false;
  const takeIssueBanner = async (): Promise<boolean> => {
    if (!(await accountCreationIssueVisible(page))) return false;
    issueBanner = true;
    submittedOk = true;
    tracker.push(
      "Site: “issue with account creation — check email for next login”. Bovada often sends no mail. Stopping submit; will try login + inbox/spam.",
    );
    await pushRegShot();
    return true;
  };

  if (alreadyIn) {
    await captureLanding();
  }

  for (let step = 1; step <= 6 && !alreadyIn; step++) {
    if (stopIfPaused(job, tracker)) {
      const st = tracker.stage("registration");
      if (st && !st.endedAt) {
        tracker.end("registration", {
          evidence: "Paused by you",
          severity: null,
        });
      }
      return;
    }
    if (await recoverFromHelpOrLegalPage(page, input.brandUrl)) {
      tracker.push(
        "Left help/terms page — back on brand site, reopening register",
      );
      if (!(await registrationFormStillOpenFast(page))) {
        await preparePageAfterNavigation(page, stagehand);
        await openRegistrationForm(stagehand, page, tracker, input.brandUrl);
        tracker.addStep("registration", 1);
        await tracker.wait(page, 2000, "registration");
      }
    }

    const fields = await countVisibleFormFields(page);
    maxFields = Math.max(maxFields, fields);
    const filled = await fillRegistrationStep(stagehand, page, vars);
    if (filled.filled > 0) tracker.addStep("registration", filled.filled);
    tracker.push(
      `Registration step ${step}: filled ${filled.filled} field(s)` +
        (filled.kinds.length ? ` (${filled.kinds.join(", ")})` : "") +
        ` · ${email}`,
    );
    await pushRegShot();

    if (!(await registrationFormStillOpenFast(page))) {
      tracker.push("Form closed after fill — reopening (not treating as success)");
      if (!(await reopenRegistration(stagehand, page, tracker, input.brandUrl))) {
        tracker.push("Could not reopen registration form");
      }
      continue;
    }

    const boxes = await handleRegistrationCheckboxes(page, tracker, stagehand);
    await tracker.wait(page, 400, "registration");
    if (boxes) await pushRegShot(); // consent boxes ticked

    if (!(await registrationFormStillOpenFast(page))) {
      tracker.push(
        "Form closed during consent tick — likely hit Terms link; reopening",
      );
      if (!(await reopenRegistration(stagehand, page, tracker, input.brandUrl))) {
        tracker.push("Could not reopen registration form");
      }
      continue;
    }

    // Rainbet only — Turnstile is on the form before Create Account.
    // Winna / BetOnline / others must not wait here.
    if (
      /rainbet\.com/i.test(input.brandUrl) &&
      !(await recaptchaSolved(page))
    ) {
      const pre = await solveCaptchaIfPresent(page, stagehand, {
        push: (m) => tracker.push(m),
        shouldAbort: () => Boolean(job.pauseRequested),
      });
      if (stopIfPaused(job, tracker)) {
        const st = tracker.stage("registration");
        if (st && !st.endedAt) {
          tracker.end("registration", {
            evidence: "Paused by you",
            severity: null,
          });
        }
        return;
      }
      if (pre === "solved") {
        tracker.addStep("registration", 1);
        tracker.push("Cloudflare solved on form");
        await pushRegShot();
      } else if (pre === "timeout" || pre === "errored") {
        tracker.push(
          "Cloudflare still unchecked — retrying tick (not submitting yet)",
        );
        await pushRegShot();
        continue;
      }
    }

    const fmt = await detectFormatValidationFriction(page);
    if (fmt) {
      formatFriction = fmt;
      tracker.push(fmt);
    }

    const emptyLeft = await countEmptyVisibleInputs(page);
    if (emptyLeft > 2) {
      tracker.push(
        `${emptyLeft} empty fields left — filling again before submit`,
      );
      const again = await fillRegistrationStep(stagehand, page, vars);
      if (again.filled > 0) tracker.addStep("registration", again.filled);
      await handleRegistrationCheckboxes(page, tracker, stagehand);
    }

    // Multi-step wizards only: click Continue/Next when Create Account is NOT the CTA.
    const submitUi = await inspectRegistrationSubmitUi(page);
    if (submitUi.hasContinueNext && !submitUi.hasCreateAccount) {
      const advance = await stagehand.act(
        "click Continue or Next for the next registration step. Do not open Terms or Help.",
      );
      if (advance.success) {
        tracker.addStep("registration", 1);
        tracker.push("Advanced to next registration step");
        await tracker.wait(page, 2000, "registration");
        await pushRegShot(); // next wizard step
        errorHits += await countVisibleErrors(page);
        if (await checkAgentLoggedIn(stagehand)) {
          submittedOk = true;
          await captureLanding();
          break;
        }
        continue;
      }
    }

    // BetOnline-style: Create Account stays disabled until captcha is solved.
    if (
      submitUi.createAccountDisabled &&
      (await captchaChallengeVisible(page)) &&
      !(await recaptchaSolved(page))
    ) {
      tracker.push("Create Account disabled — solving captcha first");
      await pushRegShot();
      await handleRegistrationCaptcha(page, stagehand, tracker, job);
      if (stopIfPaused(job, tracker)) {
        const st = tracker.stage("registration");
        if (st && !st.endedAt) {
          tracker.end("registration", {
            evidence: "Paused by you",
            severity: null,
          });
        }
        return;
      }
      await tracker.wait(page, 1000, "registration");
      await pushRegShot();
    }

    const emptyNow = await countEmptyVisibleInputs(page);
    // Form filled + Create Account visible → click it. Cloudflare after submit
    // is handled inside hammerCreateAccountUntilDone.
    if (submitUi.hasCreateAccount && emptyNow <= 1) {
      tracker.push("Form ready — clicking Create Account");
      const done = await hammerCreateAccountUntilDone(
        stagehand,
        page,
        tracker,
        3,
        pushRegShot,
        () => signupConfirmed(stagehand, page, job),
        job,
      );
      if (done) {
        submittedOk = true;
        tracker.addStep("registration", 1);
        tracker.push("Create Account accepted — form closed or logged in");
        await captureLanding();
        break;
      }
      if (await takeIssueBanner()) break;
      tracker.push("Create Account click did not close form — will retry");
    } else {
      await pushRegShot(); // form state right before submit
      const submitted = await submitRegistrationForm(stagehand, page);
      if (submitted) {
        tracker.addStep("registration", 1);
        tracker.push("Clicked Create Account / submit");
      } else {
        tracker.push("Create Account click missed — will retry");
      }
      await tracker.wait(page, 2000, "registration");
      if (await takeIssueBanner()) break;
    }
    // Pull any welcome/verify mail early so the Emails tab fills during the run.
    await pollInboxEvidenceOnly(
      job,
      email,
      input.brandUrl,
      signupSince,
      "registration",
    );
    errorHits += await countVisibleErrors(page);
    await pushRegShot();

    if (await recoverFromHelpOrLegalPage(page, input.brandUrl)) {
      tracker.push("Submit opened help/terms — recovered without full reload");
      if (!(await registrationFormStillOpenFast(page))) {
        await preparePageAfterNavigation(page, stagehand);
        await reopenRegistration(stagehand, page, tracker, input.brandUrl);
      }
      continue;
    }

    if (await checkAgentLoggedIn(stagehand)) {
      submittedOk = true;
      await captureLanding();
      break;
    }

    if (await registrationFormStillOpen(stagehand, page)) {
      const empty = await countEmptyVisibleInputs(page);
      const fmtAgain = await detectFormatValidationFriction(page);
      if (fmtAgain) {
        formatFriction = fmtAgain;
        tracker.push(fmtAgain);
      }
      tracker.push(
        empty > 0
          ? `Form still open — ${empty} empty field(s), refilling then retry`
          : "Form still open after submit — checking boxes then clicking Create Account again",
      );
      const refill = await fillRegistrationStep(stagehand, page, vars);
      if (refill.filled > 0) tracker.addStep("registration", refill.filled);
      await handleRegistrationCheckboxes(page, tracker, stagehand);
      await tracker.wait(page, 400, "registration");
      if (empty <= 1 || (await turnstileLooksSolved(page))) {
        const done = await hammerCreateAccountUntilDone(
          stagehand,
          page,
          tracker,
          2,
          pushRegShot,
          () => signupConfirmed(stagehand, page, job),
          job,
        );
        if (done) {
          submittedOk = true;
          await captureLanding();
          break;
        }
      } else {
        await pushRegShot(); // refilled form before re-submit
        const resubmitted = await submitRegistrationForm(stagehand, page);
        if (resubmitted) {
          tracker.addStep("registration", 1);
          tracker.push("Re-clicked Create Account");
        }
        await tracker.wait(page, 2000, "registration");
        await pushRegShot();
        const after = await solveCaptchaAfterSubmit(page, stagehand, {
          push: (m) => tracker.push(m),
          shouldAbort: () => Boolean(job.pauseRequested),
          appearMs: 15_000,
        });
        if (stopIfPaused(job, tracker)) {
          const st = tracker.stage("registration");
          if (st && !st.endedAt) {
            tracker.end("registration", {
              evidence: "Paused by you",
              severity: null,
            });
          }
          return;
        }
        if (after === "solved") {
          tracker.push("Cloudflare solved — clicking Create Account again");
          await fastClickCreateAccount(page, { force: true });
          await tracker.wait(page, 3000, "registration");
          await pushRegShot();
        }
      }
      errorHits += await countVisibleErrors(page);
      if (await checkAgentLoggedIn(stagehand)) {
        submittedOk = true;
        await captureLanding();
        break;
      }
      if (!(await registrationFormStillOpen(stagehand, page))) {
        if (await takeIssueBanner()) break;
        if (await signupConfirmed(stagehand, page, job)) {
          submittedOk = true;
          tracker.push("Registration submitted — confirmation seen");
          await captureLanding();
          break;
        }
        // Modal gone, nothing confirms a signup — not a success.
        if (!(await reopenRegistration(stagehand, page, tracker, input.brandUrl))) {
          tracker.push("Could not reopen registration form");
        }
      }
    } else if (await takeIssueBanner()) {
      break;
    } else if (await signupConfirmed(stagehand, page, job)) {
      submittedOk = true;
      tracker.push("Registration submitted — confirmation seen");
      await captureLanding();
      break;
    } else {
      // Form closed without proof (clicked outside the modal, nav click…).
      if (!(await reopenRegistration(stagehand, page, tracker, input.brandUrl))) {
        tracker.push("Could not reopen registration form");
      }
    }
  }

  // Cashier redirect is noted, but the homepage/welcome frame stays on
  // Registration — deposit starts after that landing is captured.
  const inCashier = await landedInCashier(page);
  if (inCashier) await stashCashierHandoff(job, page, tracker);

  const loggedInNow = await checkAgentLoggedIn(stagehand);
  if (loggedInNow || submittedOk) {
    // Homepage + welcome chat first (even if a cashier modal is also up).
    // Deposit starts after this frame is on the Registration card.
    await captureLanding();
    await armWelcomeWatch(job, tracker, page, vars);
  }

  const regOrdered = [...regShots.shots];

  if (loggedInNow) {
    await finalizeStage(
      stagehand,
      tracker,
      "registration",
      inCashier
        ? `Account created · ${maxFields} fields · redirected straight to cashier`
        : `Account created · ${maxFields} fields · homepage after submit`,
      {
        fieldCount: maxFields,
        errorCount: errorHits,
        screenshotUrls: regOrdered,
        friction: formatFriction ?? undefined,
        frictionType: formatFriction ? "clarify" : undefined,
        severity: formatFriction ? "medium" : null,
      },
      null,
    );
    tracker.begin("verification");
    // A positive — the brand skipped the verify wall. Evidence, not friction.
    tracker.end("verification", {
      steps: 0,
      owner: STAGE_OWNERS.verification,
      evidence: "No email wall — logged in straight after submit",
      severity: null,
    });
    job.authenticated = true;
    tracker.push("Registered without email wall");
    return;
  }

  await finalizeStage(
    stagehand,
    tracker,
    "registration",
    submittedOk
      ? inCashier
        ? `Form submitted · ${maxFields} fields · redirected straight to cashier`
        : `Form submitted · ${maxFields} fields · homepage after submit`
      : `Form incomplete · ${maxFields} fields · may be blocked`,
    {
      fieldCount: maxFields,
      errorCount: errorHits,
      screenshotUrls: regOrdered,
      friction:
        formatFriction ||
        (submittedOk
          ? undefined
          : "Could not submit registration (empty fields or validation)"),
      frictionType: formatFriction ? "clarify" : undefined,
      severity: formatFriction ? "medium" : submittedOk ? null : "critical",
    },
    null,
  );

  if (!submittedOk) {
    throw new Error(
      "Registration not submitted — form still incomplete after retries",
    );
  }

  if (stageRank(through) <= stageRank("registration")) {
    tracker.push("Stopped after registration");
    return;
  }

  tracker.begin("verification");
  tracker.push("Monitoring inbox + spam — every message logged + acted on");
  const verifyShots = createShotStream(page, tracker, "verification");
  const pushVerifyShot = () => verifyShots.push();
  // Where the player is left after submit (verify wall / welcome / cashier).
  await pushVerifyShot();
  const verifyWaitStart = Date.now();
  issueBanner = issueBanner || (await accountCreationIssueVisible(page));
  const password = String(vars.password ?? "");
  if (issueBanner && !job.authenticated) {
    tracker.push(
      "No signup mail expected from that banner — trying login first",
    );
    if (
      await tryLoginWithSignupCredentials(
        stagehand,
        page,
        tracker,
        email,
        password,
      )
    ) {
      job.authenticated = true;
    }
  }
  // Banner path: don't sit 100s for mail Bovada never sends.
  const deadline = Date.now() + (issueBanner ? 45_000 : 100_000);
  const phoneHint =
    input.persona?.phone?.trim() || String(vars.phone ?? "").trim() || "";
  let askedForSms = false;
  let triedLogin = issueBanner;

  while (Date.now() < deadline && !job.authenticated) {
    if (!askedForSms && (await detectSmsChallenge(page))) {
      askedForSms = true;
      if (
        await handleSmsChallenge({
          job,
          tracker,
          stagehand,
          page,
          input,
          phoneHint,
        })
      ) {
        job.authenticated = true;
        break;
      }
    }
    await monitorInboxPass(
      job,
      stagehand,
      page,
      email,
      input.brandUrl,
      signupSince,
      "verification",
    );
    if (await checkAgentLoggedIn(stagehand)) {
      job.authenticated = true;
      break;
    }
    if (
      !triedLogin &&
      !job.authenticated &&
      job.emails.length === 0 &&
      Date.now() - verifyWaitStart > 12_000
    ) {
      triedLogin = true;
      if (
        await tryLoginWithSignupCredentials(
          stagehand,
          page,
          tracker,
          email,
          password,
        )
      ) {
        job.authenticated = true;
        break;
      }
    }
    if (
      job.emails.some(
        (e) =>
          e.category === "verify" ||
          (e.category === "welcome" && (e.links?.length ?? 0) > 0),
      ) &&
      !job.authenticated
    ) {
      const verify = await completeAgentEmailVerification({
        stagehand,
        page,
        email,
        siteUrl: input.brandUrl,
        since: signupSince,
        trail: job.steps,
        timeoutMs: 20_000,
        afterAct: async () => {
          const shot = await pushVerifyShot();
          if (!shot) return;
          // Attach to the verify mail we just handled — not whatever is last.
          const target =
            job.emails.find(
              (e) =>
                e.category === "verify" &&
                e.brandId === job.brandId &&
                e.otpPresent,
            ) ?? job.emails.filter((e) => e.brandId === job.brandId).at(-1);
          if (target) {
            target.screenshotUrls = [
              ...new Set([...(target.screenshotUrls ?? []), shot]),
            ];
          }
        },
      });
      if (verify.acted) tracker.addStep("verification", 1);
      job.authenticated =
        verify.loggedIn || (await checkAgentLoggedIn(stagehand));
      if (job.authenticated) break;
    }
    await tracker.wait(page, 7000, "verification");
  }

  if (!job.authenticated) {
    if (!askedForSms && (await detectSmsChallenge(page))) {
      askedForSms = true;
      if (
        await handleSmsChallenge({
          job,
          tracker,
          stagehand,
          page,
          input,
          phoneHint,
        })
      ) {
        job.authenticated = true;
      }
    }
  }

  if (!job.authenticated && !issueBanner) {
    tracker.push("Auto-verify incomplete — watching live view 45s");
    for (let i = 0; i < 9; i++) {
      await tracker.wait(page, 5000, "verification");
      if (!askedForSms && (await detectSmsChallenge(page))) {
        askedForSms = true;
        await handleSmsChallenge({
          job,
          tracker,
          stagehand,
          page,
          input,
          phoneHint,
        });
      }
      await monitorInboxPass(
        job,
        stagehand,
        page,
        email,
        input.brandUrl,
        signupSince,
        "verification",
      );
      if (await checkAgentLoggedIn(stagehand)) {
        job.authenticated = true;
        break;
      }
    }
  }

  const verifyWaitSec = Math.round((Date.now() - verifyWaitStart) / 1000);
  const verifyMails = job.emails.filter((e) => e.category === "verify");
  await pushVerifyShot();
  if (job.authenticated) {
    await armWelcomeWatch(job, tracker, page, vars);
    tracker.push("Holding the screen after signup / verify");
    await tracker.wait(page, 2500, "verification");
    await checkWelcomeTouch(job, tracker, page, vars);
    await pushVerifyShot();
  }

  tracker.end("verification", {
    steps: verifyMails.length > 0 ? 1 : 0,
    waitSec: verifyWaitSec,
    owner: STAGE_OWNERS.verification,
    friction: job.authenticated
      ? undefined
      : issueBanner && job.emails.length === 0
        ? "Bovada said check email for next login — no message arrived (inbox + spam). Login with the same details also failed. This banner is often a silent decline, not a sent email."
        : "Verification incomplete (CAPTCHA / SMS / no mail)",
    userImpact: job.authenticated
      ? undefined
      : "Player cannot fund or play until verified",
    frictionType: job.authenticated ? null : "speed_up",
    severity: job.authenticated ? null : "critical",
    evidence: verifyMails[0]
      ? `${verifyMails.length} email(s); ${verifyMails[0].subject.slice(0, 80)}; ${verifyMails[0].actionTaken ?? "noted"}`
      : issueBanner
        ? "No email after “check your email for next login steps”"
        : "No verification email captured",
    screenshotUrls: [...verifyShots.shots],
  });

  if (!job.authenticated) {
    throw new Error(
      issueBanner && job.emails.length === 0
        ? "Bovada said check email — none arrived (inbox + spam) and login failed. That banner is usually a silent decline, not a sent message."
        : "Could not activate account — check live view + inbox",
    );
  }
  tracker.push(`Account activated · ${job.emails.length} email(s) documented`);
}

async function runDepositFlow(
  job: ResearchTeardownJob,
  tracker: JourneyStageTracker,
  stagehand: Stagehand,
  page: AgentPage,
  input: StartResearchTeardownInput,
  email: string,
  through: TeardownStage,
): Promise<void> {
  if (!job.authenticated) {
    throw new Error("Must be logged in before deposit walk");
  }

  tracker.begin("deposit");
  tracker.push(
    "Opening deposit — will NOT submit payment until address verified",
  );
  const depositSince = new Date();

  // Frame per cashier screen, streamed onto the live stage as we go. Starts
  // with the post-signup cashier frame if registration handed one over.
  const depositShots = createShotStream(
    page,
    tracker,
    "deposit",
    job.cashierHandoffShot ? [job.cashierHandoffShot] : [],
  );
  const pushDepositShot = async (label: string) => {
    // Only cashier frames belong to Deposit — the lobby with a carousel
    // ticking over is not evidence, however many times it changes.
    if (!(await pageLooksLikeCashier(page))) return;
    await depositShots.push(`Deposit: ${label}`);
    // The deposit walk uses raw waits — tick the welcome watcher here so a
    // late chat greeting gets captured and closed before it blocks a click.
    if (tracker.idleWatcher) await tracker.idleWatcher(page).catch(() => {});
  };

  // Live chat is evidence, not a control — do not click it (that reopens it).
  tracker.idleWatcher = null;
  if (await pageLooksLikeOpenChat(page)) {
    await dismissOpenChat(page);
    tracker.push("Ignoring live chat — going to deposit");
  }
  let details = await walkToDepositAddress(stagehand, page, pushDepositShot);
  // Final gate: trust DOM scrape over LLM — never ask for money on a soft miss.
  const domAddress = await scrapeBtcAddressFromDom(page);
  if (domAddress && isValidBtcAddress(domAddress)) {
    details = {
      ...details,
      address: domAddress,
      currency: "BTC",
      network: details.network || "Bitcoin",
    };
  } else if (!isValidBtcAddress(details.address)) {
    details = { ...details, address: null };
  }

  const displayCurrency = details.address
    ? await selectBitcoinDisplayCurrency(page)
    : { needed: false, switched: false, from: null, to: null };
  if (displayCurrency.needed) {
    tracker.push(
      displayCurrency.switched
        ? `Header was ${displayCurrency.from ?? "Tether"} — switched to Bitcoin to see BTC`
        : `Header shows ${displayCurrency.from ?? "Tether"} — player must pick Bitcoin to see a BTC credit`,
    );
  }

  tracker.addStep("deposit", 2);
  await finalizeStage(
    stagehand,
    tracker,
    "deposit",
    details.address
      ? `${details.currency ?? "BTC"} ${details.network ?? "Bitcoin"} ${details.address}`.trim()
      : "Address not captured",
    {
      friction: !details.address
        ? "Could not read deposit address — payment NOT requested"
        : displayCurrency.needed
          ? "Header defaults to Tether — player must open the balance dropdown and pick Bitcoin to see a BTC credit"
          : undefined,
      severity: details.address ? (displayCurrency.needed ? "medium" : null) : "high",
      redirects: 1,
    },
    depositShots,
  );

  if (!details.address || !isValidBtcAddress(details.address)) {
    throw new Error(
      "Deposit address not captured — no payment requested. Re-run deposit when the Wallet Address screen is visible.",
    );
  }

  // A re-run of this brand replaces any older deposit request — stop the old
  // paused browser too, so only ONE address per brand is ever shown.
  for (const old of listResearchActions(input.projectId)) {
    if (
      old.kind === "manual_deposit" &&
      old.status === "pending" &&
      old.brandId === input.brandId &&
      old.jobId !== job.id
    ) {
      cancelPaymentWait(old.jobId, "Superseded by a newer run of this brand");
    }
  }

  // The site's own QR for this address — pay by scanning from the notification.
  let qrUrl: string | null = null;
  try {
    const qr = await captureDepositQr(page, details.address);
    if (qr) qrUrl = (await persistShots([qr]))[0] ?? null;
  } catch {
    qrUrl = null;
  }
  if (qrUrl) tracker.push("Captured deposit QR code");
  const action = createDepositAction({
    projectId: input.projectId,
    brandId: input.brandId,
    brandName: input.brandName,
    brandUrl: input.brandUrl,
    jobId: job.id,
    liveViewUrl: job.liveViewUrl,
    depositAddress: details.address,
    network: details.network || "Bitcoin",
    currency: "BTC",
    amountHint: details.amountHint || "Minimum BTC deposit",
    qrUrl,
  });
  job.actionId = action.id;
  job.depositAddress = details.address;
  job.status = "awaiting_payment";
  job.sessionOpen = true;
  tracker.push(
    `BTC address verified (${details.address.slice(0, 12)}…) — open Notifications to copy & send min deposit`,
  );
  tracker.push(
    `BTC ${details.amountHint ? `(${details.amountHint}) ` : ""}${details.address}`,
  );
  const payMode = await waitForManualPayment(job.id);
  if (payMode === "pause" || stopIfPaused(job, tracker)) {
    stopIfPaused(job, tracker);
    return;
  }
  job.paidAt = new Date().toISOString();
  await runDepositConfirmationWatch({
    job,
    tracker,
    stagehand,
    page,
    input,
    email,
    through,
    depositAddress: details.address,
    paidAt: new Date(),
    depositSince,
    resumed: false,
    testSkip: payMode === "skip",
  });
}

/**
 * From "I've paid" until funds land. Clicks the site's own "I've completed
 * the payment", then polls balance / inbox / chain with T+n snapshots.
 * Pausable (long bank transfers) and resumable in a fresh session; in a
 * test run (`testSkip`) it walks the same path for a couple of minutes
 * without scoring the brand, so the post-deposit flow can be refined.
 */
async function runDepositConfirmationWatch(args: {
  job: ResearchTeardownJob;
  tracker: JourneyStageTracker;
  stagehand: Stagehand;
  page: AgentPage;
  input: StartResearchTeardownInput;
  email: string;
  through: TeardownStage;
  /** null when resuming a run whose address wasn't recorded — chain check is skipped. */
  depositAddress: string | null;
  paidAt: Date;
  depositSince: Date;
  /** Resumed after a pause — the stage already exists, "I've paid" was clicked. */
  resumed: boolean;
  testSkip: boolean;
}): Promise<void> {
  const {
    job,
    tracker,
    stagehand,
    page,
    input,
    email,
    through,
    depositAddress,
    paidAt,
    depositSince,
    resumed,
    testSkip,
  } = args;

  if (stageRank(through) < stageRank("deposit_confirmed")) {
    tracker.begin("deposit_confirmation");
    tracker.end("deposit_confirmation", {
      steps: 0,
      evidence: "Payment sent — confirmation skipped for this run depth",
    });
    job.depositConfirmed = true;
    return;
  }

  job.status = "confirming_payment";
  const actionAfterPay =
    getResearchActionByJobId(job.id) ??
    getOpenDepositActionForBrand(job.projectId, job.brandId);
  if (actionAfterPay) {
    patchResearchAction(actionAfterPay.id, { status: "confirming" });
  }
  tracker.push("Payment marked sent — checking email and site");

  if (!resumed) tracker.begin("deposit_confirmation");
  const confirmStart = resumed ? paidAt.getTime() : Date.now();
  let confirmedVia: "email" | "site" | "manual" | null = null;
  let emailSubject: string | null = null;
  let balanceSeen: string | null = null;

  // Tell the site too: most cashiers gate chain-watching behind an
  // "I've completed the payment" click. Frame what it shows next.
  const confirmShots = createShotStream(page, tracker, "deposit_confirmation");
  // On resume the funds may already be in: compare against the zero balance
  // the watch started from, not whatever the header shows now.
  let tetherDefault = false;
  const switchDisplay = async () => {
    const cur = await selectBitcoinDisplayCurrency(page);
    if (cur.needed) tetherDefault = true;
    if (cur.switched) {
      tracker.push(
        `Switched header from ${cur.from ?? "Tether"} to ${cur.to ?? "Bitcoin"}`,
      );
    }
    return cur;
  };
  await switchDisplay();
  const balanceBefore = resumed ? "0" : await readHeaderBalance(page);
  const paidBtn = resumed ? null : await clickPaymentSentButton(page);
  if (resumed) {
    tracker.push("Resumed deposit watch in a fresh session");
  } else if (paidBtn) {
    tracker.addStep("deposit_confirmation", 1);
    tracker.push(`Clicked "${paidBtn}" on site`);
    await tracker.wait(page, 3000, "deposit_confirmation");
  } else {
    tracker.push(
      "No 'I've paid' button on the cashier — site watches the chain itself",
    );
  }
  await confirmShots.push("After marking payment sent");

  // Post-deposit research: catch the toast / popup the moment it appears.
  let firstAlert: PostDepositScreen | null = null;
  let firstPopup: PostDepositScreen | null = null;
  const postShots: string[] = [];
  const watchScreen = async (): Promise<PostDepositScreen | null> => {
    const screen = await inspectPostDepositScreen(page);
    if (!screen) return null;
    if (screen.alertText && !firstAlert) {
      firstAlert = screen;
      tracker.push(`On-site alert: "${screen.alertText.slice(0, 90)}"`);
      const shot = await captureResearchShot(page);
      if (shot) postShots.push(shot);
    }
    if (screen.popup && !firstPopup) {
      firstPopup = screen;
      tracker.push(
        `Popup after deposit: "${screen.popup.text.slice(0, 90)}"` +
          (screen.popup.ctas[0]
            ? ` · CTA "${screen.popup.ctas[0].label}"`
            : ""),
      );
      const shot = await captureResearchShot(page);
      if (shot) postShots.push(shot);
    }
    return screen;
  };

  // Real money is on the chain now — watch until it lands. BTC needs 1–3
  // confirmations (10–60 min), so this is a long, cheap DOM poll with a
  // T+n snapshot every few minutes so the report shows exactly how long the
  // player stared at $0.00 with no email and no alert.
  // Test: fresh skip walks the post-payment flow for 2 min; a forced resume
  // just records the current screen and moves on.
  const watchMinutes = testSkip
    ? resumed
      ? 0
      : 2
    : Number(process.env.RESEARCH_DEPOSIT_WATCH_MIN ?? 60);
  if (testSkip) {
    job.depositSkipped = true;
    tracker.push(
      resumed
        ? "TEST — continuing without waiting for funds. Recording the current state, then moving on."
        : "TEST RUN — no funds sent. Walking the post-payment flow for 2 min to see what the site does, then continuing.",
    );
  }
  const confirmDeadline = Date.now() + watchMinutes * 60_000;
  const snapshotEveryMs = 5 * 60_000;
  let nextSnapshotAt = Date.now() + snapshotEveryMs;
  let lastLlmCheckAt = 0;
  const brandHostName = new URL(input.brandUrl).hostname;
  const emailsSincePay = () =>
    job.emails.filter(
      (e) =>
        e.brandId === job.brandId &&
        new Date(e.receivedAt).getTime() >= depositSince.getTime(),
    ).length;
  // Fairness: the clock the brand is judged on starts when the payment is
  // actually visible on-chain, not when the human pressed "I've paid" — the
  // transfer can sit on the sender's side (bank KYC, exchange queue).
  let chain: ChainStatus | null = null;
  let chainSeenAt: number | null = null;
  let lastChainCheckAt = 0;
  const pollChain = async () => {
    if (!depositAddress) return;
    if (Date.now() - lastChainCheckAt < 60_000) return;
    lastChainCheckAt = Date.now();
    const next = await checkBtcAddressOnChain(depositAddress);
    if (!next) return;
    if (next !== chain) {
      tracker.push(`On-chain: ${chainStatusLabel(next)}`);
      if (next !== "none" && chainSeenAt == null) chainSeenAt = Date.now();
    }
    chain = next;
  };
  const snapshot = async (label: string, shot = true) => {
    const balance = await readHeaderBalance(page);
    const url = shot
      ? await captureResearchShot(page, { fullPage: false })
      : null;
    const entry: DepositWatchEntry = {
      afterSec: Math.round((Date.now() - paidAt.getTime()) / 1000),
      balance,
      emails: emailsSincePay(),
      alert: firstAlert?.alertText ?? null,
      screenshotUrl: url,
      chain,
    };
    job.depositWatch.push(entry);
    const m = Math.round(entry.afterSec / 60);
    tracker.push(
      `${label} T+${m}m · balance ${balance ?? "not shown"} · ${entry.emails} email${
        entry.emails === 1 ? "" : "s"
      } · ${entry.alert ? "alert seen" : "no alert"} · ${chainStatusLabel(chain)}`,
    );
  };
  await pollChain();
  await snapshot("Watch", false);

  while (Date.now() < confirmDeadline && !confirmedVia && !job.pauseRequested) {
    await pollChain();
    const screen = await watchScreen();
    if (screen?.alertText) {
      confirmedVia = "site";
      balanceSeen = screen.alertText.slice(0, 160);
      tracker.push("Site confirmed deposit on screen");
      break;
    }
    // Header balance flipped from zero → funds landed, even without a toast.
    // Tether $0 with BTC sitting on another wallet is not "still waiting".
    let balanceNow = await readHeaderBalance(page);
    if (headerLooksLikeTether(balanceNow) && balanceIsZero(balanceNow)) {
      await switchDisplay();
      balanceNow = await readHeaderBalance(page);
    }
    if (
      balanceNow &&
      !balanceIsZero(balanceNow) &&
      (balanceIsZero(balanceBefore) || balanceNow !== balanceBefore)
    ) {
      confirmedVia = "site";
      balanceSeen = balanceNow;
      tracker.push(`Balance updated to ${balanceNow}`);
      break;
    }
    await monitorInboxPass(
      job,
      stagehand,
      page,
      email,
      input.brandUrl,
      depositSince,
      "deposit_confirmation",
    );
    const depositMail = job.emails.find(
      (e) =>
        new Date(e.receivedAt).getTime() >= depositSince.getTime() &&
        (e.category === "deposit_nudge" ||
          /deposit|payment received|funds|credited|transaction/i.test(
            e.subject,
          )),
    );
    if (depositMail) {
      confirmedVia = "email";
      emailSubject = depositMail.subject;
      if (depositMail.category !== "deposit_nudge") {
        depositMail.category = "deposit_nudge";
      }
      depositMail.stageId = depositMail.stageId ?? "deposit_confirmation";
      tracker.push(`Deposit email: ${depositMail.subject}`);
      break;
    }
    const mail = await waitForDepositEmail(
      { toAddress: email, since: depositSince, fromDomainHint: brandHostName },
      10_000,
    );
    if (mail) {
      confirmedVia = "email";
      emailSubject = mail.subject;
      await pollInboxEvidenceOnly(
        job,
        email,
        input.brandUrl,
        depositSince,
        "deposit_confirmation",
      );
      const attached = job.emails.find(
        (e) =>
          e.subject === mail.subject ||
          /deposit|payment received|funds|credited/i.test(e.subject),
      );
      if (attached) {
        attached.category = "deposit_nudge";
        attached.stageId = attached.stageId ?? "deposit_confirmation";
      } else {
        job.emails.push({
          id: `deposit-mail-${Date.now()}`,
          brandId: job.brandId,
          receivedAt: mail.receivedAt ?? new Date().toISOString(),
          from: mail.from,
          subject: mail.subject,
          category: "deposit_nudge",
          dayNumber: 0,
          summary: mail.snippet?.slice(0, 220) ?? mail.subject,
          body: mail.snippet,
          links: mail.links,
          actionTaken: "noted",
          actionResult: "deposit confirmation",
          stageId: "deposit_confirmation",
          screenshotUrls: [],
          runId: job.runId,
        });
      }
      tracker.push(`Deposit email: ${mail.subject}`);
      break;
    }
    // LLM read of the page is slow and costs — once a minute is plenty.
    if (Date.now() - lastLlmCheckAt > 60_000) {
      lastLlmCheckAt = Date.now();
      const site = await siteShowsDepositCredited(stagehand);
      if (site.credited) {
        confirmedVia = "site";
        balanceSeen = site.balanceText;
        tracker.push("Site shows funds credited");
        break;
      }
    }
    if (Date.now() >= nextSnapshotAt) {
      nextSnapshotAt = Date.now() + snapshotEveryMs;
      await snapshot("Still waiting");
      // Older cashiers only refresh the balance on navigation. Every second
      // snapshot (10 min) reload like a player would — but not more often,
      // or we'd miss the toast/popup the site fires when funds land.
      if (job.depositWatch.length % 2 === 1) {
        await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
        await tracker.wait(page, 2500, "deposit_confirmation");
      }
    }
    await tracker.wait(page, 15_000, "deposit_confirmation");
  }

  const confirmWaitSec = Math.round((Date.now() - confirmStart) / 1000);
  await pollChain();

  if (job.pauseRequested && !confirmedVia) {
    await snapshot("Paused");
    const st = tracker.stage("deposit_confirmation");
    if (st) {
      st.evidence = `Paused at T+${Math.round(confirmWaitSec / 60)}m — ${chainStatusLabel(chain)} · balance ${
        job.depositWatch.at(-1)?.balance ?? "not shown"
      } · resume from the report`;
      st.severity = null;
    }
    tracker.recomputeMetrics();
    job.status = "paused";
    job.sessionOpen = false;
    tracker.push(
      "Paused — browser closed. Resume anytime; the watch picks up where it left off.",
    );
    return;
  }

  await snapshot(confirmedVia ? "Landed" : "Stopped watching");
  if (confirmedVia === "email") {
    // The email *is* the confirmation evidence; the screen we're looking at
    // now is "what the site does after deposit", so it belongs to that card.
    const after = await captureResearchShot(page);
    if (after) postShots.push(after);
  } else {
    await confirmShots.push(
      confirmedVia ? "Funds landed" : "Still unconfirmed",
    );
  }
  const waitedMin = Math.round(confirmWaitSec / 60);
  // Minutes the brand had the money (on-chain) before crediting it.
  const brandDelaySec =
    chainSeenAt != null
      ? Math.round((Date.now() - chainSeenAt) / 1000)
      : confirmWaitSec;
  const brandDelayMin = Math.round(brandDelaySec / 60);
  const lastBalance = job.depositWatch.at(-1)?.balance ?? "not shown";

  let evidence: string;
  let friction: string | undefined;
  let severity: "medium" | "high" | null = null;
  if (testSkip && !confirmedVia) {
    evidence = `TEST — deposit skipped, no funds sent · site showed ${
      paidBtn ? `"${paidBtn}" flow` : "no I've-paid step"
    } · balance ${lastBalance}`;
  } else if (confirmedVia) {
    evidence = emailSubject
      ? `email after ${waitedMin}m: ${emailSubject}`
      : balanceSeen
        ? `balance after ${waitedMin}m: ${balanceSeen}`
        : `confirmed after ${waitedMin}m`;
    if (brandDelaySec > 15 * 60) {
      friction = `Funds took ${brandDelayMin} min to show after the payment was on-chain — no interim "pending deposit" state for the player`;
      severity = "medium";
    }
    const extra: string[] = [];
    if (tetherDefault) {
      extra.push(
        "Header defaults to Tether — player must switch to Bitcoin to see a BTC credit",
      );
    }
    if (!firstAlert) {
      extra.push(
        "No on-site toast or alert when funds landed — player has to notice the balance themselves",
      );
    }
    if (extra.length) {
      friction = [friction, ...extra].filter(Boolean).join(" · ");
      severity = severity ?? "medium";
    }
  } else if (chain === "none") {
    // Nothing ever left the sender — this is not the brand's fault.
    evidence = `not credited after ${waitedMin}m — but nothing was sent on-chain yet (sender side); brand not scored`;
  } else if (chain === "mempool") {
    evidence = `not credited after ${waitedMin}m — payment broadcast ${brandDelayMin}m ago, awaiting confirmation · balance ${lastBalance}`;
    friction = `Payment visible on-chain for ${brandDelayMin} min, still unconfirmed — site shows no pending-deposit state, no email, no alert`;
    severity = "medium";
  } else if (chain === "confirmed") {
    evidence = `not credited after ${waitedMin}m — confirmed on-chain ${brandDelayMin}m ago · balance ${lastBalance}`;
    friction = `Deposit confirmed on-chain ${brandDelayMin} min ago and still not credited — no email, no alert, balance unchanged`;
    severity = "high";
  } else {
    evidence = `not confirmed after ${waitedMin}m — balance ${lastBalance} · chain not verifiable`;
    friction = `Deposit not credited after ${waitedMin} min — could not verify the transfer on-chain, check the address before scoring`;
    severity = "medium";
  }

  tracker.end("deposit_confirmation", {
    steps: paidBtn ? 1 : 0,
    waitSec: confirmWaitSec,
    evidence,
    friction,
    frictionType: friction ? "reassure" : undefined,
    severity,
    screenshotUrls: [...confirmShots.shots],
  });

  if (actionAfterPay) {
    patchResearchAction(actionAfterPay.id, {
      status: confirmedVia ? "confirmed" : "payment_sent",
      confirmedAt: confirmedVia ? new Date().toISOString() : null,
      confirmedVia,
      emailSubject,
      balanceSeen,
    });
  }

  job.depositConfirmed = Boolean(confirmedVia);
  if (confirmedVia) tracker.push(`Deposit confirmed via ${confirmedVia}`);

  // Nothing ever hit the chain: there is no post-deposit behaviour to record
  // and no OKR flag to raise — stop without blaming the brand.
  if (!confirmedVia && chain === "none" && !testSkip) {
    throw new Error(
      `No payment reached ${(depositAddress ?? "the address").slice(0, 10)}… within ${waitedMin} min — transfer still on the sender's side. Send the BTC, then re-run deposit for this brand.`,
    );
  }

  // What does the brand do now the money is in? Recorded even if unconfirmed
  // so the report still shows where the player was left.
  await captureAfterDeposit({
    job,
    tracker,
    stagehand,
    page,
    input,
    paidAt,
    confirmedVia,
    creditedAfterSec: confirmedVia ? confirmWaitSec : null,
    firstAlert,
    firstPopup,
    postShots,
    testSkip,
  });

  if (testSkip) {
    job.depositConfirmed = false;
    tracker.push("TEST — continuing to the next stage without funds");
    return;
  }

  if (!confirmedVia && stageRank(through) >= stageRank("deposit_confirmed")) {
    throw new Error(
      chain === "mempool"
        ? `Payment broadcast but unconfirmed after ${waitedMin} min — brand hasn't credited yet`
        : chain === "confirmed"
          ? `Payment confirmed on-chain but not credited after ${waitedMin} min`
          : `Payment sent but deposit not confirmed after ${waitedMin} min`,
    );
  }
}

/**
 * Post-deposit picture: landing surface, popup + CTA, on-site alert, what the
 * site tells the player to do, where its own CTA leads when followed, emails
 * and their real link targets, then OKR flags from all of it.
 */
async function captureAfterDeposit(args: {
  job: ResearchTeardownJob;
  tracker: JourneyStageTracker;
  stagehand: Stagehand;
  page: AgentPage;
  input: StartResearchTeardownInput;
  paidAt: Date;
  confirmedVia: "email" | "site" | null;
  creditedAfterSec: number | null;
  firstAlert: PostDepositScreen | null;
  firstPopup: PostDepositScreen | null;
  postShots: string[];
  /** Test run without funds — record what we see, don't score it. */
  testSkip?: boolean;
}): Promise<void> {
  const { job, tracker, stagehand, page, input, paidAt } = args;
  tracker.push("Recording what the site does after deposit");

  const now = (await inspectPostDepositScreen(page)) ?? null;
  const popupScreen = args.firstPopup ?? (now?.popup ? now : null);
  const landingUrl = now?.url ?? null;
  const landedOn = now ? classifyScreen(now) : null;

  const finalShot = await captureResearchShot(page);
  const shots = [...args.postShots];
  if (finalShot) shots.push(finalShot);

  // One LLM read: what is the player being told to do?
  const llm = await describeNextStepGuidance(stagehand);

  // Follow the site's own primary CTA (popup first, else a visible play CTA)
  // so we know where it actually routes the fresh deposit.
  let guidedTo: PostDepositObservation["guidedTo"] = null;
  let guidedUrl: string | null = null;
  const popupCta = popupScreen?.popup?.ctas.find(
    (c) => !/close|dismiss|later|no thanks|✕|x$/i.test(c.label),
  );
  const playCta =
    popupCta ??
    now?.ctas.find((c) =>
      /play now|start playing|go to (casino|sports|lobby)|claim|bet now|explore|continue/i.test(
        c.label,
      ),
    ) ??
    null;
  if (playCta) {
    const before = landingUrl;
    if (playCta.href) {
      guidedUrl = playCta.href;
      guidedTo = classifyDestination(playCta.href, playCta.label);
    } else {
      const clicked = await stagehand
        .act(
          `click the "${playCta.label}" button (the site's own next-step call to action). Do not deposit again.`,
        )
        .catch(() => ({ success: false }));
      if (clicked.success) {
        await tracker.wait(page, 3000);
        const after = await inspectPostDepositScreen(page);
        guidedUrl = after?.url ?? null;
        guidedTo = classifyDestination(
          guidedUrl,
          after?.bodySnippet?.slice(0, 400) ?? playCta.label,
        );
        if (guidedUrl && guidedUrl !== before) {
          const shot = await captureResearchShot(page);
          if (shot) shots.push(shot);
        }
      }
    }
    tracker.push(
      `Site CTA "${playCta.label}" → ${guidedTo ?? "unknown"}${guidedUrl ? ` (${guidedUrl.slice(0, 80)})` : ""}`,
    );
  }

  // Emails since payment — with redirect-resolved link targets.
  await monitorInboxPass(
    job,
    stagehand,
    page,
    job.signupEmail ?? "",
    input.brandUrl,
    paidAt,
    "deposit_confirmation",
  );
  const emails = await summarizePostDepositEmails(
    job.emails,
    paidAt,
    input.brandUrl,
  );
  for (const e of emails) {
    tracker.push(
      `Email +${e.receivedAfterSec}s "${e.subject.slice(0, 60)}" → link lands on ${e.linkTarget ?? "unknown"}`,
    );
  }

  const base: Omit<PostDepositObservation, "okrFlags"> = {
    creditedAfterSec: args.creditedAfterSec,
    confirmedVia: args.confirmedVia,
    landedOn,
    landingUrl,
    balanceAlert: {
      seen: Boolean(args.firstAlert?.alertText),
      text: args.firstAlert?.alertText ?? null,
    },
    popup: {
      seen: Boolean(popupScreen?.popup),
      text: popupScreen?.popup?.text ?? null,
      cta: popupCta?.label ?? popupScreen?.popup?.ctas[0]?.label ?? null,
      ctaTarget: popupCta
        ? classifyDestination(popupCta.href, popupCta.label)
        : null,
    },
    guidedTo: guidedTo ?? llm.routedTo,
    guidedUrl,
    guidance: llm.guidance,
    ctas: (now?.ctas ?? []).map((c) => c.label).slice(0, 8),
    emails,
    screenshotUrls: [...new Set(shots)],
  };
  const okrFlags = args.testSkip
    ? [
        "TEST RUN — deposit skipped (no funds sent). Post-deposit behaviour recorded for flow tuning only; OKR flags not scored.",
      ]
    : postDepositOkrFlags(base);
  job.postDeposit = { ...base, okrFlags };

  for (const f of okrFlags) tracker.push(`OKR flag: ${f}`);

  // Surface the strongest flag on the stage so it ranks in Top friction.
  const stage = job.stages.find((s) => s.stageId === "deposit_confirmation");
  if (stage && okrFlags[0]) {
    if (!stage.friction) {
      stage.friction = okrFlags[0];
      stage.severity = /sportsbook/i.test(okrFlags[0]) ? "high" : "medium";
      stage.frictionType = /sportsbook/i.test(okrFlags[0])
        ? "personalise"
        : /no on-site confirmation|no deposit confirmation email/i.test(
              okrFlags[0],
            )
          ? "reassure"
          : "clarify";
      stage.userImpact =
        "Fresh deposit not steered into casino play — Time to stake grows";
    }
    stage.screenshotUrls = [
      ...new Set([...(stage.screenshotUrls ?? []), ...base.screenshotUrls]),
    ];
    stage.evidence = [
      stage.evidence,
      `landed: ${landedOn ?? "?"}`,
      base.popup.seen ? "popup" : "no popup",
      base.balanceAlert.seen ? "alert" : "no alert",
      `${emails.length} email(s)`,
    ]
      .filter(Boolean)
      .join(" · ");
  }
}

async function runPlayFlow(
  job: ResearchTeardownJob,
  tracker: JourneyStageTracker,
  stagehand: Stagehand,
  page: AgentPage,
): Promise<void> {
  if (!job.depositConfirmed && !job.depositSkipped) {
    for (const id of ["casino_discovery", "game_launch", "first_bet"]) {
      tracker.skip(id, "Deposit not confirmed — cannot play");
    }
    tracker.begin("days_1_14");
    tracker.end("days_1_14", {
      steps: 0,
      evidence: "Awaiting funded account",
    });
    return;
  }

  // One shot stream per play stage so every screen lands in the journey.
  const streams = new Map<string, StageShotStream>();
  const onShot = async (stageId: string, label: string) => {
    let st = streams.get(stageId);
    if (!st) {
      st = createShotStream(page, tracker, stageId);
      streams.set(stageId, st);
    }
    await st.push(label);
  };
  if (!job.depositConfirmed) {
    tracker.push(
      "Playing with $0 balance (deposit skipped) — exploring lobby, launching a game; wager not scored",
    );
  }
  const { firstBetPlaced, lobby } = await runCasinoPlayFlow(
    stagehand,
    page,
    tracker,
    { funded: job.depositConfirmed, onShot },
  );
  job.firstBetPlaced = firstBetPlaced;
  job.lobby = lobby;
  if (firstBetPlaced) tracker.push("First bet placed — full journey complete");
  else if (!job.depositConfirmed)
    tracker.push("Play stages recorded on a $0 balance");
  else tracker.push("First bet stage finished — wager may need manual check");

  // Off the stopwatch: what else does the site offer? Feeds the Feature
  // benchmark (rewards, missions, feeds, cross-sell, 2FA…).
  try {
    job.features = await runFeatureScan({
      stagehand,
      page,
      tracker,
      brandUrl: job.brandUrl,
      lobby: job.lobby,
      onShot: async () => captureResearchShot(page),
    });
  } catch (e) {
    tracker.push(
      `Feature scan skipped: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // Final CRM inbox sweep for days_1_14 evidence
  tracker.begin("days_1_14");
  const since = new Date(job.startedAt);
  await monitorInboxPass(
    job,
    stagehand,
    page,
    job.signupEmail ?? "",
    // brandUrl on job
    job.brandUrl,
    since,
    "days_1_14",
  );
  const crm = job.emails.filter(
    (e) => e.category !== "verify" && e.stageId === "days_1_14",
  );
  tracker.end("days_1_14", {
    steps: crm.length,
    evidence:
      crm.length > 0
        ? `${crm.length} CRM email(s) captured`
        : "No further CRM mail yet",
  });
}

/** Full timed journey: signup → verify → deposit → play → first bet. */
/**
 * Log into an account this project already created (post-signup). When
 * `trackStages` is false the stopwatch stages are left alone — used when
 * resuming a paused deposit watch, where the real stages are seeded from
 * the earlier session.
 */
async function loginExistingAccount(args: {
  job: ResearchTeardownJob;
  tracker: JourneyStageTracker;
  stagehand: Stagehand;
  page: AgentPage;
  input: StartResearchTeardownInput;
  email: string;
  resolvedPassword: string;
}): Promise<void> {
  const { job, tracker, stagehand, page, input, email, resolvedPassword } =
    args;
  // Account already exists from signup — log in, don't re-register.
  tracker.begin("first_touch");
  tracker.end("first_touch", {
    steps: 0,
    evidence: "Resume after signup",
    severity: "low",
  });
  tracker.begin("landing");
  await page
    .goto(input.brandUrl, {
      waitUntil: "domcontentloaded",
      timeoutMs: 30000,
    })
    .catch(() => {});
  await preparePageAfterNavigation(page, stagehand);
  await tracker.wait(page, 2500, "landing");
  await finalizeStage(
    stagehand,
    tracker,
    "landing",
    "Opened for deposit login",
    {},
    page,
  );

  const password = resolvedPassword;
  if (!password) {
    throw new Error(
      "No password for login — reuse the signup password (Test accounts)",
    );
  }
  job.steps.push(`Login password: same as signup (${password.length} chars)`);
  // A balance in the header is proof of a session — cheaper and more
  // reliable than asking the LLM, which has called a logged-in mobile home
  // "LOGGED_OUT" because of a Join banner.
  const isLoggedIn = async () =>
    (await readHeaderBalance(page)) != null ||
    (await checkAgentLoggedIn(stagehand));
  if (!(await isLoggedIn())) {
    const priorReg = tracker.stage("registration");
    const keepSignup =
      ((priorReg?.fieldCount ?? 0) > 0 ||
        (priorReg?.screenshotUrls?.length ?? 0) > 0 ||
        (priorReg?.steps ?? 0) > 0) &&
      !isSkippedStage(priorReg);
    if (!keepSignup) {
      tracker.begin("registration");
      tracker.end("registration", {
        steps: 0,
        evidence: "Skipped — logging into existing account",
        severity: "low",
        fieldCount: priorReg?.fieldCount ?? null,
        screenshotUrls: priorReg?.screenshotUrls ?? [],
      });
    }
    tracker.begin("verification");
    tracker.push(`Logging in as ${email}`);
    // DOM first (header Log In, /login link, hamburger → Log In), then the
    // LLM, then the conventional /login URL. Verify a password field exists
    // after each — the LLM has opened Register instead.
    const opened = await fastOpenLogin(page);
    if (opened) tracker.addStep("verification", 1);
    await tracker.wait(page, 1500, "verification");
    if (!(await loginFormVisible(page))) {
      const open = await stagehand.act(
        "click Log In or Sign In (not Register / Sign Up) to open the login form. Do NOT open registration.",
      );
      if (open.success) tracker.addStep("verification", 1);
      await tracker.wait(page, 1500, "verification");
    }
    if (!(await loginFormVisible(page))) {
      try {
        const origin = new URL(input.brandUrl).origin;
        await page.goto(`${origin}/login`, {
          waitUntil: "domcontentloaded",
          timeoutMs: 20000,
        });
        await preparePageAfterNavigation(page, stagehand);
        await tracker.wait(page, 1500, "verification");
        tracker.push("Login form not found in header — opened /login directly");
      } catch {
        /* keep going; the fill below reports what it could see */
      }
    }
    tracker.push(
      `Login form ${(await loginFormVisible(page)) ? "open" : "NOT visible"} · ${opened ? `opened via ${opened}` : "no Log In control matched in DOM"} · ${(() => {
        try {
          return new URL(page.url()).pathname;
        } catch {
          return "?";
        }
      })()}`,
    );

    // DOM fill — Stagehand often types email and skips password.
    let filled = await fastFillLoginCredentials(page, {
      email,
      password,
    });
    if (!filled.password) {
      await stagehand.act(
        "type %password% into the Password field on this Log In form — do not click Register",
        { variables: { password } },
      );
      filled = await fastFillLoginCredentials(page, {
        email,
        password,
      });
    }
    if (!filled.email) {
      await stagehand.act(
        "type %email% into the Email or Account Number field on this Log In form",
        { variables: { email } },
      );
    }
    if (!filled.password) {
      throw new Error("Password field still empty after fill — cannot log in");
    }
    tracker.push(
      `Login fields filled (email ${filled.email ? "ok" : "retry"}, password ok)`,
    );
    tracker.addStep("verification", 2);
    const loginShots = createShotStream(page, tracker, "verification");
    await loginShots.push("Login form filled");
    // DOM submit first (button in the login form, else Enter) — the LLM click
    // has missed the button and left the form sitting there.
    const submitted = await fastSubmitLogin(page);
    if (!submitted) {
      await stagehand.act(
        "click the Log In, Sign In, or Submit button to log in — not Create Account",
      );
    }
    tracker.push(`Submitted login (${submitted ?? "llm click"})`);
    tracker.addStep("verification", 1);
    await tracker.wait(page, 4000, "verification");
    await loginShots.push("After login submit");

    let loginError: string | null = null;
    let loggedIn = await isLoggedIn();
    // New-device / email code on login: read the inbox and enter it.
    if (!loggedIn && (await loginOtpPromptVisible(page))) {
      tracker.push("Login asks for a one-time code — checking inbox");
      const otpDeadline = Date.now() + 90_000;
      while (Date.now() < otpDeadline && !loggedIn) {
        await monitorInboxPass(
          job,
          stagehand,
          page,
          email,
          input.brandUrl,
          new Date(Date.now() - 10 * 60_000),
          "verification",
        );
        await tracker.wait(page, 3000, "verification");
        loggedIn = await isLoggedIn();
        if (!loggedIn && !(await loginOtpPromptVisible(page))) break;
      }
      await loginShots.push("After login code");
    }
    if (!loggedIn) {
      loginError = await readLoginError(page);
      // One clean retry: re-fill and submit again (first attempt sometimes
      // fires before the form's JS is attached).
      if (
        !loginError ||
        !/locked|suspend|blocked|not (?:found|recogni)/i.test(loginError)
      ) {
        tracker.push(
          `Not logged in yet${loginError ? ` (“${loginError}”)` : ""} — retrying once`,
        );
        await fastFillLoginCredentials(page, { email, password });
        await tracker.wait(page, 600, "verification");
        if (!(await fastSubmitLogin(page))) {
          await stagehand
            .act("click the Log In / Sign In button on this login form")
            .catch(() => {});
        }
        await tracker.wait(page, 4500, "verification");
        loggedIn = await isLoggedIn();
        if (!loggedIn) loginError = (await readLoginError(page)) ?? loginError;
        await loginShots.push("After login retry");
      }
    }
    job.authenticated = loggedIn;
    job.loginError = loginError;
    await loginShots.push(loggedIn ? "Logged in" : "Login failed");
    tracker.end("verification", {
      steps: 1,
      evidence: job.authenticated
        ? `Logged in as ${email}`
        : `Login failed for ${email}${loginError ? ` — site said “${loginError}”` : ""}`,
      severity: job.authenticated ? "low" : "critical",
    });
  } else {
    job.authenticated = true;
    tracker.begin("registration");
    tracker.end("registration", {
      steps: 0,
      evidence: "Already logged in",
      severity: "low",
    });
    tracker.begin("verification");
    tracker.end("verification", {
      steps: 0,
      evidence: "Session active",
      severity: "low",
    });
  }
  if (!job.authenticated) {
    const formOpen = await loginFormVisible(page);
    let where = "";
    try {
      where = new URL(page.url()).pathname;
    } catch {
      /* ignore */
    }
    throw new Error(
      job.loginError
        ? `Could not log into ${email} — site said “${job.loginError}”. Check the saved password on the Accounts card; if the site wants an email code, make sure the inbox is connected.`
        : formOpen
          ? `Could not log into ${email} — the login form is still open on ${where || "the page"} with no error shown. The submit may not be registering on mobile; check the "Login failed" frame in Verification.`
          : `Could not log into ${email} — no login form was found on ${where || "the page"} and no session was detected. Check the "Login failed" frame in Verification.`,
    );
  }
}

const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

/**
 * Make the tab a real phone at the CDP level: mobile UA + platform, touch,
 * device metrics with mobile:true (so `window.innerWidth`, media queries and
 * UA-sniffing all agree). Persists across navigations for this target.
 */
async function applyMobileEmulation(page: AgentPage): Promise<void> {
  const cdp = (
    page as unknown as {
      sendCDP?: (method: string, params?: object) => Promise<unknown>;
    }
  ).sendCDP?.bind(page);
  if (!cdp) return;
  try {
    await cdp("Emulation.setUserAgentOverride", {
      userAgent: MOBILE_UA,
      platform: "Linux armv81",
      acceptLanguage: "en-US,en;q=0.9",
      userAgentMetadata: {
        brands: [
          { brand: "Chromium", version: "128" },
          { brand: "Google Chrome", version: "128" },
          { brand: "Not;A=Brand", version: "24" },
        ],
        fullVersion: "128.0.0.0",
        platform: "Android",
        platformVersion: "14.0.0",
        architecture: "",
        model: "Pixel 8",
        mobile: true,
      },
    });
    await cdp("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
      screenWidth: 390,
      screenHeight: 844,
    });
    await cdp("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 5,
    });
  } catch {
    /* emulation is best-effort — Browserbase fingerprint still applies */
  }
}

export async function startResearchTeardown(
  input: StartResearchTeardownInput,
): Promise<{
  jobId: string;
  liveViewUrl: string | null;
  signupEmail: string;
  signupPassword: string;
  signupUsername: string | null;
}> {
  const through = input.throughStage ?? "verification";
  const proxyMarket = proxyMarketForBrand(input.brandUrl, input.market);
  const {
    vars,
    email,
    password: resolvedPassword,
  } = resolveVars(
    input.persona,
    proxyMarket,
    input.brandName,
    input.accountEmail,
    input.accountPassword,
  );

  if (stageRank(through) >= stageRank("verification") && !inboxConfigured()) {
    throw new Error("Gmail IMAP not configured");
  }

  const jobId = `rst-${Date.now().toString(36)}`;
  const proxyCountry = MARKET_PROXY_COUNTRY[proxyMarket] ?? null;
  const job: ResearchTeardownJob = {
    id: jobId,
    runId: input.runId,
    projectId: input.projectId,
    brandId: input.brandId,
    brandName: input.brandName,
    brandUrl: input.brandUrl,
    status: "starting",
    liveViewUrl: null,
    steps: [
      `Signup email: ${email}`,
      proxyCountry
        ? `Proxy: ${proxyMarket} (${proxyCountry})${
            proxyMarket !== input.market
              ? ` — brand override (project market ${input.market})`
              : ""
          }`
        : `Proxy: none (project market ${input.market})`,
    ],
    stages:
      input.seedStages?.length &&
      (input.startAt === "deposit" ||
        input.startAt === "deposit_confirmation" ||
        input.startAt === "play" ||
        input.startAt === "features")
        ? input.seedStages.map((st) => ({ ...st }))
        : emptyStagesFor(input.kind),
    metrics: emptyMetrics(),
    error: null,
    authenticated: false,
    depositConfirmed: false,
    firstBetPlaced: false,
    startedAt: Date.now(),
    actionId: null,
    sessionOpen: false,
    topFriction: [],
    signupEmail: email,
    signupPassword: resolvedPassword,
    signupUsername: null,
    lobby: null,
    features: null,
    emails: [],
    seenEmailIds: [],
    postDeposit: null,
    postSignup: null,
    signupConfirmedAt: null,
    depositWatch:
      (input.startAt === "deposit_confirmation" || input.startAt === "play") &&
      input.seedDepositWatch
        ? [...input.seedDepositWatch]
        : [],
    depositAddress: null,
    paidAt: null,
    depositSkipped: false,
    pauseRequested: false,
    proxyMarket,
  };
  jobs.set(jobId, job);
  const tracker = new JourneyStageTracker(job);

  const contextId = await createContext();
  const isMobile = input.device === "mobile";

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
        region: (process.env.BROWSERBASE_REGION ??
          "eu-central-1") as "eu-central-1",
        timeout: Number(process.env.BROWSERBASE_SESSION_TIMEOUT_SEC ?? 3600),
        browserSettings: {
          viewport: isMobile
            ? { width: 390, height: 844 }
            : { width: 1440, height: 900 },
          ...(isMobile
            ? {
                fingerprint: {
                  devices: ["mobile" as const],
                  operatingSystems: ["android" as const],
                  browsers: ["chrome" as const],
                  screen: { maxWidth: 430, maxHeight: 932 },
                },
              }
            : {}),
          context: { id: contextId, persist: true },
          solveCaptchas: true,
        },
        ...proxyConfig(proxyCountry),
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
  sessionHandles.set(jobId, {
    sessionId: sessionId || undefined,
    close: () => stagehand.close().catch(() => {}),
  });
  job.status = "running";

  void (async () => {
    try {
      const page =
        stagehand.context.activePage() ?? (await stagehand.context.newPage());
      if (isMobile) await applyMobileEmulation(page);

      if (input.kind === "returning_player_login") {
        const { loggedIn } = await runReturningLoginFlow(
          stagehand,
          page,
          tracker,
          { brandUrl: input.brandUrl, persona: input.persona },
        );
        job.authenticated = loggedIn;
        job.topFriction = pickTopFriction(job.stages);
        job.status = loggedIn ? "success" : "failed";
        if (!loggedIn) job.error = "Returning login failed";
        job.sessionOpen = false;
        return;
      }

      if (
        input.startAt === "deposit" ||
        input.startAt === "deposit_confirmation" ||
        input.startAt === "play" ||
        input.startAt === "features"
      ) {
        // Resume keeps the real stopwatch stages from the paused session —
        // the login below is plumbing, not part of the player's journey.
        const seededStages =
          input.startAt === "deposit_confirmation" ||
          input.startAt === "play" ||
          input.startAt === "features"
            ? job.stages.map((st) => ({ ...st }))
            : null;
        await loginExistingAccount({
          job,
          tracker,
          stagehand,
          page,
          input,
          email,
          resolvedPassword,
        });
        if (seededStages) job.stages = seededStages;
        if (input.startAt === "features") {
          // Nothing timed here — inventory the site and stop.
          job.features = await runFeatureScan({
            stagehand,
            page,
            tracker,
            brandUrl: input.brandUrl,
            lobby: job.lobby,
            onShot: async () => captureResearchShot(page),
          });
          job.topFriction = pickTopFriction(job.stages);
          job.status = "success";
          job.sessionOpen = false;
          return;
        }
        if (input.startAt === "play" && input.replayPlay) {
          // Funded re-run of the play stages: deposit is done, so start the
          // casino / launch / bet stages from scratch and score them.
          job.depositConfirmed = true;
          job.depositSkipped = false;
          // The human already saw funds land — close the deposit request
          // that an earlier job left in "confirming".
          const openDeposit = getOpenDepositActionForBrand(
            job.projectId,
            job.brandId,
          );
          if (openDeposit) {
            patchResearchAction(openDeposit.id, {
              status: "confirmed",
              confirmedAt: new Date().toISOString(),
              confirmedVia: "manual",
            });
          }
          const fresh = emptyStagesFor(input.kind);
          for (const id of [
            "casino_discovery",
            "game_launch",
            "first_bet",
            "days_1_14",
          ]) {
            const idx = job.stages.findIndex((st) => st.stageId === id);
            const blank = fresh.find((st) => st.stageId === id);
            if (idx >= 0 && blank) job.stages[idx] = { ...blank };
          }
          tracker.recomputeMetrics();
          tracker.push(
            "Account funded — re-running casino discovery, game launch and first bet",
          );
        } else if (input.startAt === "play") {
          // Skip past the deposit entirely: whatever is still open there is
          // marked skipped and the run carries on with a $0 balance.
          job.depositSkipped = true;
          job.depositConfirmed = false;
          for (const id of ["deposit", "deposit_confirmation"]) {
            const st = tracker.stage(id);
            if (!st) continue;
            if (!st.endedAt) {
              if (!st.startedAt) tracker.begin(id);
              tracker.end(id, {
                evidence: `Skipped (test) — continuing with $0 balance${
                  st.evidence ? ` · ${st.evidence}` : ""
                }`,
                severity: null,
              });
            }
          }
          tracker.recomputeMetrics();
          tracker.push(
            "Deposit skipped — moving on to casino discovery with $0",
          );
        }
        if (input.startAt === "deposit_confirmation") {
          const rw = input.resumeWatch;
          if (!rw?.paidAt) {
            throw new Error("Resume needs the time the deposit was paid");
          }
          const paidAt = new Date(rw.paidAt);
          job.depositAddress = rw.depositAddress ?? null;
          job.paidAt = rw.paidAt;
          tracker.push(
            `Resuming deposit watch${
              rw.depositAddress ? ` for ${rw.depositAddress.slice(0, 12)}…` : ""
            } (paid ${Math.round((Date.now() - paidAt.getTime()) / 60000)} min ago)`,
          );
          job.status = "confirming_payment";
          await runDepositConfirmationWatch({
            job,
            tracker,
            stagehand,
            page,
            input,
            email,
            through,
            depositAddress: rw.depositAddress ?? null,
            paidAt,
            depositSince: paidAt,
            resumed: true,
            testSkip: input.forceAhead === true,
          });
        }
      } else {
        await runSignupFlow(
          job,
          tracker,
          stagehand,
          page,
          input,
          vars,
          email,
          through,
        );
      }

      if (stopIfPaused(job, tracker)) {
        job.topFriction = pickTopFriction(job.stages);
        return;
      }

      if (
        !job.authenticated &&
        stageRank(through) >= stageRank("verification")
      ) {
        throw new Error("Signup did not complete");
      }

      if (
        stageRank(through) >= stageRank("deposit") &&
        job.authenticated &&
        input.startAt !== "deposit_confirmation" &&
        input.startAt !== "play"
      ) {
        await runDepositFlow(
          job,
          tracker,
          stagehand,
          page,
          input,
          email,
          through,
        );
      }

      if (job.status === "paused" || stopIfPaused(job, tracker)) {
        job.topFriction = pickTopFriction(job.stages);
        return;
      }

      if (stageRank(through) >= stageRank("first_bet") && job.authenticated) {
        await runPlayFlow(job, tracker, stagehand, page);
      }

      job.topFriction = pickTopFriction(job.stages);
      job.status = "success";
      job.sessionOpen = false;
    } catch (e) {
      job.error = e instanceof Error ? e.message : String(e);
      job.topFriction = pickTopFriction(job.stages);
      if (
        job.status !== "awaiting_payment" &&
        job.status !== "awaiting_sms" &&
        job.status !== "paused"
      ) {
        job.status = "failed";
        job.sessionOpen = false;
        tracker.push(`Failed: ${job.error}`);
      }
      tracker.recomputeMetrics();
    } finally {
      sessionHandles.delete(jobId);
      if (job.sessionOpen) {
        tracker.push(
          job.status === "awaiting_sms"
            ? "Browser open — paste SMS code in Notifications then agent continues"
            : "Browser open — pay in Notifications then agent continues",
        );
      } else {
        if (sessionId) await releaseSession(sessionId);
        await stagehand.close().catch(() => {});
      }
    }
  })();

  return {
    jobId,
    liveViewUrl: job.liveViewUrl,
    signupEmail: email,
    signupPassword: resolvedPassword,
    signupUsername: job.signupUsername,
  };
}
