import { Stagehand } from "@browserbasehq/stagehand";
import { chromium } from "playwright-core";
import {
  createSession,
  proxyConfig,
  releaseSession,
  withSessionRetry,
} from "./browserbase";
import { JOURNEY_HEURISTICS, RETENTION_MECHANICS } from "./constants";
import { persistShots } from "./evidence-storage";
import {
  checkAgentLoggedIn,
  performAgentLogin,
} from "./agent-login";
import {
  dismissSiteCookies,
  dismissSiteCookiesWithAgent,
  preparePageAfterNavigation,
  type CookieDismissPage,
} from "./dismiss-site-cookies";
import { getNavHint, saveNavHint } from "./nav-hints";
import { waitForPageReady } from "./page-ready";
import {
  inboxConfigured,
  waitForVerificationEmail,
} from "./verification-inbox";
import { PLAIN_PROSE_RULE, sanitizeAnalysisProse } from "./prose";
import { expertiseFor } from "./igaming-expertise";
import { knowledgeFor } from "./igaming-knowledge";
import {
  applyRetentionGates,
  fillGatedRetentionNotes,
  type RetentionContext,
} from "./retention-scoring";
import type {
  DetectedFeature,
  DeviceMode,
  LoyaltySnapshot,
  Observation,
  RetentionMechanicNote,
} from "./types";

interface AnalysisResult {
  score: number;
  blocked: boolean;
  blockReason: string | null;
  summary: string;
  heuristics: { name: string; score: number; note: string }[];
  observations: Observation[];
  features: DetectedFeature[];
  /** Loyalty analyses only. */
  retention?: Record<string, number | null>;
  retentionNotes?: RetentionMechanicNote[];
  retentionContext?: RetentionContext;
  retentionType?: string;
  loyaltySnapshot?: LoyaltySnapshot;
}

export interface JourneyAnalysis extends AnalysisResult {
  area: string;
  analysedAt: string;
  screenshots: string[];
  finalUrl: string;
  /** Signup journeys only: true when the agent's registration ended in an
   * authenticated session — the saved context can now walk gated journeys. */
  authenticated?: boolean;
  /** True when this visit was scored while logged in — what the agent
   * actually observed, not what the journey type implies. */
  loggedIn?: boolean;
}

interface PlaybookStep {
  instruction: string;
  /** Required steps that fail end the run as blocked; optional ones are
   * best-effort (e.g. adding a selection to the betslip). */
  required: boolean;
  /** Alternative phrasings tried in order when the first act fails — sites
   * label the same thing differently (odds button vs price vs selection). */
  alternatives?: string[];
  /** URL paths tried directly when every phrasing fails (e.g. /sports).
   * Only useful for section-navigation steps. */
  fallbackPaths?: string[];
  /** Exact nav labels to click via the DOM when Stagehand misses them —
   * house names like "Arcade" in a left sidebar that vision agents skip. */
  navLabels?: string[];
  /** Description of what the destination must show. After the step lands,
   * a vision check confirms it — Tipico's "Games" is the casino while its
   * homepage is the sportsbook, so a successful click is not proof the
   * agent is in the right area. Failing the check moves on to the next
   * phrasing/fallback path instead of capturing the wrong product. */
  verify?: string;
}

/** YES/NO vision check that the current page matches what the step wanted.
 * Extraction failures pass — better a wrong-area screenshot than a false
 * block on a page the model couldn't read. */
async function verifyLandedArea(
  stagehand: Stagehand,
  expected: string
): Promise<boolean> {
  try {
    const result = await stagehand.extract(
      `Answer with exactly YES or NO. Does the current page show ${expected}?`
    );
    return !result.extraction.toUpperCase().includes("NO");
  } catch {
    return true;
  }
}

/** Direct DOM click for a nav/sidebar label Stagehand often misses
 * (Tombola's left-menu "Arcade", icon-only entries with a text sibling).
 * Opens a hamburger/menu first when the label isn't visible yet. */
async function clickNavByLabel(
  page: {
    evaluate: (expr: string) => Promise<unknown>;
    waitForTimeout: (ms: number) => Promise<void>;
  },
  labels: string[]
): Promise<{ ok: boolean; matched?: string }> {
  if (!labels.length) return { ok: false };
  const script = `(() => {
    const labels = ${JSON.stringify(labels.map((l) => l.toLowerCase()))};
    const MENU_RE = /^(menu|open menu|main menu|navigation|nav|more)$/i;

    function visible(el) {
      if (!(el instanceof HTMLElement)) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      const s = getComputedStyle(el);
      return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0.05;
    }
    function textOf(el) {
      return (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "")
        .replace(/\\s+/g, " ").trim().toLowerCase();
    }
    function click(el) {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      el.click();
    }
    function findLabel() {
      const nodes = [
        ...document.querySelectorAll(
          "nav a, nav button, aside a, aside button, [role='navigation'] a, [role='navigation'] button, [role='menuitem'], [class*='menu' i] a, [class*='menu' i] button, [class*='sidebar' i] a, [class*='sidebar' i] button, [class*='drawer' i] a, [class*='drawer' i] button, header a, header button"
        ),
      ];
      for (const el of nodes) {
        if (!visible(el)) continue;
        const t = textOf(el);
        if (!t || t.length > 40) continue;
        for (const label of labels) {
          if (t === label || t.startsWith(label + " ") || t.endsWith(" " + label)) {
            return { el, matched: label };
          }
        }
      }
      return null;
    }

    let hit = findLabel();
    if (!hit) {
      // Open hamburger / menu so a collapsed side nav becomes visible.
      const menuBtns = [
        ...document.querySelectorAll(
          "button, a[role='button'], [role='button'], [aria-label*='menu' i], [class*='hamburger' i], [class*='menu-toggle' i]"
        ),
      ];
      for (const el of menuBtns) {
        if (!visible(el)) continue;
        const t = textOf(el);
        const aria = (el.getAttribute("aria-label") || "").toLowerCase();
        if (MENU_RE.test(t) || /menu|hamburger|nav/.test(aria) || /hamburger|menu-toggle|nav-toggle/.test(el.className)) {
          click(el);
          break;
        }
      }
    }
    return { opened: !hit };
  })()`;

  try {
    const opened = (await page.evaluate(script)) as { opened?: boolean };
    if (opened?.opened) await page.waitForTimeout(1200);

    const clickScript = `(() => {
      const labels = ${JSON.stringify(labels.map((l) => l.toLowerCase()))};
      function visible(el) {
        if (!(el instanceof HTMLElement)) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return false;
        const s = getComputedStyle(el);
        return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0.05;
      }
      function textOf(el) {
        return (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "")
          .replace(/\\s+/g, " ").trim().toLowerCase();
      }
      const nodes = [
        ...document.querySelectorAll(
          "a, button, [role='button'], [role='menuitem'], [role='link']"
        ),
      ];
      for (const el of nodes) {
        if (!visible(el)) continue;
        const t = textOf(el);
        if (!t || t.length > 40) continue;
        for (const label of labels) {
          if (t === label || t.startsWith(label + " ") || t.endsWith(" " + label)) {
            el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
            el.click();
            return { ok: true, matched: label };
          }
        }
      }
      return { ok: false };
    })()`;
    const result = (await page.evaluate(clickScript)) as {
      ok?: boolean;
      matched?: string;
    };
    if (result?.ok) {
      await page.waitForTimeout(2500);
      return { ok: true, matched: result.matched };
    }
  } catch {
    // DOM click is best-effort.
  }
  return { ok: false };
}

/** Navigation the agent performs on its own from the public homepage.
 * Journeys not listed here sit behind a login and need a live session.
 * Must stay in sync with AGENT_JOURNEYS in constants.ts (client-safe). */
