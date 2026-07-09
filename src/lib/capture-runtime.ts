import { EventEmitter } from "node:events";
import {
  chromium,
  type Browser,
  type CDPSession,
  type Page,
} from "playwright-core";
import {
  scoreScreenshots,
  type JourneyAnalysis,
} from "./analyst";
import { persistShots } from "./evidence-storage";
import {
  createSession,
  getLiveViewUrl,
  releaseSession,
  type Viewport,
} from "./browserbase";

export interface RecorderEvent {
  at: number; // seconds since session start
  kind: "screen" | "money" | "reward" | "info";
  label: string;
  detail?: string;
  /** URL the browser was on when the event fired — lets the UI tie events
   * (and session goals) to the journey they belong to. */
  context?: string;
}

/** A screenshot taken mid-session, tagged with where it was taken. */
interface SessionShot {
  at: number;
  url: string;
  data: string; // base64 jpeg
}

interface CaptureSession {
  id: string;
  browser: Browser;
  page: Page;
  cdp: CDPSession | null;
  liveViewUrl: string;
  startedAt: number;
  emitter: EventEmitter;
  events: RecorderEvent[];
  shots: SessionShot[];
  balances: string[];
  currentUrl: string;
  poll: NodeJS.Timeout;
  shotTimer: NodeJS.Timeout | null;
}

/** Survive HMR in dev by stashing sessions on globalThis. */
const store = globalThis as unknown as {
  __captureSessions?: Map<string, CaptureSession>;
};
const sessions = (store.__captureSessions ??= new Map<
  string,
  CaptureSession
>());

const MONEY_RE = /(?:[$£€]\s?\d[\d,]*(?:\.\d+)?)|(?:\d+\.\d{2,}\s?(?:USDT|BTC|ETH|SOL|LTC))/gi;

/** Raw CDP screenshot — doesn't wait for page stability, safe on any state. */
async function takeShot(session: CaptureSession) {
  if (!session.cdp) return;
  try {
    const { data } = (await session.cdp.send("Page.captureScreenshot", {
      format: "jpeg",
      quality: 60,
    })) as { data: string };
    session.shots.push({
      at: Math.round((Date.now() - session.startedAt) / 1000),
      url: session.currentUrl,
      data,
    });
    // Keep memory bounded; recent screens matter most for scoring.
    if (session.shots.length > 40) session.shots.shift();
  } catch {
    // Page mid-navigation or session closing — skip this shot.
  }
}

function emit(session: CaptureSession, event: Omit<RecorderEvent, "at">) {
  const full: RecorderEvent = {
    ...event,
    at: Math.round((Date.now() - session.startedAt) / 1000),
    context: event.context ?? session.currentUrl,
  };
  session.events.push(full);
  session.emitter.emit("event", full);
}

export async function startCapture(
  url: string,
  viewport?: Viewport,
  contextId?: string,
  proxyCountry?: string | null
): Promise<{
  sessionId: string;
  liveViewUrl: string;
}> {
  const { id, connectUrl } = await createSession(viewport, contextId, proxyCountry);
  const browser = await chromium.connectOverCDP(connectUrl);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = context.pages()[0] ?? (await context.newPage());
  const liveViewUrl = await getLiveViewUrl(id);

  const session: CaptureSession = {
    id,
    browser,
    page,
    cdp: null,
    liveViewUrl,
    startedAt: Date.now(),
    emitter: new EventEmitter(),
    events: [],
    shots: [],
    balances: [],
    currentUrl: url,
    poll: undefined as unknown as NodeJS.Timeout,
    shotTimer: null,
  };
  sessions.set(id, session);
  session.cdp = await context.newCDPSession(page).catch(() => null);

  emit(session, { kind: "info", label: "Remote browser attached" });

  // Real navigation detection. Each navigation schedules a screenshot after
  // the destination has had a moment to render (debounced for SPA bursts).
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      session.currentUrl = frame.url();
      emit(session, {
        kind: "screen",
        label: "Navigated",
        detail: frame.url(),
      });
      if (session.shotTimer) clearTimeout(session.shotTimer);
      session.shotTimer = setTimeout(() => void takeShot(session), 2500);
    }
  });

  // Generic balance-delta detection: scan the page for monetary values and
  // report when the set changes (deposit, bet settle, reward credit).
  let tick = 0;
  session.poll = setInterval(async () => {
    // Periodic screenshot so long stays on one page (playing, cashier
    // modals) still leave scoreable evidence.
    if (++tick % 3 === 0) void takeShot(session);
    try {
      const text = await page.evaluate(() => document.body?.innerText ?? "");
      const found = Array.from(
        new Set(text.match(MONEY_RE)?.map((s) => s.trim()) ?? [])
      ).slice(0, 12);
      const prev = new Set(session.balances);
      const added = found.filter((v) => !prev.has(v));
      if (session.balances.length > 0 && added.length > 0) {
        // Classify by where the change happened so the feed (and session
        // goals) reflect the actual activity, not a generic delta.
        const at = session.currentUrl.toLowerCase();
        const label = /withdraw|cash.?out|payout/.test(at)
          ? "Withdrawal activity detected"
          : /deposit|cashier|top.?up|wallet/.test(at)
            ? "Deposit / cashier activity detected"
            : /reward|vip|loyal|rakeback|rebate/.test(at)
              ? "Reward value change detected"
              : /casino|game|slot|sport|bet|play/.test(at)
                ? "Stake / balance change while playing"
                : "Balance / amount change detected";
        emit(session, {
          kind: /reward|vip|loyal|rakeback|rebate/.test(at)
            ? "reward"
            : "money",
          label,
          detail: added.join(", "),
        });
      }
      if (found.length > 0) session.balances = found;
    } catch {
      // Page navigating or closed — ignore this tick.
    }
  }, 4000);

  // Kick off navigation (don't await full load; live view shows progress).
  page
    .goto(url, { waitUntil: "domcontentloaded", timeout: 45000 })
    .then(() => {
      emit(session, { kind: "screen", label: "Page loaded", detail: url });
      setTimeout(() => void takeShot(session), 4000);
    })
    .catch((e) =>
      emit(session, {
        kind: "info",
        label: "Navigation issue",
        detail: String(e.message ?? e).slice(0, 140),
      })
    );

  return { sessionId: id, liveViewUrl };
}

