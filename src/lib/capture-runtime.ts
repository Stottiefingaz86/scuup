import { readFile } from "node:fs/promises";
import {
  chromium,
  type Browser,
  type CDPSession,
  type Page,
} from "playwright-core";
import { scoreScreenshots, type JourneyAnalysis } from "./analyst";
import {
  classifyMoneyChange,
  classifyUrl,
  MONEY_RE,
  type SessionShotRef,
} from "./capture-shared";
import { localEvidencePath, persistShots } from "./evidence-storage";
import {
  createSession,
  getConnectUrl,
  getLiveViewUrl,
  releaseSession,
  type Viewport,
} from "./browserbase";
import { preparePageAfterNavigation } from "./dismiss-site-cookies";

/**
 * Live capture on serverless: every API call may land on a different
 * instance, so NOTHING can rely on module state. Sessions are created with
 * keepAlive so the remote browser survives disconnects; each poll
 * re-attaches over CDP, observes, and disconnects. The popup client owns
 * the session's accumulated state (events, shot refs, balances) and hands
 * it back to the server at finish time for scoring.
 */

export interface RecorderEvent {
  at: number; // seconds since session start
  kind: "screen" | "money" | "reward" | "info";
  label: string;
  detail?: string;
  /** URL the browser was on when the event fired. */
  context?: string;
}

interface Connection {
  browser: Browser;
  page: Page;
  cdp: CDPSession | null;
}

/** Warm-instance connection cache — a pure optimisation. Correctness never
 * depends on a hit; a cold instance just reconnects. */
const store = globalThis as unknown as {
  __captureConns?: Map<string, Connection>;
};
const conns = (store.__captureConns ??= new Map<string, Connection>());

async function connect(sessionId: string): Promise<Connection> {
  const cached = conns.get(sessionId);
  if (cached) {
    try {
      // Cheap liveness probe — a dead CDP connection throws immediately.
      cached.page.url();
      if (cached.browser.isConnected()) return cached;
    } catch {
      // Fall through to reconnect.
    }
    conns.delete(sessionId);
    await cached.browser.close().catch(() => {});
  }
  const connectUrl = await getConnectUrl(sessionId);
  const browser = await chromium.connectOverCDP(connectUrl);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = context.pages()[0] ?? (await context.newPage());
  const cdp = await context.newCDPSession(page).catch(() => null);
  const conn: Connection = { browser, page, cdp };
  conns.set(sessionId, conn);
  return conn;
}

async function disconnect(sessionId: string): Promise<void> {
  const conn = conns.get(sessionId);
  if (!conn) return;
  conns.delete(sessionId);
  await conn.browser.close().catch(() => {});
}

/** Raw CDP screenshot — doesn't wait for page stability, safe on any state. */
async function takeShotBase64(conn: Connection): Promise<string | null> {
  if (!conn.cdp) return null;
  try {
    const { data } = (await conn.cdp.send("Page.captureScreenshot", {
      format: "jpeg",
      quality: 60,
    })) as { data: string };
    return data;
  } catch {
    return null;
  }
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
  const { id, connectUrl } = await createSession(
    viewport,
    contextId,
    proxyCountry,
    /* keepAlive */ true
  );
  const browser = await chromium.connectOverCDP(connectUrl);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = context.pages()[0] ?? (await context.newPage());
  const cdp = await context.newCDPSession(page).catch(() => null);
  conns.set(id, { browser, page, cdp });

  const liveViewUrl = await getLiveViewUrl(id);

  // Get the navigation underway before responding. Don't fail the session
  // on a slow site — the user watches it load in the live view.
  await page
    .goto(url, { waitUntil: "domcontentloaded", timeout: 25000 })
    .catch(() => {});
  await preparePageAfterNavigation(page);

  return { sessionId: id, liveViewUrl };
}

export interface TickResult {
  /** Where the remote browser is right now. */
  url: string;
  /** Monetary values currently visible (client sends them back next tick). */
  balances: string[];
  /** Money / reward events detected on this tick. */
  events: Omit<RecorderEvent, "at">[];
  /** Persisted screenshot, when one was requested or a navigation landed. */
  shot: { url: string; storedUrl: string } | null;
}