const AGENT_PLAYBOOKS: Record<string, PlaybookStep[]> = {
  signup: [
    {
      instruction:
        "click the sign up, join, join now, or register button to open the registration form",
      required: true,
      alternatives: [
        "click the Join, Join Now, Register, Create Account, or Sign Up button in the header or hero",
        "open the site menu (hamburger or account menu) and choose the sign up / join / register entry",
      ],
      fallbackPaths: [
        "/register",
        "/registration",
        "/signup",
        "/sign-up",
        "/join",
      ],
      verify:
        "a registration or sign-up form with visible input fields (email, username, phone, or personal details) or the first step of a join wizard. NOT a login-only form, NOT the homepage hero",
    },
  ],
  casino: [
    {
      instruction:
        "open the LEFT SIDE MENU or hamburger first if needed, then click Arcade — on bingo-first brands the casino lobby is labelled Arcade in the side navigation. Also try Casino, Games, Vegas, Slots, or Live Casino. Do NOT open sports or bingo, and do NOT stay on the homepage",
      required: true,
      alternatives: [
        "click Arcade in the left-hand side menu or drawer — that is the casino games lobby on brands like Tombola",
        "open the site menu (hamburger, left sidebar, or category menu) and choose Arcade, Casino, Games, Vegas, or Slots from it",
        "click the navigation entry that leads to slot games, instant-win games, or live casino tables — try labels like Arcade, Games, Vegas, Casino, Slots, Live Casino, or a games controller / playing-cards icon",
      ],
      fallbackPaths: [
        "/arcade",
        "/games",
        "/casino",
        "/vegas",
        "/slots",
        "/live-casino",
        "/games/arcade",
        "/play/arcade",
      ],
      /** Labels tried via a direct DOM click when Stagehand misses icon/side-nav entries. */
      navLabels: ["Arcade", "Casino", "Games", "Vegas", "Slots", "Live Casino"],
      verify:
        "a DEDICATED casino games lobby page with VISIBLE game tiles — a populated grid or rows of casino/instant-win games (slots, live casino tables, game shows, arcade games). NOT the brand's homepage or hero page; NOT sports matches, odds buttons, or a betslip; NOT an empty or still-loading grid of blank placeholders; NOT a search page without results",
    },
  ],
  bingo: [
    {
      instruction:
        "open the bingo lobby from the main navigation or side menu — brands label it Bingo, Bingo Rooms, Rooms, or Play Bingo, sometimes a bingo-ball icon. Do NOT open slots, casino, or sports sections",
      required: true,
      alternatives: [
        "click the navigation entry that leads to bingo rooms or bingo games — try labels like Bingo, Rooms, 90 Ball, 75 Ball, or a bingo-ball icon",
        "open the site menu (hamburger, left sidebar, or category menu) and choose the bingo section from it",
      ],
      fallbackPaths: ["/bingo", "/rooms", "/bingo-rooms", "/play/bingo"],
      navLabels: ["Bingo", "Bingo Rooms", "Rooms", "Play Bingo", "90 Ball", "75 Ball"],
      verify:
        "a bingo lobby — bingo rooms or games with ticket prices, prize pots, player counts, or countdown timers to the next game. NOT a slots/casino grid, NOT a sportsbook, NOT the brand's homepage hero",
    },
    {
      instruction:
        "open one bingo room or game card so its details are visible — ticket price, prize breakdown, or the pre-game screen (do NOT buy tickets or wager)",
      required: false,
      alternatives: [
        "click a featured or soonest-starting bingo room to see its detail or pre-game view",
      ],
    },
  ],
  sports_betslip: [
    {
      instruction:
        "open the sports betting or sportsbook section from the main navigation (it may be labelled Sports, Sportsbook, Betting, or Live Betting)",
      required: true,
      fallbackPaths: ["/sports", "/sportsbook", "/sport", "/sports-betting"],
      verify:
        "a sportsbook — sports matches or events with numeric betting odds, NOT a casino games grid",
    },
    {
      instruction:
        "click on a featured, live, or upcoming match to open its full market view with all betting markets",
      required: false,
      alternatives: [
        "click on any visible game or event row in the sportsbook to see its betting markets",
      ],
    },
    {
      instruction:
        "click one odds button (the numeric price next to a team or outcome) to add that selection to the betslip",
      required: false,
      alternatives: [
        "add any selection to the betslip by clicking the price/odds of a visible outcome, e.g. a moneyline or match-winner price",
        "click any clickable odds value on the page so a bet selection is created",
      ],
    },
    {
      instruction:
        "open or expand the betslip so the added selection and its stake input are fully visible (it may be a Betslip button, a slip icon with a badge, or a side panel)",
      required: false,
      alternatives: [
        "make the betslip panel visible showing the pending selection and stake box",
      ],
    },
    {
      instruction:
        "type a small stake like 10 into the betslip stake input so the potential returns are calculated and visible (do NOT place or confirm the bet)",
      required: false,
    },
  ],
  loyalty_rewards: [
    {
      instruction:
        "find and open the loyalty, VIP, rewards, bonus center, or rakeback area — brands label it VIP, VIP Club, Rewards, Loyalty, Rakeback, Bonuses, or Club, sometimes only a crown / gift / trophy / gem icon in the nav; it may be a nav item, a footer link, an icon-only menu entry, or open as a modal. If the brand has NO such area, open its promotions or offers page instead — that IS the brand's retention surface",
      required: true,
      alternatives: [
        "click the crown, gift, trophy, star, or gem icon in the header or navigation — icon-only entries usually lead to the VIP or rewards hub",
        "open the site menu (hamburger or account menu) and choose the VIP, Rewards, Loyalty, or Bonuses entry from it",
        "scroll to the footer and click the VIP, Loyalty, Rewards, or Rakeback link",
        "open the Promotions, Offers, or Bonuses page — when a brand has no VIP or loyalty programme, its promotions page is what a player sees as ongoing value",
      ],
      fallbackPaths: [
        "/vip",
        "/rewards",
        "/loyalty",
        "/vip-rewards",
        "/rakeback",
        "/vip-club",
        "/club",
        "/promotions",
        "/promos",
        "/offers",
        "/bonuses",
      ],
      verify:
        "a loyalty, VIP, rewards, rakeback, or members' club page (tier levels, points, perks, cashback rates, or reward mechanics — a branded club or player-rewards programme page counts), OR a promotions/offers/bonuses page showing the brand's current offers when no dedicated loyalty area exists. NOT a casino lobby, sportsbook, or error page",
    },
    {
      instruction:
        "click the tab or link that shows the tier levels and their benefits (such as 'Levels', 'Tiers', 'All Levels', or 'Benefits') so every level's perks are visible",
      required: false,
      alternatives: [
        "expand or scroll the tier/level table so the perks at each VIP level are readable",
      ],
    },
    {
      instruction:
        "open the promotions or bonuses page to see the current welcome offer for a first-time depositor",
      required: false,
      fallbackPaths: ["/promotions", "/promos", "/offers", "/bonuses"],
    },
    {
      instruction:
        "open the help centre or FAQ article that explains the loyalty or VIP program — search for 'VIP', 'loyalty', or 'rakeback' in the help centre if there is a search box",
      required: false,
      fallbackPaths: ["/help", "/faq", "/support"],
    },
  ],
  support: [
    {
      instruction:
        "open the help centre, support page, or live chat — often a footer link or a floating chat button",
      required: true,
    },
  ],
};

/** Wall-clock budget for one agent walk. Vercel kills the whole function
 * at maxDuration (300s on Hobby) and every screenshot captured dies with
 * it — the walk must stop itself early, score what it has, and return
 * inside the limit. The gap after the budget covers scoring + persisting. */
const RUN_BUDGET_MS = 185_000;

/** The most wall-clock time a pre-walk login attempt may take — public
 * journeys must fall back to a logged-out walk quickly instead of burning
 * the whole budget on authentication. */
const LOGIN_BUDGET_MS = 100_000;

/** Journeys where we scroll the full page — lobby footers hide live feeds,
 * jackpots, leaderboards and provider rows below the fold. */
const DEEP_SCROLL_JOURNEYS = new Set([
  "landing",
  "casino",
  "bingo",
  "sports_betslip",
]);

/** Product areas where "the agent couldn't find it" is a scorable CX
 * finding — a player can't tell the product exists — rather than a dead
 * run. Signup and login-gated journeys stay hard-blocked: without the
 * form or session there is nothing to score. */
const DISCOVERY_SCORED_JOURNEYS = new Set([
  "casino",
  "bingo",
  "sports_betslip",
  "loyalty_rewards",
  "support",
]);

/** Prompt addendum when navigation to the area failed everywhere. */
function discoveryFailurePrompt(journey: string): string {
  return `\n\nCRITICAL CONTEXT — DISCOVERABILITY FAILURE: an autonomous agent tried to reach the ${journey} area from the homepage using the navigation, menus, and well-known URL paths, and could NOT find it. The screenshots show the site as a lost player would see it. Score exactly that reality: it is not clear this product exists or how to reach it, which is one of the most damaging CX failures an operator can have. Give the discovery/navigation-related heuristics very low scores, and in the summary state plainly that a player cannot find this product from the landing page and next steps are unclear. In observations, name what IS visible instead and where the product may be hidden (obscure menu entries, unlabelled icons). Do NOT set blocked — the capture worked; the product's discoverability is what failed.`;
}

const FEATURE_PROMPT = `\n\nFEATURE DETECTION: Scan ALL screenshots — including scrolled sections at the bottom of the page — for product features. Casino lobbies often hide live win feeds, jackpot rows, leaderboards, provider carousels and recently-played rows below the fold; loyalty hubs show tier grids and reward calendars. Return a "features" array for every feature with visible evidence. Use standard names when possible: "Live wins feed", "Leaderboards", "Jackpot games", "VIP levels", "Rakeback", "Weekly bonus", "Status transfer", "Originals", "Provider filters", "Casino search", "Live casino", "Bet builder", "Cashout", "Live chat", "Crypto payments", "Provably fair", "Free spins", "Missions / streaks", etc. Category: Acquisition | Casino | Sports | Loyalty / Rewards | Payments | Support | My Account. Status: strong (best-in-class), yes (clearly present), medium, partial (weak execution), weak, hidden (VISIBLE in a screenshot but buried in obscure navigation — never use hidden for something you cannot see). Include note (one-line evidence) and shot (screenshot index — REQUIRED for every feature; if you cannot point at a screenshot showing it, do not list it). Only list features you can SEE — omit absent ones; a feature you cannot see is simply not listed, never marked hidden or no.`;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Interstitial fingerprints: loading splashes, geo walls and bot
 * challenges are wordy enough to pass a character count, so they must be
 * recognised by content. Only trusted on short pages — real product pages
 * bury phrases like "not available in your region" in fine print. */
const INTERSTITIAL_RE =
  /is loading the page|please click refresh|not available in your (region|country)|restricted in your (region|country|jurisdiction)|access denied|attention required|checking your browser|verify you are human|pardon our interruption/i;

function looksLikeInterstitial(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length < 2500 && INTERSTITIAL_RE.test(trimmed);
}

/** Detect geo-restriction walls from the final URL — stake.com from a
 * Mexico IP lands on `modal=restrictedRegion`, for example — or from the
 * rendered page text, for sites that block without changing the URL
 * (Mybookie shows a "not available in your region yet" splash on the
 * same address). */
function geoBlockReason(finalUrl: string, pageText = ""): string | null {
  if (/restrictedRegion|regionKey=|not.?available.?in.?your/i.test(finalUrl)) {
    return "This brand geo-blocked the agent at the main domain for this market. The site detected the proxy location and showed a restricted-region wall instead of the product.";
  }
  const text = pageText.trim();
  if (
    text.length < 2500 &&
    /not available in your (region|country)|restricted in your (region|country|jurisdiction)/i.test(
      text
    )
  ) {
    return "This brand geo-blocked the agent for this market. The page never loaded past a 'not available in your region' wall, so there was no real product to score.";
  }
  if (looksLikeInterstitial(text)) {
    return "The page never finished loading. The agent only ever saw the site's loading/challenge interstitial, so there was no real product to score.";
  }
  return null;
}

/** First clause of a playbook step, for user-facing block messages. */
function instructionSummary(instruction: string): string {
  const first = instruction.split(/[.,]/)[0]?.trim();
  return first || instruction.slice(0, 80);
}

/** Poll until a heavy SPA has rendered real content — not just a splash
 * screen, blank shell or wordy loading interstitial. */
async function waitForPageContent(page: CookieDismissPage): Promise<void> {
  await waitForPageReady(page, { minChars: 400, initialMs: 2000 });
}

function createScreenshotCapture(
  page: CookieDismissPage & {
    sendCDP: <T>(method: string, params?: object) => Promise<T>;
  },
  opts?: { relaxed?: boolean; stagehand?: Stagehand }
): () => Promise<string> {
  return async () => {
    // Cookie banners reappear after navigation or late CMP paint — never
    // capture evidence with "Accept cookies" covering the product.
    await dismissSiteCookies(page, { retries: 2 });
    await waitForPageReady(page, {
      relaxed: opts?.relaxed ?? true,
      initialMs: opts?.relaxed ? 900 : 2000,
    });
    const { data } = await page.sendCDP<{ data: string }>(
      "Page.captureScreenshot",
      { format: "jpeg", quality: 60 }
    );
    return data;
  };
}

/** Body text at scoring time — feeds the text-based geo/interstitial check. */
async function readBodyText(page: {
  evaluate: (expr: string) => Promise<unknown>;
}): Promise<string> {
  return String(
    await page.evaluate("document.body?.innerText ?? ''").catch(() => "")
  );
}

interface ScrollCapture {
  capture: () => Promise<string>;
  scrollTo: (y: number) => Promise<void>;
  getHeight: () => Promise<number>;
}

/** Capture top + incremental scroll positions through to the page bottom. */
async function captureScrollSequence(
  sc: ScrollCapture,
  maxShots = 6,
  viewport = 900
): Promise<string[]> {
  const shots: string[] = [];
  await sc.scrollTo(0);
  await sleep(2000);
  shots.push(await sc.capture());

  const height = await sc.getHeight();
  if (height <= viewport * 1.15) return shots;

  const step = Math.max(viewport, Math.floor((height - viewport) / (maxShots - 2)));
  const positions: number[] = [];
  for (let y = step; y < height - viewport; y += step) {
    positions.push(y);
  }
  positions.push(Math.max(0, height - viewport));

  for (const y of positions) {
    if (shots.length >= maxShots) break;
    await sc.scrollTo(y);
    await sleep(2000);
    shots.push(await sc.capture());
  }

  return shots.slice(0, maxShots);
}