export function getSession(id: string): CaptureSession | undefined {
  return sessions.get(id);
}

export async function stopCapture(id: string): Promise<void> {
  const session = sessions.get(id);
  if (!session) return;
  clearInterval(session.poll);
  if (session.shotTimer) clearTimeout(session.shotTimer);
  session.emitter.emit("done");
  await session.browser.close().catch(() => {});
  await releaseSession(id);
  sessions.delete(id);
}

/** URL → journey classification, most specific first ("deposit" must win
 * over "casino" when both appear in a cashier URL). */
const JOURNEY_URL_PATTERNS: [string, RegExp][] = [
  ["withdraw", /withdraw|cash-?out|payout/],
  ["deposit", /deposit|cashier|top-?up|wallet/],
  ["loyalty_rewards", /reward|vip|loyal|rakeback|rebate|bonus|promo/],
  ["signup", /sign-?up|register|registration|join/],
  ["support", /support|help|faq|contact/],
  ["my_account", /account|profile|settings|verification|kyc/],
  ["sports_betslip", /sport|betslip/],
  ["casino", /casino|game|slot|live-?dealer|play/],
];

function classifyUrl(url: string): string | null {
  const u = url.toLowerCase();
  for (const [journey, re] of JOURNEY_URL_PATTERNS) {
    if (re.test(u)) return journey;
  }
  return null;
}

/**
 * End a session the productive way: group its screenshots by the journeys
 * the user actually visited, score each with the vision analyst, then tear
 * the session down. This is how a recorded session becomes real scores.
 */
export async function finishCapture(
  id: string
): Promise<{ analyses: JourneyAnalysis[] }> {
  const session = sessions.get(id);
  if (!session) return { analyses: [] };

  // Final shot of wherever the user ended up.
  await takeShot(session);

  const byJourney = new Map<string, SessionShot[]>();
  for (const shot of session.shots) {
    const journey = classifyUrl(shot.url);
    if (!journey) continue;
    const list = byJourney.get(journey) ?? [];
    list.push(shot);
    byJourney.set(journey, list);
  }

  // Stop the browser before the (slow) scoring calls — the evidence is
  // already in memory and the remote session costs money while idle.
  await stopCapture(id);

  const analyses: JourneyAnalysis[] = [];
  for (const [journey, shots] of byJourney) {
    const picked = shots.slice(-3);
    const finalUrl = picked[picked.length - 1].url;
    try {
      const [result, screenshots] = await Promise.all([
        scoreScreenshots(
          journey,
          "",
          finalUrl,
          picked.map((s) => s.data),
          [],
          "session"
        ),
        persistShots(picked.map((s) => s.data)),
      ]);
      analyses.push({
        ...result,
        area: journey,
        analysedAt: new Date().toISOString(),
        screenshots,
        finalUrl,
      });
    } catch (e) {
      console.error(
        `[capture] scoring ${journey} from session ${id} failed:`,
        e instanceof Error ? e.message : e
      );
    }
  }
  return { analyses };
}