/**
 * One observation pass over a running capture session: current URL, money
 * deltas vs the balances the client last saw, and optionally a persisted
 * screenshot. Stateless — everything needed comes in, everything learned
 * goes out.
 */
export async function captureTick(
  sessionId: string,
  prevBalances: string[],
  lastUrl: string,
  wantShot: boolean
): Promise<TickResult> {
  const conn = await connect(sessionId);
  const url = conn.page.url();

  let balances: string[] = prevBalances;
  const events: Omit<RecorderEvent, "at">[] = [];
  try {
    const text = await conn.page.evaluate(
      () => document.body?.innerText ?? ""
    );
    const found = Array.from(
      new Set(text.match(MONEY_RE)?.map((s) => s.trim()) ?? [])
    ).slice(0, 12);
    const prev = new Set(prevBalances);
    const added = found.filter((v) => !prev.has(v));
    if (prevBalances.length > 0 && added.length > 0) {
      const { kind, label } = classifyMoneyChange(url);
      events.push({ kind, label, detail: added.join(", "), context: url });
    }
    if (found.length > 0) balances = found;
  } catch {
    // Page mid-navigation — skip money detection this tick.
  }

  // Screenshot on navigation or when the client's cadence asks for one.
  let shot: TickResult["shot"] = null;
  if (wantShot || url !== lastUrl) {
    const data = await takeShotBase64(conn);
    if (data) {
      const [storedUrl] = await persistShots([data]);
      shot = { url, storedUrl };
    }
  }

  return { url, balances, events, shot };
}

export async function stopCapture(id: string): Promise<void> {
  await disconnect(id);
  await releaseSession(id);
}

/** Load a persisted shot back as base64 for scoring. Handles both remote
 * (public URL) and local-dev (/api/evidence/name) storage. */
async function readShotBase64(storedUrl: string): Promise<string | null> {
  try {
    if (/^https?:\/\//.test(storedUrl)) {
      const res = await fetch(storedUrl);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer()).toString("base64");
    }
    const name = storedUrl.split("/").pop();
    if (!name) return null;
    return (await readFile(localEvidencePath(name))).toString("base64");
  } catch {
    return null;
  }
}

/**
 * End a session the productive way: group the shots the client accumulated
 * by the journeys the user actually visited, score each with the vision
 * analyst, then tear the remote session down. This is how a recorded
 * session becomes real scores.
 */
export async function finishCapture(
  id: string,
  shotRefs: SessionShotRef[]
): Promise<{ analyses: JourneyAnalysis[] }> {
  // One final shot of wherever the user ended up, then release the browser
  // before the (slow) scoring calls — it costs money while idle.
  try {
    const conn = await connect(id);
    const url = conn.page.url();
    const data = await takeShotBase64(conn);
    if (data) {
      const [storedUrl] = await persistShots([data]);
      shotRefs = [
        ...shotRefs,
        { at: shotRefs[shotRefs.length - 1]?.at ?? 0, url, storedUrl },
      ];
    }
  } catch {
    // Session already gone — score whatever the client collected.
  }
  await stopCapture(id);

  const byJourney = new Map<string, SessionShotRef[]>();
  for (const ref of shotRefs) {
    const journey = classifyUrl(ref.url);
    if (!journey) continue;
    const list = byJourney.get(journey) ?? [];
    list.push(ref);
    byJourney.set(journey, list);
  }

  const analyses: JourneyAnalysis[] = [];
  for (const [journey, refs] of byJourney) {
    const picked = refs.slice(-3);
    const finalUrl = picked[picked.length - 1].url;
    const shots = (
      await Promise.all(picked.map((r) => readShotBase64(r.storedUrl)))
    ).filter((s): s is string => s !== null);
    if (shots.length === 0) continue;
    try {
      const result = await scoreScreenshots(
        journey,
        "",
        finalUrl,
        shots,
        [],
        "session"
      );
      analyses.push({
        ...result,
        area: journey,
        analysedAt: new Date().toISOString(),
        screenshots: picked.map((r) => r.storedUrl),
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