/** ~80% of real players are on phones, so every journey also gets a
 * mobile-viewport pass. iPhone 14/15-class dimensions. */
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

/** Scoring note for reports captured only at the phone viewport. */
const MOBILE_ONLY_PROMPT = `\n\nDEVICE — every screenshot is a MOBILE capture (390x844 phone viewport); there are no desktop frames. Roughly 80% of real players are on phones, so judge the mobile experience directly: thumb-reachable CTAs, clean nav collapse, readable type at phone size, no overlapping or cut-off elements, product reachable without hunting through menus.`;

/** Re-capture the final page at a phone viewport via CDP device emulation.
 * Runs in the same session (same login state, no extra Browserbase cost)
 * and always restores the desktop viewport afterwards. Failing here must
 * never sink an otherwise successful walk — worst case we score desktop
 * only, like before. */
async function captureMobileShots(
  page: CookieDismissPage & {
    sendCDP: <T>(method: string, params?: object) => Promise<T>;
  },
  capture: () => Promise<string>
): Promise<string[]> {
  try {
    await page.sendCDP("Emulation.setDeviceMetricsOverride", {
      width: MOBILE_VIEWPORT.width,
      height: MOBILE_VIEWPORT.height,
      deviceScaleFactor: 2,
      mobile: true,
    });
    // Give responsive layouts a moment to reflow at the new width.
    await sleep(2500);
    return await captureScrollSequence(
      {
        capture,
        scrollTo: async (y) => {
          await page.evaluate(`window.scrollTo(0, ${y})`);
        },
        getHeight: async () =>
          Number(await page.evaluate("document.documentElement.scrollHeight")),
      },
      4,
      MOBILE_VIEWPORT.height
    );
  } catch (e) {
    console.error(
      "[analyst] mobile capture failed, continuing desktop-only:",
      e instanceof Error ? e.message : e
    );
    return [];
  } finally {
    await page
      .sendCDP("Emulation.clearDeviceMetricsOverride", {})
      .catch(() => {});
  }
}

/** Evenly-sampled original indices when we captured more frames than the
 * vision model needs. The model sees the sampled frames in order, so its
 * shot indices must be mapped back through this list. */
function pickShotIndices(count: number, max = 8): number[] {
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const indices: number[] = [];
  for (let i = 0; i < max; i++) {
    indices.push(Math.round((i / (max - 1)) * (count - 1)));
  }
  return indices;
}

/** Evenly sample when we captured more frames than the vision model needs. */
function pickShots(shots: string[], max = 8): string[] {
  return pickShotIndices(shots.length, max).map((i) => shots[i]!);
}

/** Map a model-returned shot index (relative to the sampled frames) back to
 * the index in the full persisted screenshot list. */
function remapShot(
  shot: number | null | undefined,
  indices: number[]
): number | null {
  if (shot == null) return null;
  return indices[shot] ?? indices[indices.length - 1] ?? null;
}

/** The displayed score is always derived from heuristics — never an
 * independent LLM guess that can drift 10+ points between identical visits. */
function overallFromHeuristics(
  heuristics: { score: number }[]
): number | null {
  if (!heuristics.length) return null;
  const avg =
    heuristics.reduce((sum, h) => sum + h.score, 0) / heuristics.length;
  return Math.round(Math.max(0, Math.min(100, avg)));
}

const JOURNEY_GUIDANCE: Record<string, string> = {
  landing:
    "This is the brand's landing/home experience. Judge first impressions: value proposition clarity, trust signals (licence, responsible gambling), CTA prominence, visual hierarchy, perceived speed — and above all, focus.",
  signup:
    "This is the registration flow. If the agent's trail shows it filled and submitted the form with a test persona, judge the WHOLE flow it walked: number of steps and fields, progressive disclosure, inline validation quality, error recovery, social/fast sign-up options, verification friction (email/SMS walls), and what the post-submit state communicates. If the trail only shows the opened form, judge visible friction: field count, clarity of requirements, trust cues near the form.",
  deposit:
    "This is the deposit flow. Judge trust and speed: payment method breadth, fee/limit transparency, expected crediting times, security cues, number of steps to complete.",
  withdraw:
    "This is the withdrawal flow. Judge trust: KYC clarity, processing time promises, fee transparency, status tracking, friction relative to depositing.",
  casino:
    "This is the casino lobby. Judge discovery: search quality, category clarity, game tile information, load speed, personalisation.",
  bingo:
    "This is the bingo lobby. Judge how fast a player gets into a game they can afford: room/schedule clarity (start times, countdowns), ticket prices and prize pots visible before committing, community signals (player counts, chat, winner callouts), and whether cross-sell to slots/casino supports or drowns the bingo experience.",
  sports_betslip:
    "This is the sportsbook/betslip experience, captured while the agent walked a real betting flow: sportsbook → match view → adding a selection → the betslip with a stake entered. Judge usability across that flow: market depth visibility (how many markets per match and how discoverable), odds presentation, how clearly the slip shows the selection, stake input and potential returns, single/multi/bet-builder access, and cash-out cues. If the agent's trail shows a selection was added, score the betslip UX from the screenshots that show it; if no selection could be added, judge what that friction says about the product and note it.",
  loyalty_rewards:
    "This is the loyalty/VIP/rewards area, walked across the rewards hub, tier pages, promotions page, and help centre articles. The review must answer two concrete player questions above all: (1) What does a FIRST-TIME DEPOSITOR actually get — welcome bonus, free spins, cashback, and on what terms? (2) What does each loyalty level actually offer — daily spins, rakeback %, weekly/monthly bonuses, VIP host, withdrawal perks? Extract the real numbers and perk names you can read in the screenshots (including help centre text). Then judge the craft: is this value easy to find and understand, does the next reward feel near, are earning rules documented? Compare mentally against Stake's VIP club — the category benchmark. IMPORTANT: if the brand has NO dedicated VIP/loyalty programme and the screenshots show its promotions or offers page instead, that is NOT a capture failure — do not set blocked. Score what the brand actually offers: classify it as promo-led, answer question (1) from the visible offers, and score the retention-loop heuristics low to reflect the missing ongoing-value layer.",
  support:
    "This is the support experience. Judge access: live chat availability, response time promises, help content quality for money issues, contact channel breadth.",
  my_account:
    "This is the account area. Judge control: balance and bonus visibility, verification status clarity, limit and safer-gambling tools, transaction history quality.",
};

const REGION_SCHEMA = {
  type: ["object", "null"],
  additionalProperties: false,
  properties: {
    x: { type: "number", minimum: 0, maximum: 100 },
    y: { type: "number", minimum: 0, maximum: 100 },
    w: { type: "number", minimum: 0, maximum: 100 },
    h: { type: "number", minimum: 0, maximum: 100 },
  },
  required: ["x", "y", "w", "h"],
} as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    blocked: { type: "boolean" },
    blockReason: { type: ["string", "null"] },
    summary: { type: "string" },
    heuristics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          score: { type: "integer", minimum: 0, maximum: 100 },
          note: { type: "string" },
        },
        required: ["name", "score", "note"],
      },
    },
    observations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
          shot: { type: ["integer", "null"], minimum: 0 },
          region: REGION_SCHEMA,
        },
        required: ["text", "shot", "region"],
      },
    },
    features: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          category: { type: "string" },
          status: {
            type: "string",
            enum: ["strong", "medium", "weak", "partial", "yes", "hidden"],
          },
          note: { type: "string" },
          shot: { type: ["integer", "null"], minimum: 0 },
        },
        required: ["name", "category", "status", "note", "shot"],
      },
    },
  },
  required: [
    "score",
    "blocked",
    "blockReason",
    "summary",
    "heuristics",
    "observations",
    "features",
  ],
} as const;

/** Loyalty analyses additionally score the eight canonical retention
 * mechanics (null = not observable from this visit) plus an archetype. */
const RETENTION_SCHEMA = {
  ...SCHEMA,
  properties: {
    ...SCHEMA.properties,
    retention: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        RETENTION_MECHANICS.map((m) => [
          m.key,
          { type: ["integer", "null"], minimum: 0, maximum: 100 },
        ])
      ),
      required: RETENTION_MECHANICS.map((m) => m.key),
    },
    retentionType: { type: "string" },
    retentionContext: {
      type: "object",
      additionalProperties: false,
      properties: {
        loggedIn: { type: "boolean" },
        fromSession: { type: "boolean" },
      },
      required: ["loggedIn", "fromSession"],
    },
    retentionNotes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: {
            type: "string",
            enum: RETENTION_MECHANICS.map((m) => m.key),
          },
          note: { type: "string" },
          shot: { type: ["integer", "null"], minimum: 0 },
          improve: { type: "string" },
        },
        required: ["key", "note", "shot", "improve"],
      },
    },
    loyaltySnapshot: {
      type: "object",
      additionalProperties: false,
      properties: {
        ftdOffer: { type: ["string", "null"] },
        tiers: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              perks: { type: "string" },
            },
            required: ["name", "perks"],
          },
        },
        cadence: { type: ["string", "null"] },
      },
      required: ["ftdOffer", "tiers", "cadence"],
    },
  },
  required: [
    ...SCHEMA.required,
    "retention",
    "retentionType",
    "retentionContext",
    "retentionNotes",
    "loyaltySnapshot",
  ],
};

const RETENTION_PROMPT = `\n\nAdditionally score the eight retention loop mechanics. CRITICAL EVIDENCE RULES — use null, never guess:
- If screenshots show Sign Up / Login CTAs and no player avatar, balance, or account menu, the visit is LOGGED OUT. When logged out you MUST return null for: progress_mechanics, personalisation, account_integration, frequency_loop. Do not score these from marketing copy or generic tier pages.
- progress_mechanics: ONLY score when logged in — personal progress bars, current tier/level, points to next tier, milestone unlocks. Many brands (e.g. BetOnline) show tier marketing logged out but hide the real progress meter until login. Never recommend "add a progress meter" from a logged-out visit — return null instead.
- personalisation: ONLY score when logged in — tailored offers, VIP host, "for you" reloads. Null when logged out.
- frequency_loop: ONLY score when you can see actual reward cadence behaviour OR the user session spans multiple claim moments. A one-shot agent visit cannot prove weekly/monthly/daily loops — return null unless a live session recording shows claims over time.
- account_integration: requires login to see whether rewards connect to account/cashier/play.

Mechanics (0-100 or null):
- reward_visibility: rewards surfaced in nav/header/product vs buried (logged out OK)
- reward_clarity: player understands WHAT they can earn from this visit (logged out OK)
- progress_mechanics: null unless logged in — current tier, progress meter, personal milestones
- frequency_loop: proven reward cadence — null on single logged-out agent visit
- value_back: rakeback/rebate/lossback described (logged out OK)
- personalisation: null unless logged in
- emotional_pull: aspiration, locked tiers, celebration — can be logged out if visible in marketing/tier pages
- account_integration: null unless logged in

Set retentionContext.loggedIn true only if screenshots clearly show an authenticated session. Set retentionContext.fromSession true only when scoring a recorded user session (the caller sets this — default false for agent).

For every mechanic with a non-null score, add a retentionNotes entry with:
- key: the mechanic key
- note: one sentence citing the specific UI element(s) you see in the screenshots — this is the evidence for the score
- shot: screenshot index showing that evidence
- improve: one actionable sentence for the product team — what would lift this score toward Stake/Winna class. ONLY write improve for mechanics you actually scored — never recommend adding features that may already exist behind login.

For null mechanics, omit from retentionNotes unless explaining missing evidence (login / tracked play). Do not give product improvement advice for mechanics scored null due to missing login.

Set retentionType to ONE of: "Crypto loop-led" | "Loyalty-led (weaker loop)" | "Hybrid — promo + loyalty" | "Promo page only (no loop)" — plus a 3-5 word tag (e.g. "Loyalty-led — VIP points, thin cadence"). BetOnline-class regulated books usually belong in Loyalty-led or Hybrid, NOT Promo page only. This answers "how deep is the retention loop vs Stake-class?" not "does loyalty exist at all?"

Also fill loyaltySnapshot — the plain-language answer a player wants, READ from the screenshots (promo pages, tier tables, help centre articles), never invented:
- ftdOffer: exactly what a first-time depositor gets, with the real numbers you can read ("100% up to $1,000 + 50 free spins, 10x rollover"). null if no welcome offer is visible.
- tiers: one entry per documented loyalty level, name + its concrete perks ("Gold — 10% rakeback, weekly bonus, birthday bonus"). Empty array if no tier structure is documented.
- cadence: the recurring reward rhythm documented on the site ("daily spins for VIPs, weekly cashback Mondays, monthly reload"). null if nothing recurring is documented.`;

export async function scoreScreenshots(
  journey: string,
  pageTitle: string,
  finalUrl: string,
  screenshots: string[],
  trail: string[] = [],
  source: "agent" | "session" = "agent",
  mobileFrom: number | null = null,
  extraPrompt = ""
): Promise<AnalysisResult> {
  const guidance = JOURNEY_GUIDANCE[journey] ?? JOURNEY_GUIDANCE.landing;
  const hasMobile =
    mobileFrom != null && mobileFrom > 0 && mobileFrom < screenshots.length;

  // Sample desktop and mobile frames separately so the phone pass is always
  // represented — even sampling over the combined list could drop it.
  const desktopIndices = pickShotIndices(
    hasMobile ? mobileFrom : screenshots.length,
    hasMobile ? 5 : 8
  );
  const mobileIndices = hasMobile
    ? pickShotIndices(screenshots.length - mobileFrom, 3).map(
        (i) => i + mobileFrom
      )
    : [];
  const shotIndices = [...desktopIndices, ...mobileIndices];
  const visionShots = shotIndices.map((i) => screenshots[i]!);

  const sourceNote =
    source === "session"
      ? "The screenshots were captured at different moments of a REAL RECORDED USER SESSION, in chronological order — they are not a top/scrolled pair of one page. Judge the experience the user actually moved through."
      : screenshots.length > 2
        ? "The screenshots follow the agent's navigation and scroll in chronological order — each step and scroll position produced one screenshot. Judge everything revealed across ALL of them, especially content at the bottom of long lobby pages."
        : "Screenshot 0 = top of page, screenshot 1 = scrolled down.";
  const mobileNote = hasMobile
    ? `\n\nDEVICE SPLIT — the images come in two groups. Images 0-${desktopIndices.length - 1} are DESKTOP captures (1440x900). Images ${desktopIndices.length}-${shotIndices.length - 1} are MOBILE captures (390x844 phone viewport) of the same journey, top to bottom. Roughly 80% of real players use this product on a phone, so judge MOBILE-FIRST: weight every heuristic about 70% on the mobile experience and 30% on desktop. A cramped or broken mobile layout, unreachable navigation, overlapping elements, or CTAs pushed out of reach must pull that heuristic down hard — desktop polish cannot rescue a poor mobile experience. Equally, credit genuinely great mobile execution (thumb-reachable bet slip, sticky deposit CTA, clean collapse of the desktop nav). Call out mobile-specific findings explicitly in observations and point their shot index at the mobile image that shows it.`
    : "";
  const prompt = `You are PlayerScope, an elite iGaming CX analyst with deep operator-side experience in crypto casinos and sportsbooks. You are scoring one journey of a casino/sportsbook site from screenshots. ${sourceNote}${mobileNote}

${expertiseFor(journey)}${knowledgeFor(journey)}

Journey: ${journey}. ${guidance}

Page title: "${pageTitle}". Final URL: ${finalUrl}.${
    trail.length
      ? `\n\nAn autonomous agent navigated here from the homepage by: ${trail.join("; then ")}. Factor in how discoverable this area was — if it took obscure steps to find, that itself is a CX finding.`
      : ""
  }

Scoring philosophy — judge DECISION EASE within the vertical's own conventions. A promo-stuffed hero or wall of competing CTAs with no obvious next action lowers the score; but dense game grids, modal hubs, tier locks and reward layering are the category language, not clutter (see the domain brief). Marketing claims ("Trusted by millions") are not trust signals — only verifiable cues (licence numbers, regulator seals, RG links) count.

Score 0-100 calibrated to THIS vertical: 50 = an average licensed operator, 80+ = the Stake/Winna/Rainbet class of execution. If what you see matches how the category leaders do it, the score must reflect that — an analyst who marks the vertical's best practice as a failure has misread the market.

Heuristics: score EXACTLY these, using these exact names (they are compared across brands): ${(JOURNEY_HEURISTICS[journey] ?? JOURNEY_HEURISTICS.landing).map((h) => `"${h}"`).join(", ")}. Each gets a 0-100 score and a one-line note naming the actual UI elements that earned it. Use these anchors: 90+ = best-in-class (Stake/Winna level), 75–89 = strong execution, 60–74 = average licensed operator, 40–59 = below category standard, below 40 = seriously broken. The overall journey score is computed from these heuristic scores — focus on scoring each heuristic accurately and consistently; do not invent a separate overall number.

Summary: MAXIMUM 2 short sentences. Sentence 1 = the verdict — what drives this score, in plain product language. Sentence 2 = the single biggest gap (or standout) versus the category leaders. No hedging, no filler, no restating the score.

Observations: concrete findings a product team could act on. Be specific: name actual UI elements you can see. Critique what genuinely underperforms; equally, identify what is executed at a leader level and say why it works.

For each observation, point at the evidence: set "shot" to the screenshot index (0 or 1) showing the element you're discussing, and "region" to that element's bounding box as PERCENTAGES of the image (x,y = top-left corner, w,h = size, all 0-100). Keep regions tight around the specific element. Use null for shot/region only when the observation is about the page as a whole.

If the screenshots show a bot-verification wall, geo-block, error page, or a loading/splash screen with no real product content, set blocked=true, explain in blockReason, and do NOT score the brand's product from it. A capture problem must never read as a bad product.

${PLAIN_PROSE_RULE}${journey === "loyalty_rewards" ? RETENTION_PROMPT : ""}${FEATURE_PROMPT}${extraPrompt}`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      reasoning: { effort: "low" },
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            ...visionShots.map((b64) => ({
              type: "input_image",
              image_url: `data:image/jpeg;base64,${b64}`,
            })),
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "journey_analysis",
          schema: journey === "loyalty_rewards" ? RETENTION_SCHEMA : SCHEMA,
          strict: true,
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const message = data.output?.find(
    (o: { type: string }) => o.type === "message"
  );
  const text = message?.content?.find(
    (c: { type: string }) => c.type === "output_text"
  )?.text;
  if (!text) throw new Error("OpenAI returned no output text");
  const parsed = JSON.parse(text) as AnalysisResult;
  const ctx: RetentionContext = {
    loggedIn: parsed.retentionContext?.loggedIn ?? false,
    fromSession: source === "session" || (parsed.retentionContext?.fromSession ?? false),
  };
  const retention =
    journey === "loyalty_rewards" && parsed.retention
      ? applyRetentionGates(parsed.retention, ctx)
      : parsed.retention;
  const retentionNotes =
    journey === "loyalty_rewards"
      ? fillGatedRetentionNotes(
          retention,
          ctx,
          parsed.retentionNotes ?? []
        )
      : parsed.retentionNotes;
  const derivedScore = overallFromHeuristics(parsed.heuristics);
  // The model's shot indices point at the sampled frames it was shown —
  // shotIndices (computed above) maps them back to the full persisted list.
  return sanitizeAnalysisProse({
    ...parsed,
    score: derivedScore ?? parsed.score,
    retention,
    retentionNotes: retentionNotes?.map((n) => ({
      ...n,
      shot: remapShot(n.shot, shotIndices),
    })),
    retentionContext: ctx,
    observations: (parsed.observations ?? []).map((o) =>
      typeof o === "string"
        ? o
        : { ...o, shot: remapShot(o.shot, shotIndices) }
    ),
    features: (parsed.features ?? []).map((f) => ({
      ...f,
      shot: remapShot(f.shot, shotIndices),
      source: "extracted" as const,
    })),
  });
}

const FEATURE_ONLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    features: SCHEMA.properties.features,
  },
  required: ["features"],
} as const;

const FEATURE_EXTRACT_PROMPT = `You are PlayerScope's feature detector for iGaming sites. You ONLY list product features you can SEE in the screenshots — never infer from marketing copy alone.

DISAMBIGUATION — critical:
- "Live wins feed" = a casino lobby ticker/table showing recent player wins (username + game + amount). NOT live sports betting, NOT "live bet" markets, NOT live casino dealers.
- "Leaderboards" = an explicit ranking/leaderboard UI (player ranks, points, positions). NOT horse racing, NOT promo "races" or "tournaments" mentioned in banners unless a leaderboard panel is visible.
- "Jackpot games" = a dedicated jackpot section or progressive jackpot UI — not a single banner word.
- "Casino search" = a visible search bar or search UI for games — not generic site navigation.

Use standard names: Live wins feed, Leaderboards, Jackpot games, VIP levels, Rakeback, Weekly bonus, Monthly bonus, Status transfer, Originals, Provider filters, Casino search, Live casino, Bet builder, Cashout, Live chat, Crypto payments, Provably fair, Free spins, Missions / streaks, Help centre, Sportsbook, Welcome offer, Reloads, Lossback, Free bet.

Category: Acquisition | Casino | Sports | Loyalty / Rewards | Payments | Support | My Account.
Status: strong | yes | medium | partial | weak | hidden (hidden = VISIBLE in a screenshot but buried in obscure navigation — never use it for something you cannot see).
Include note (what you see) and shot (screenshot index — REQUIRED; if no screenshot shows the feature, do not list it). Return empty array if nothing is clearly visible.`;

/** Feature-only pass over existing evidence screenshots — used to backfill
 * analyses that were scored before structured feature extraction existed. */
export async function extractFeaturesFromShots(
  journey: string,
  screenshots: string[]
): Promise<DetectedFeature[]> {
  if (screenshots.length === 0) return [];
  const visionShots = pickShots(screenshots, 8);
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      reasoning: { effort: "low" },
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `${FEATURE_EXTRACT_PROMPT}\n\nJourney context: ${journey}. ${visionShots.length} screenshots in order (0 = first).`,
            },
            ...visionShots.map((b64) => ({
              type: "input_image",
              image_url: `data:image/jpeg;base64,${b64}`,
            })),
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "feature_extract",
          schema: FEATURE_ONLY_SCHEMA,
          strict: true,
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const message = data.output?.find(
    (o: { type: string }) => o.type === "message"
  );
  const text = message?.content?.find(
    (c: { type: string }) => c.type === "output_text"
  )?.text;
  if (!text) throw new Error("OpenAI returned no output text");
  const parsed = JSON.parse(text) as { features: DetectedFeature[] };
  const shotIndices = pickShotIndices(screenshots.length, 8);
  return parsed.features.map((f) => ({
    ...f,
    shot: remapShot(f.shot, shotIndices),
    source: "extracted" as const,
    area: journey,
  }));
}

const RETENTION_NOTES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    retentionNotes: RETENTION_SCHEMA.properties.retentionNotes,
    loyaltySnapshot: RETENTION_SCHEMA.properties.loyaltySnapshot,
  },
  required: ["retentionNotes", "loyaltySnapshot"],
} as const;

const RETENTION_NOTES_PROMPT = `You are PlayerScope. Retention scores were already assigned — do NOT change them. Write retentionNotes explaining WHY each score was given, citing specific UI evidence from the screenshots.

For every mechanic with a non-null score in the provided scores object:
- key: mechanic key
- note: one sentence citing the specific UI element(s) visible in the screenshots
- shot: screenshot index (0-based) showing that evidence
- improve: one actionable sentence for the product team — what would lift this toward Stake/Winna class

Do not invent scores. Only write notes for mechanics listed with a number. Omit mechanics that are null.
If loggedIn is false, do NOT write notes or improvement advice for progress_mechanics, personalisation, or account_integration — those require login. Never suggest adding progress meters or tier UI that may already exist behind login.

Also fill loyaltySnapshot — the plain-language answer a player wants, READ from the screenshots (promo pages, tier tables, help centre articles), never invented:
- ftdOffer: exactly what a first-time depositor gets, with the real numbers you can read ("100% up to $1,000 + 50 free spins, 10x rollover"). null if no welcome offer is visible.
- tiers: one entry per documented loyalty level, name + its concrete perks ("Gold — 10% rakeback, weekly bonus, birthday bonus"). Empty array if no tier structure is documented.
- cadence: the recurring reward rhythm documented on the site ("daily spins for VIPs, weekly cashback Mondays, monthly reload"). null if nothing recurring is documented.`;

export interface RetentionNotesExtract {
  retentionNotes: RetentionMechanicNote[];
  loyaltySnapshot: LoyaltySnapshot | null;
}

/** Backfill per-mechanic evidence notes and the plain-language loyalty
 * snapshot from existing loyalty screenshots. */
export async function extractRetentionNotesFromShots(
  retention: Record<string, number | null>,
  ctx: RetentionContext,
  screenshots: string[]
): Promise<RetentionNotesExtract> {
  if (screenshots.length === 0) {
    return { retentionNotes: [], loyaltySnapshot: null };
  }
  const gated = applyRetentionGates(retention, ctx) ?? retention;

  const visionShots = pickShots(screenshots, 8);
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      reasoning: { effort: "low" },
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `${RETENTION_NOTES_PROMPT}\n\nScores (do not change): ${JSON.stringify(gated)}\nLogged in: ${ctx.loggedIn}. From tracked session: ${ctx.fromSession}.\n${visionShots.length} screenshots in order (0 = first).`,
            },
            ...visionShots.map((b64) => ({
              type: "input_image",
              image_url: `data:image/jpeg;base64,${b64}`,
            })),
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "retention_notes",
          schema: RETENTION_NOTES_SCHEMA,
          strict: true,
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const message = data.output?.find(
    (o: { type: string }) => o.type === "message"
  );
  const text = message?.content?.find(
    (c: { type: string }) => c.type === "output_text"
  )?.text;
  if (!text) throw new Error("OpenAI returned no output text");
  const parsed = JSON.parse(text) as {
    retentionNotes: RetentionMechanicNote[];
    loyaltySnapshot: LoyaltySnapshot | null;
  };
  const snapshot = parsed.loyaltySnapshot;
  const shotIndices = pickShotIndices(screenshots.length, 8);
  return {
    retentionNotes: fillGatedRetentionNotes(
      gated,
      ctx,
      (parsed.retentionNotes ?? []).map((n) => ({
        ...n,
        shot: remapShot(n.shot, shotIndices),
      }))
    ),
    loyaltySnapshot:
      snapshot && (snapshot.ftdOffer || snapshot.tiers.length || snapshot.cadence)
        ? snapshot
        : null,
  };
}

/** Journeys that only make sense with an authenticated session. They run
 * when the brand has a logged-in Browserbase context; otherwise the caller
 * gets a clear "log in first" error. */
const LOGIN_PLAYBOOKS: Record<string, PlaybookStep[]> = {
  deposit: [
    {
      instruction:
        "open the deposit or cashier screen — usually a Deposit, Wallet, Cashier, or Buy Crypto button in the header for logged-in players",
      required: true,
      alternatives: [
        "open the account or wallet menu and choose Deposit or Cashier from it",
      ],
      verify:
        "a deposit or cashier screen — payment methods, amount input, or crypto addresses for adding funds",
    },
  ],
  withdraw: [
    {
      instruction:
        "open the withdrawal screen — usually inside the cashier or wallet area, labelled Withdraw, Cash Out, or Payout",
      required: true,
      alternatives: [
        "open the cashier or wallet, then switch to the Withdraw / Cash Out tab",
      ],
      verify:
        "a withdrawal screen — payout methods, amount input, or withdrawal address fields",
    },
  ],
  my_account: [
    {
      instruction:
        "open the account, profile, or settings area from the user avatar or account menu in the header",
      required: true,
      verify:
        "an account, profile, or settings area for a logged-in player — personal details, verification status, limits, or preferences",
    },
  ],
};

/** Analyse a journey. Landing pages are a straight visit; deeper public
 * journeys are navigated autonomously by the Stagehand agent. Login-gated
 * journeys run when the brand has a logged-in browser context. Signup can
 * chain deposit/account journeys in the same session once authenticated. */
export async function analyzeJourney(
  url: string,
  journey: string,
  contextId?: string | null,
  proxyCountry?: string | null,
  opts?: {
    signupVars?: Record<string, string> | null;
    chainLoginJourneys?: string[];
    loginVars?: Record<string, string> | null;
    /** A previous run confirmed an authenticated session — an account
     * exists, so login is the first port of call everywhere. */
    accountExists?: boolean;
    /** Which viewport(s) to walk and capture. "both" = desktop walk plus
     * a phone re-capture pass (slowest). */
    device?: DeviceMode;
  }
): Promise<JourneyAnalysis & { chainedAnalyses?: JourneyAnalysis[] }> {
  const signupVars = opts?.signupVars ?? null;
  const chainLoginJourneys = opts?.chainLoginJourneys;
  const loginVars = opts?.loginVars ?? null;
  const accountExists = opts?.accountExists ?? false;
  const device = opts?.device ?? "both";
  const playbook = AGENT_PLAYBOOKS[journey];
  if (playbook) {
    return analyzeWithAgent(
      url,
      journey,
      playbook,
      contextId,
      proxyCountry,
      journey === "signup" ? signupVars : null,
      journey === "signup" ? chainLoginJourneys : undefined,
      loginVars,
      accountExists,
      device
    );
  }
  const loginPlaybook = LOGIN_PLAYBOOKS[journey];
  if (loginPlaybook) {
    if (!contextId && !loginVars) {
      throw new Error(
        `${journey} sits behind a login. Run the Sign Up journey first so the agent registers a test account, or record a live session.`
      );
    }
    return analyzeWithAgent(
      url,
      journey,
      loginPlaybook,
      contextId,
      proxyCountry,
      null,
      undefined,
      loginVars,
      accountExists,
      device
    );
  }
  if (journey !== "landing") {
    throw new Error(
      `${journey} sits behind a login. Record a live session to score it.`
    );
  }
  return analyzeLanding(url, contextId, proxyCountry, device);
}

/** @deprecated Use checkAgentLoggedIn from agent-login.ts */
async function agentIsLoggedIn(stagehand: Stagehand): Promise<boolean> {
  return checkAgentLoggedIn(stagehand);
}

/** After a signup or login hits a "verify your email" wall, read the
 * shared test inbox, then enter the OTP or open the confirmation link in
 * the same browser session. Returns true when a verification action was
 * performed — the caller re-checks the login state afterwards. */
async function completeEmailVerification(
  stagehand: Stagehand,
  page: {
    waitForTimeout: (ms: number) => Promise<void>;
    goto?: (
      url: string,
      opts?: { waitUntil?: "domcontentloaded"; timeoutMs?: number }
    ) => Promise<unknown>;
  },
  email: string,
  siteUrl: string,
  since: Date,
  trail: string[],
  shots: string[],
  capture: () => Promise<string>,
  timeoutMs = 75_000
): Promise<boolean> {
  if (!inboxConfigured() || !email) return false;
  let host: string | null = null;
  try {
    host = new URL(siteUrl).hostname;
  } catch {
    // Fall back to alias-only matching.
  }
  trail.push("checking the test inbox for a verification email");
  const mail = await waitForVerificationEmail(
    { toAddress: email, since, fromDomainHint: host },
    timeoutMs
  );
  if (!mail) {
    trail.push("no verification email arrived within 90 seconds");
    return false;
  }
  trail.push(`verification email received from ${mail.from}`);

  if (mail.otp) {
    try {
      const res = await stagehand.act(
        "type the verification code %otp% into the code or OTP input on this page and submit or confirm it",
        { variables: { otp: mail.otp } }
      );
      if (res.success) {
        trail.push("entered the emailed verification code");
        await page.waitForTimeout(5000);
        shots.push(await capture());
        if (await agentIsLoggedIn(stagehand)) return true;
      }
    } catch {
      // Fall through to the link route.
    }
  }
  for (const link of mail.links.slice(0, 2)) {
    if (!page.goto) break;
    try {
      await page.goto(link, {
        waitUntil: "domcontentloaded",
        timeoutMs: 20000,
      });
      await page.waitForTimeout(4000);
      trail.push("opened the emailed verification link");
      shots.push(await capture());
      return true;
    } catch {
      // Try the next candidate link.
    }
  }
  return mail.otp != null;
}

/** Fill and submit the (possibly multi-step) registration form with the
 * test persona, capturing each step as scoring evidence. Returns true when
 * the walk ended in an authenticated session. */
async function runRegistrationWalk(
  stagehand: Stagehand,
  page: {
    waitForTimeout: (ms: number) => Promise<void>;
    goto?: (
      url: string,
      opts?: { waitUntil?: "domcontentloaded"; timeoutMs?: number }
    ) => Promise<unknown>;
  },
  siteUrl: string,
  vars: Record<string, string>,
  trail: string[],
  shots: string[],
  capture: () => Promise<string>,
  timeLeft: () => number = () => Number.MAX_SAFE_INTEGER
): Promise<boolean> {
  // Verification emails triggered anywhere in this walk arrive after this
  // moment (small buffer for clock skew between us and Gmail).
  const walkStart = new Date(Date.now() - 60_000);
  const SUBMIT_PHRASINGS = [
    "click the enabled Create Account button to submit the registration",
    "click Register, Sign Up, or Create Account to complete registration",
    "click Continue or Next if this is a multi-step form and not the final screen",
  ];

  for (let step = 1; step <= 4; step++) {
    if (timeLeft() < 50_000) {
      trail.push(
        `stopped the registration walk at step ${step} — run time budget reached`
      );
      break;
    }
    try {
      await stagehand.act(
        `On this registration or sign-up step, fill every visible empty field that matches the persona. Use: email %email%, username %username%, password %password%, confirm password %password%, first name %firstName%, last name %lastName%, full name %fullName%, date of birth %dateOfBirthDisplay%, phone %phone%, mobile %phone%, address %addressLine1%, address line 2 %addressLine2%, city %city%, state or province %state%, postcode or zip %postalCode%, country %country%. Choose a currency if a currency picker is required. Only fill empty fields — do not submit yet.`,
        { variables: vars }
      );
      trail.push(`filled registration step ${step} with the test persona`);
    } catch (e) {
      trail.push(
        `couldn't fill registration step ${step} (${e instanceof Error ? e.message : e})`
      );
    }
    await page.waitForTimeout(800);
    shots.push(await capture());

    try {
      await stagehand.act(
        "Tick or check every required checkbox on this registration form: terms of service, privacy policy, age confirmation (18+), marketing opt-in if mandatory — anything needed to enable the submit button."
      );
    } catch {
      // Some forms have no checkboxes on this step.
    }
    await page.waitForTimeout(800);

    let submitted = false;
    for (const phrasing of SUBMIT_PHRASINGS) {
      try {
        const result = await stagehand.act(phrasing);
        if (result.success) {
          submitted = true;
          trail.push(`registration step ${step}: ${phrasing}`);
          break;
        }
      } catch {
        // Try the next phrasing.
      }
    }
    await page.waitForTimeout(6000);
    shots.push(await capture());

    if (await agentIsLoggedIn(stagehand)) {
      trail.push("registration submitted, account created and logged in");
      return true;
    }
    if (!submitted && step >= 2) {
      trail.push(
        `registration stalled at step ${step}: submit button may be disabled or blocked by captcha`
      );
      break;
    }
  }

  // "Verify your email" walls are the most common reason a submitted
  // registration doesn't end authenticated. The agent owns the inbox —
  // fetch the code or link and finish verification in this session. The
  // inbox wait shrinks to whatever budget remains after saving headroom.
  const firstVerifyBudget = Math.min(75_000, timeLeft() - 45_000);
  const firstVerify =
    firstVerifyBudget > 10_000 &&
    (await completeEmailVerification(
      stagehand,
      page,
      vars.email ?? "",
      siteUrl,
      walkStart,
      trail,
      shots,
      capture,
      firstVerifyBudget
    ));
  if (firstVerify) {
    await page.waitForTimeout(4000);
    if (await agentIsLoggedIn(stagehand)) {
      trail.push("email verified, account created and logged in");
      return true;
    }
  }
  // Only emails that arrive AFTER this point matter for the second check
  // (e.g. a login-triggered OTP) — never re-consume the signup email.
  const afterFirstVerify = new Date(Date.now() - 10_000);

  if (
    timeLeft() > 60_000 &&
    (await performAgentLogin(
      stagehand,
      page,
      {
        email: vars.email,
        username: vars.username,
        password: vars.password,
      },
      {
        trail,
        shots,
        capture,
        dismissCookies: false,
        deadlineAt: Date.now() + Math.max(0, timeLeft() - 45_000),
      }
    ))
  ) {
    return true;
  }

  await page.waitForTimeout(5000);
  if (await agentIsLoggedIn(stagehand)) {
    trail.push("authenticated after registration settled");
    return true;
  }

  // The login attempt itself can trip an OTP check — give the inbox one
  // short chance for a login-triggered code before giving up.
  if (
    timeLeft() > 55_000 &&
    (await completeEmailVerification(
      stagehand,
      page,
      vars.email ?? "",
      siteUrl,
      afterFirstVerify,
      trail,
      shots,
      capture,
      40_000
    ))
  ) {
    await page.waitForTimeout(4000);
    if (await agentIsLoggedIn(stagehand)) {
      trail.push("verified via emailed code after login");
      return true;
    }
  }

  trail.push(
    "registration submitted but no authenticated session. Email/SMS verification or captcha may be required"
  );
  return false;
}

/** Open the login form and sign in with the saved test credentials. */
async function tryAgentLogin(
  stagehand: Stagehand,
  page: {
    waitForTimeout: (ms: number) => Promise<void>;
    evaluate: (expr: string) => Promise<unknown>;
  },
  vars: Record<string, string>,
  trail: string[],
  shots: string[],
  capture: () => Promise<string>,
  deadlineAt?: number
): Promise<boolean> {
  return performAgentLogin(
    stagehand,
    page,
    {
      email: vars.email,
      username: vars.username,
      password: vars.password,
    },
    { trail, shots, capture, deadlineAt }
  );
}

/** The agent path: navigate from the homepage to the target area with
 * AI-driven actions, then capture and score what it found. */
async function analyzeWithAgent(
  url: string,
  journey: string,
  playbook: PlaybookStep[],
  contextId?: string | null,
  requestedProxyCountry?: string | null,
  signupVars?: Record<string, string> | null,
  chainLoginJourneys?: string[],
  loginVars?: Record<string, string> | null,
  _accountExists?: boolean,
  device: DeviceMode = "both"
): Promise<JourneyAnalysis & { chainedAnalyses?: JourneyAnalysis[] }> {
  // Mobile reports run the whole walk at a phone viewport — one pass, one
  // device, and evidence that matches where most players actually are.
  const walkViewport =
    device === "mobile" ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT;
  // The serverless platform kills this function at maxDuration and all
  // evidence dies with it. Track the remaining budget from before session
  // creation (its rate-limit retries count too) and stop the walk early —
  // a scored partial walk beats a silent kill every time.
  const deadline = Date.now() + RUN_BUDGET_MS;
  const timeLeft = () => deadline - Date.now();
  // Session creation hits Browserbase's 5-per-minute burst limit when many
  // journeys launch together — retry with a fresh instance on 429.
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
        timeout: 900,
        browserSettings: {
          viewport: walkViewport,
          // Resume the brand's logged-in state so gated areas are scoreable.
          ...(contextId ? { context: { id: contextId, persist: true } } : {}),
        },
        ...proxyConfig(requestedProxyCountry),
      },
      verbose: 0,
      disablePino: true,
    });
    await sh.init();
    return sh;
  });
  // Hoisted so a crash mid-walk can still persist the captured evidence.
  const trail: string[] = [];
  const shots: string[] = [];
  let lastUrl = url;
  try {
    const page =
      stagehand.context.activePage() ?? (await stagehand.context.newPage());
    const capture = createScreenshotCapture(page);

    await page
      .goto(url, { waitUntil: "domcontentloaded", timeoutMs: 25000 })
      .catch(() => {});
    await preparePageAfterNavigation(page, stagehand);
    await waitForPageContent(page);
    lastUrl = page.url();

    let authenticated: boolean | undefined;
    const isLoginJourney = LOGIN_PLAYBOOKS[journey] != null;
    const isSignup = journey === "signup";

    // First port of call for EVERY journey: a logged-in session. Reuse the
    // persisted context if it's still authenticated; otherwise log in with
    // the brand's saved test account. Public walks continue logged out when
    // login isn't possible — only login-gated journeys hard-fail.
    let sessionLoggedIn = false;
    if (contextId || loginVars) {
      sessionLoggedIn = await agentIsLoggedIn(stagehand);
      // Always try stored credentials first — reuse an existing account before
      // walking the journey. Signup is the exception: it must walk the real
      // registration form, so it never pre-authenticates.
      const shouldLogin = !sessionLoggedIn && loginVars != null && !isSignup;
      if (shouldLogin) {
        // Login is capped: public journeys must fall back to a logged-out
        // walk with plenty of budget left, not authenticate at any cost.
        // Login-gated journeys get more room — without a session they have
        // nothing to score anyway.
        const loginDeadline =
          Date.now() +
          Math.min(
            isLoginJourney ? LOGIN_BUDGET_MS + 40_000 : LOGIN_BUDGET_MS,
            Math.max(0, timeLeft() - 60_000)
          );
        // Login shots stay out of the evidence for public journeys — a
        // login modal with a red error box is not casino lobby evidence.
        const loginShots: string[] = [];
        sessionLoggedIn = await tryAgentLogin(
          stagehand,
          page,
          loginVars!,
          trail,
          isLoginJourney || isSignup ? shots : loginShots,
          capture,
          loginDeadline
        );
        if (!sessionLoggedIn && !isLoginJourney) {
          trail.push("continuing the walk logged out");
        }
        // Whether login worked or not, restart from a clean homepage so the
        // playbook walks the product the way a player would — not from a
        // login-error modal or wherever authentication dropped us.
        await page.waitForTimeout(2000);
        await page
          .goto(url, { waitUntil: "domcontentloaded", timeoutMs: 20000 })
          .catch(() => {});
        await preparePageAfterNavigation(page, stagehand);
        await page.waitForTimeout(3000);
      }
      if (sessionLoggedIn) {
        trail.push("logged in with the brand's test account before the walk");
      }
    }

    if (isLoginJourney && !sessionLoggedIn) {
      const screenshots = await persistShots([...shots, await capture()]);
      return {
        area: journey,
        analysedAt: new Date().toISOString(),
        score: 0,
        blocked: true,
        blockReason:
          "The agent couldn't get a logged-in session on this site. The saved test account may need email/SMS verification or the session expired. Take control to walk this journey yourself.",
        summary: "",
        heuristics: [],
        observations: [],
        features: [],
        screenshots,
        finalUrl: page.url(),
        loggedIn: false,
      };
    }

    // When a product section can't be found at all, that is itself a CX
    // finding — "a player can't tell this product exists" — scored from
    // the homepage evidence rather than reported as a dead run.
    let discoveryFailure: string | null = null;

    // Signup must always show the real registration flow. A persisted
    // context can arrive already authenticated, which hides the Join CTA —
    // drop to a logged-out state so the form itself becomes the evidence.
    // The registration walk's login fallback restores the session when the
    // account already exists, so gated journeys keep working afterwards.
    if (isSignup && sessionLoggedIn) {
      await page.sendCDP("Network.clearBrowserCookies", {}).catch(() => {});
      await page
        .goto(url, { waitUntil: "domcontentloaded", timeoutMs: 20000 })
        .catch(() => {});
      await preparePageAfterNavigation(page, stagehand);
      await waitForPageReady(page, { initialMs: 2000 });
      sessionLoggedIn = false;
      trail.push(
        "cleared the existing session so the real registration form could be walked"
      );
    }
    // Past reports are agent memory: try the route that found this area
    // on this site last time before rediscovering the navigation.
    const navHint = await getNavHint(url, journey);

    for (const [stepIndex, step] of playbook.entries()) {
      // Out of time: stop walking and publish what exists. A required step
      // we never reached means the area wasn't captured — return blocked
      // WITH the evidence so the report shows exactly how far the agent got.
      if (timeLeft() < 35_000) {
        if (step.required) {
          trail.push("run time budget exhausted before reaching this area");
          const screenshots = await persistShots([...shots, await capture()]);
          return {
            area: journey,
            analysedAt: new Date().toISOString(),
            score: 0,
            blocked: true,
            blockReason:
              "The run hit its time limit before the agent reached this area. The screenshots show how far it got — retry the run; revisits are faster because the agent remembers the route.",
            summary: "",
            heuristics: [],
            observations: [],
            features: [],
            screenshots,
            finalUrl: page.url(),
          };
        }
        trail.push("skipped the remaining optional steps — run time budget reached");
        break;
      }
      let ok = false;
      let message = "";
      const isNavStep = stepIndex === 0 && Boolean(step.verify);

      // Remembered destination path first — fastest and most reliable.
      if (isNavStep && navHint?.path) {
        try {
          await page.goto(new URL(navHint.path, url).toString(), {
            waitUntil: "domcontentloaded",
            timeoutMs: 20000,
          });
          await preparePageAfterNavigation(page, stagehand);
          await waitForPageReady(page, { relaxed: true, initialMs: 2000 });
          if (!step.verify || (await verifyLandedArea(stagehand, step.verify))) {
            ok = true;
            message = `went straight to ${navHint.path} — the route that worked on the previous visit`;
          }
        } catch {
          // Site changed — rediscover below.
        }
      }

      // Sites label the same control differently — try each phrasing
      // before concluding the step failed. A remembered textual route
      // from a past run gets first shot.
      const phrasings = [
        ...(isNavStep && navHint?.path && !ok
          ? [
              `${step.instruction}. On a previous visit, this site's ${journey} area was reached like this: ${navHint.hint} — try that route first`,
            ]
          : []),
        step.instruction,
        ...(step.alternatives ?? []),
      ];
      for (const phrasing of phrasings) {
        if (ok) break;
        if (timeLeft() < 35_000) break;
        try {
          const result = await stagehand.act(phrasing);
          ok = result.success;
          message = result.actionDescription || result.message;
        } catch (e) {
          message = e instanceof Error ? e.message : String(e);
        }
        // A successful click isn't proof of the right destination — Tipico's
        // homepage IS its sportsbook, so "opened sports" can land on the same
        // page the casino click should have left. Verify before accepting.
        if (ok && step.verify) {
          await waitForPageReady(page, { relaxed: true, initialMs: 2000 });
          if (!(await verifyLandedArea(stagehand, step.verify))) {
            ok = false;
            message = "landed on the wrong area — trying another route";
          }
        }
      }
      // Section navigation can fall back to well-known URL paths when the
      // agent can't find the nav entry (mega-menus, icon-only navs).
      // House labels like "Arcade" are tried via a direct DOM click first —
      // Stagehand often misses side-menu text that a player would tap.
      if (!ok && step.navLabels?.length) {
        const hit = await clickNavByLabel(page, step.navLabels);
        if (hit.ok) {
          await preparePageAfterNavigation(page, stagehand);
          await waitForPageReady(page, { relaxed: true, initialMs: 2000 });
          if (!step.verify || (await verifyLandedArea(stagehand, step.verify))) {
            ok = true;
            message = `clicked "${hit.matched}" in the site navigation`;
          } else {
            message = `clicked "${hit.matched}" but landed on the wrong area`;
          }
        }
      }
      if (!ok && step.fallbackPaths?.length) {
        for (const path of step.fallbackPaths) {
          if (timeLeft() < 30_000) break;
          try {
            await page.goto(new URL(path, url).toString(), {
              waitUntil: "domcontentloaded",
              timeoutMs: 20000,
            });
            await preparePageAfterNavigation(page, stagehand);
            await waitForPageReady(page, { relaxed: true, initialMs: 2000 });
            const bodyText = String(
              await page.evaluate("document.body?.innerText ?? ''")
            );
            const dead =
              bodyText.length < 300 ||
              /404|not found|page (doesn'?t|does not) exist|having a few issues|something went wrong|temporarily unavailable/i.test(
                bodyText.slice(0, 2000)
              );
            if (
              !dead &&
              (!step.verify ||
                (await verifyLandedArea(stagehand, step.verify)))
            ) {
              ok = true;
              message = `opened ${path} directly after the nav lookup failed`;
              break;
            }
          } catch {
            // Try the next known path.
          }
        }
      }
      if (ok) {
        trail.push(message || step.instruction);
        shots.push(await capture());
        lastUrl = page.url();
        // A verified navigation is knowledge — remember the route so the
        // next run on this site goes straight there. Only paths that leave
        // the homepage count (a "clicked menu" hint with no destination
        // poisons future runs).
        if (isNavStep) {
          try {
            const dest = new URL(lastUrl);
            const start = new URL(url);
            if (
              dest.pathname &&
              dest.pathname !== "/" &&
              dest.pathname !== start.pathname
            ) {
              void saveNavHint(
                url,
                journey,
                message || step.instruction,
                lastUrl
              );
            }
          } catch {
            // Ignore bad URLs.
          }
        }
      } else if (step.required) {
        // Product areas: not finding the section IS the finding. Go back
        // to the homepage so the evidence shows exactly what a lost
        // player sees, and score the discoverability failure.
        if (DISCOVERY_SCORED_JOURNEYS.has(journey)) {
          discoveryFailure = message || step.instruction;
          trail.push(
            `couldn't find the ${journey} area from the navigation, menus, or known URL paths — scoring this as a discoverability failure`
          );
          await page
            .goto(url, { waitUntil: "domcontentloaded", timeoutMs: 20000 })
            .catch(() => {});
          await preparePageAfterNavigation(page, stagehand);
          await waitForPageContent(page);
          shots.push(await capture());
          break;
        }
        // The failed attempt is still evidence — keep everything captured
        // so far (login tries, partial navigation) plus the final state.
        const screenshots = await persistShots([...shots, await capture()]);
        return {
          area: journey,
          analysedAt: new Date().toISOString(),
          score: 0,
          blocked: true,
          blockReason: `The agent couldn't ${instructionSummary(step.instruction)} on this site${message ? ` (${message})` : ""}. Launch the site to capture this area manually.`,
          summary: "",
          heuristics: [],
          observations: [],
          features: [],
          screenshots,
          finalUrl: page.url(),
        };
      }
    }

    // With a persona in hand, go beyond the opened form: create a real
    // test account so gated journeys can run against this brand's context.
    if (journey === "signup" && signupVars) {
      authenticated = await runRegistrationWalk(
        stagehand,
        page,
        url,
        signupVars,
        trail,
        shots,
        capture,
        timeLeft
      );
    }

    // Navigation steps often land on SPAs that need extra time to paint
    // the lobby/content after the chrome loads (Betonline casino, etc.).
    await dismissSiteCookiesWithAgent(page, stagehand);
    await waitForPageContent(page);

    if (DEEP_SCROLL_JOURNEYS.has(journey)) {
      const scrollShots = await captureScrollSequence(
        {
          capture,
          scrollTo: async (y) => {
            await page.evaluate(`window.scrollTo(0, ${y})`);
          },
          getHeight: async () =>
            Number(
              await page.evaluate("document.documentElement.scrollHeight")
            ),
        },
        6,
        walkViewport.height
      );
      if (shots.length) scrollShots.shift();
      shots.push(...scrollShots);
    } else {
      await page.scroll(
        Math.round(walkViewport.width / 2),
        450,
        0,
        walkViewport.height
      );
      shots.push(await capture());
    }

    const pageTitle = await page.title().catch(() => "");
    const finalUrl = page.url();

    const geoReason = geoBlockReason(finalUrl, await readBodyText(page));
    if (geoReason) {
      const screenshots = await persistShots(shots.length ? shots : [await capture()]);
      return {
        area: journey,
        analysedAt: new Date().toISOString(),
        score: 0,
        blocked: true,
        blockReason: geoReason,
        summary: "",
        heuristics: [],
        observations: [],
        features: [],
        screenshots,
        finalUrl,
        loggedIn: isLoginJourney ? false : undefined,
      };
    }

    // Mobile-first pass: only "both" reports re-capture at a phone
    // viewport — single-device reports already have their evidence.
    // Skipped when the budget is nearly spent — evidence that gets saved
    // beats evidence that dies with a killed function.
    const mobileFrom = shots.length;
    if (device === "both") {
      if (timeLeft() > 40_000) {
        shots.push(...(await captureMobileShots(page, capture)));
      } else {
        trail.push("skipped the mobile pass — run time budget reached");
      }
    }
    const hasMobile = device === "both" && shots.length > mobileFrom;

    const [result, screenshots] = await Promise.all([
      scoreScreenshots(
        journey,
        pageTitle,
        finalUrl,
        shots,
        trail,
        "agent",
        hasMobile ? mobileFrom : null,
        (discoveryFailure ? discoveryFailurePrompt(journey) : "") +
          (device === "mobile" ? MOBILE_ONLY_PROMPT : "")
      ),
      persistShots(shots),
    ]);
    const analysis: JourneyAnalysis = {
      ...result,
      area: journey,
      analysedAt: new Date().toISOString(),
      screenshots,
      // mobileFrom 0 = every shot is a phone capture (mobile-only report).
      ...(hasMobile ? { mobileFrom } : device === "mobile" ? { mobileFrom: 0 } : {}),
      finalUrl,
      ...(authenticated !== undefined ? { authenticated } : {}),
      // What the session actually was: pre-walk login, a registration that
      // ended authenticated, or a verified gated-journey session.
      loggedIn: isLoginJourney || sessionLoggedIn || (authenticated ?? false),
    };

    // Signup created a session — walk deposit/account journeys in the same
    // browser before closing so scores show as logged-in immediately.
    const chainedAnalyses: JourneyAnalysis[] = [];
    if (
      journey === "signup" &&
      authenticated &&
      chainLoginJourneys &&
      chainLoginJourneys.length > 0
    ) {
      for (const loginJourney of chainLoginJourneys) {
        const loginPlaybook = LOGIN_PLAYBOOKS[loginJourney];
        if (!loginPlaybook) continue;
        if (timeLeft() < 90_000) {
          trail.push(
            `skipped the chained ${loginJourney} walk — not enough time left in this run; it runs as its own request instead`
          );
          break;
        }
        try {
          await page
            .goto(url, { waitUntil: "domcontentloaded", timeoutMs: 25000 })
            .catch(() => {});
          await preparePageAfterNavigation(page, stagehand);
          await waitForPageReady(page, { relaxed: true, initialMs: 2000 });
          if (!(await agentIsLoggedIn(stagehand))) {
            trail.push(
              `skipped ${loginJourney}: session lost before logged-in pass`
            );
            break;
          }
          const chained = await walkPlaybookAndScore(
            stagehand,
            page,
            url,
            loginJourney,
            loginPlaybook,
            [`logged-in pass after signup`],
            device
          );
          chainedAnalyses.push(chained);
        } catch (e) {
          console.error(
            `[analyst] chained ${loginJourney} after signup failed:`,
            e instanceof Error ? e.message : e
          );
        }
      }
    }

    return chainedAnalyses.length > 0
      ? { ...analysis, chainedAnalyses }
      : analysis;
  } catch (e) {
    // A crash mid-walk must never throw the evidence away — persist what
    // the agent captured and report a blocked run the user can see.
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[analyst] ${journey} walk crashed:`, message);
    const screenshots = await persistShots(shots).catch(() => [] as string[]);
    return {
      area: journey,
      analysedAt: new Date().toISOString(),
      score: 0,
      blocked: true,
      blockReason: `The run failed partway through this walk (${message}). The screenshots show how far the agent got — retry, or take control to walk it yourself.`,
      summary: "",
      heuristics: [],
      observations: [],
      features: [],
      screenshots,
      finalUrl: lastUrl,
      ...(journey === "signup" && signupVars ? { authenticated: false } : {}),
      loggedIn: false,
    };
  } finally {
    await stagehand.close().catch(() => {});
  }
}

/** Run one playbook to completion and score it — used for the primary walk
 * and for logged-in journeys chained after signup. */
async function walkPlaybookAndScore(
  stagehand: Stagehand,
  page: Awaited<ReturnType<Stagehand["context"]["newPage"]>>,
  url: string,
  journey: string,
  playbook: PlaybookStep[],
  trailPrefix: string[] = [],
  device: DeviceMode = "both"
): Promise<JourneyAnalysis> {
  const capture = createScreenshotCapture(page);
  const walkViewport =
    device === "mobile" ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT;

  const trail = [...trailPrefix];
  const shots: string[] = [];

  await preparePageAfterNavigation(page, stagehand);

  for (const step of playbook) {
    let ok = false;
    let message = "";
    for (const phrasing of [step.instruction, ...(step.alternatives ?? [])]) {
      try {
        const result = await stagehand.act(phrasing);
        ok = result.success;
        message = result.actionDescription || result.message;
      } catch (e) {
        message = e instanceof Error ? e.message : String(e);
      }
      if (ok && step.verify) {
        await waitForPageReady(page, { relaxed: true, initialMs: 2000 });
        if (!(await verifyLandedArea(stagehand, step.verify))) {
          ok = false;
          message = "landed on the wrong area — trying another route";
        }
      }
      if (ok) break;
    }
    if (!ok && step.navLabels?.length) {
      const hit = await clickNavByLabel(page, step.navLabels);
      if (hit.ok) {
        await preparePageAfterNavigation(page, stagehand);
        await waitForPageReady(page, { relaxed: true, initialMs: 2000 });
        if (!step.verify || (await verifyLandedArea(stagehand, step.verify))) {
          ok = true;
          message = `clicked "${hit.matched}" in the site navigation`;
        }
      }
    }
    if (!ok && step.fallbackPaths?.length) {
      for (const path of step.fallbackPaths) {
        try {
          await page.goto(new URL(path, url).toString(), {
            waitUntil: "domcontentloaded",
            timeoutMs: 20000,
          });
          await preparePageAfterNavigation(page, stagehand);
          await waitForPageReady(page, { relaxed: true, initialMs: 2000 });
          const bodyText = String(
            await page.evaluate("document.body?.innerText ?? ''")
          );
          const dead =
            bodyText.length < 300 ||
            /404|not found|page (doesn'?t|does not) exist|having a few issues|something went wrong|temporarily unavailable/i.test(
              bodyText.slice(0, 2000)
            );
          if (
            !dead &&
            (!step.verify || (await verifyLandedArea(stagehand, step.verify)))
          ) {
            ok = true;
            message = `opened ${path} directly after the nav lookup failed`;
            break;
          }
        } catch {
          // Try the next known path.
        }
      }
    }
    if (ok) {
      trail.push(message || step.instruction);
      shots.push(await capture());
    } else if (step.required) {
      const screenshots = await persistShots([await capture()]);
      return {
        area: journey,
        analysedAt: new Date().toISOString(),
        score: 0,
        blocked: true,
        blockReason: `The agent couldn't ${instructionSummary(step.instruction)} on this site${message ? ` (${message})` : ""}. Launch the site to capture this area manually.`,
        summary: "",
        heuristics: [],
        observations: [],
        features: [],
        screenshots,
        finalUrl: page.url(),
      };
    }
  }

  await dismissSiteCookiesWithAgent(page, stagehand);

  if (DEEP_SCROLL_JOURNEYS.has(journey)) {
    const scrollShots = await captureScrollSequence(
      {
        capture,
        scrollTo: async (y) => {
          await page.evaluate(`window.scrollTo(0, ${y})`);
        },
        getHeight: async () =>
          Number(await page.evaluate("document.documentElement.scrollHeight")),
      },
      6,
      walkViewport.height
    );
    if (shots.length) scrollShots.shift();
    shots.push(...scrollShots);
  } else {
    await page.scroll(
      Math.round(walkViewport.width / 2),
      450,
      0,
      walkViewport.height
    );
    shots.push(await capture());
  }

  const pageTitle = await page.title().catch(() => "");
  const finalUrl = page.url();

  // Mobile-first pass ("both" reports only) — same session, phone
  // viewport, restored afterwards so the next chained journey starts back
  // on desktop.
  const mobileFrom = shots.length;
  if (device === "both") {
    shots.push(...(await captureMobileShots(page, capture)));
  }
  const hasMobile = device === "both" && shots.length > mobileFrom;

  const [result, screenshots] = await Promise.all([
    scoreScreenshots(
      journey,
      pageTitle,
      finalUrl,
      shots,
      trail,
      "agent",
      hasMobile ? mobileFrom : null,
      device === "mobile" ? MOBILE_ONLY_PROMPT : ""
    ),
    persistShots(shots),
  ]);
  return {
    ...result,
    area: journey,
    analysedAt: new Date().toISOString(),
    screenshots,
    ...(hasMobile ? { mobileFrom } : device === "mobile" ? { mobileFrom: 0 } : {}),
    finalUrl,
    // Chained walks only run inside the authenticated session from signup.
    loggedIn: true,
  };
}

/** The landing path: straight visit, no navigation needed. */
async function analyzeLanding(
  url: string,
  contextId?: string | null,
  proxyCountry?: string | null,
  device: DeviceMode = "both"
): Promise<JourneyAnalysis> {
  const journey = "landing";
  const walkViewport =
    device === "mobile" ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT;
  const { id, connectUrl } = await createSession(
    undefined,
    contextId ?? undefined,
    proxyCountry
  );
  try {
    const browser = await chromium.connectOverCDP(connectUrl);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());
    await page.setViewportSize(walkViewport);

    await page
      .goto(url, { waitUntil: "domcontentloaded", timeout: 25000 })
      .catch(() => {});
    await preparePageAfterNavigation({
      evaluate: (expr) => page.evaluate(expr),
      waitForTimeout: (ms) => page.waitForTimeout(ms),
    });
    const pageReady: CookieDismissPage = {
      evaluate: (expr) => page.evaluate(expr),
      waitForTimeout: (ms) => page.waitForTimeout(ms),
    };
    await waitForPageReady(pageReady, { initialMs: 2000 });

    // Raw CDP capture: unlike page.screenshot() it doesn't wait for page
    // stability, so bot-challenge pages that never settle can't stall us.
    const cdp = await context.newCDPSession(page);
    const capture = async () => {
      await dismissSiteCookies(pageReady, { retries: 2 });
      await waitForPageReady(pageReady, { relaxed: true, initialMs: 900 });
      const { data } = (await cdp.send("Page.captureScreenshot", {
        format: "jpeg",
        quality: 60,
      })) as { data: string };
      return data;
    };

    const shots = await captureScrollSequence(
      {
        capture,
        scrollTo: async (y) => {
          await page.evaluate((yy) => window.scrollTo(0, yy), y);
        },
        getHeight: async () =>
          page.evaluate(() => document.documentElement.scrollHeight),
      },
      6,
      walkViewport.height
    );

    // Mobile-first pass ("both" reports only) before the session closes.
    const mobileFrom = shots.length;
    if (device === "both") {
      shots.push(
        ...(await captureMobileShots(
          {
            evaluate: (expr) => page.evaluate(expr),
            waitForTimeout: (ms) => page.waitForTimeout(ms),
            sendCDP: async <T,>(method: string, params?: object) =>
              (await cdp.send(
                method as Parameters<typeof cdp.send>[0],
                params
              )) as T,
          },
          capture
        ))
      );
    }
    const hasMobile = device === "both" && shots.length > mobileFrom;

    const pageTitle = await page.title().catch(() => "");
    const finalUrl = page.url();
    const bodyText = await readBodyText({
      evaluate: (expr) => page.evaluate(expr),
    });
    await browser.close().catch(() => {});

    const geoReason = geoBlockReason(finalUrl, bodyText);
    if (geoReason) {
      const screenshots = await persistShots(shots);
      return {
        area: journey,
        analysedAt: new Date().toISOString(),
        score: 0,
        blocked: true,
        blockReason: geoReason,
        summary: "",
        heuristics: [],
        observations: [],
        features: [],
        screenshots,
        finalUrl,
      };
    }

    const [result, screenshots] = await Promise.all([
      scoreScreenshots(
        journey,
        pageTitle,
        finalUrl,
        shots,
        [],
        "agent",
        hasMobile ? mobileFrom : null,
        device === "mobile" ? MOBILE_ONLY_PROMPT : ""
      ),
      persistShots(shots),
    ]);
    return {
      ...result,
      area: journey,
      analysedAt: new Date().toISOString(),
      screenshots,
      ...(hasMobile ? { mobileFrom } : device === "mobile" ? { mobileFrom: 0 } : {}),
      finalUrl,
    };
  } finally {
    await releaseSession(id);
  }
}
