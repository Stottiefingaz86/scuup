/**
 * Post-journey feature scan — what the site offers beyond the funnel.
 *
 * Runs once the timed journey is done (nothing here is on the stopwatch).
 * Walks the mobile nav, the casino lobby, the rewards / VIP area, the
 * sportsbook and the account/security screens, and records capabilities the
 * Feature benchmark compares across brands: search, favourites, missions,
 * activity feeds, rakeback, progress meters, cross-sell prompts, 2FA…
 *
 * DOM first (cheap, deterministic), one LLM read per area to catch wording
 * the regexes miss ("Quests", "Rewards Calendar", "Rain", "Wager races").
 */
import type { Stagehand } from "@browserbasehq/stagehand";
import type { JourneyStageTracker } from "./stage-tracker";
import { inspectLobby, type LobbyFeatures } from "./play-agent";
import type { BrandFeatureScan, FeatureSignal } from "./types";

type ScanPage = {
  waitForTimeout: (ms: number) => Promise<void>;
  evaluate?: (expr: string) => Promise<unknown>;
  url?: () => string;
  goto?: (
    url: string,
    opts?: { waitUntil?: "domcontentloaded"; timeoutMs?: number },
  ) => Promise<unknown>;
};

const VIS = `const vis = (el) => { if (!(el instanceof Element)) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };`;

/** Visible body text, digits kept (countdowns matter here). */
async function pageText(page: ScanPage, max = 12000): Promise<string> {
  if (!page.evaluate) return "";
  try {
    const t = await page.evaluate(
      `(document.body && document.body.innerText || "").replace(/\\s+/g, " ").slice(0, ${max})`,
    );
    return typeof t === "string" ? t : "";
  } catch {
    return "";
  }
}

async function dismissPopups(page: ScanPage): Promise<void> {
  if (!page.evaluate) return;
  try {
    await page.evaluate(`(() => {
      ${VIS}
      const roots = [...document.querySelectorAll("[role=dialog], [aria-modal=true], [class*='modal' i], [class*='popup' i]")].filter(vis);
      const re = /^(got it|close|dismiss|ok|okay|no thanks|not now|later|maybe later|×|x|✕|✖)$/i;
      for (const root of roots) {
        const btn = [...root.querySelectorAll("button, [role=button], a")].filter(vis).find((b) => {
          const t = (b.innerText || b.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
          return re.test(t) || /close|dismiss/i.test(b.getAttribute("aria-label") || "");
        });
        if (btn) { btn.click(); return; }
      }
    })()`);
  } catch {
    /* ignore */
  }
}

/**
 * Nav inventory: header tabs plus whatever the hamburger reveals. Returns
 * labels in on-screen order so "Casino is item 3 of 10" can be reported.
 */
async function readNavigation(page: ScanPage): Promise<string[]> {
  if (!page.evaluate) return [];
  try {
    const raw = await page.evaluate(`(async () => {
      ${VIS}
      const labelOf = (el) => (el.innerText || el.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
      const collect = () => [...document.querySelectorAll("nav a, nav button, header a, header button, [role=navigation] a, [role=menu] a, [role=menuitem], [class*='menu' i] a, [class*='nav' i] a, [class*='drawer' i] a, [class*='sidebar' i] a")]
        .filter(vis)
        .map(labelOf)
        .filter((t) => t && t.length <= 28 && !/^\\d|[$€£]/.test(t));
      let items = collect();
      const burger = [...document.querySelectorAll("button, [role=button], a")].filter(vis).find((el) => {
        const meta = ((el.getAttribute("aria-label") || "") + " " + (el.className || "") + " " + (el.id || "")).toLowerCase();
        const r = el.getBoundingClientRect();
        return r.top < 120 && /menu|hamburger|burger|nav-toggle|navbar-toggle/.test(meta) && !/close/.test(meta);
      });
      if (burger) {
        burger.click();
        await new Promise((r) => setTimeout(r, 900));
        items = items.concat(collect());
        const close = [...document.querySelectorAll("button, [role=button]")].filter(vis).find((el) => /close|×|✕/i.test((el.getAttribute("aria-label") || el.innerText || "")));
        if (close) close.click();
      }
      const seen = new Set();
      return items.filter((t) => { const k = t.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 40);
    })()`);
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Icon-only controls carry their meaning in aria/title/class/svg/img names. */
const ICON_HINTS: Record<string, RegExp> = {
  rewards:
    /crown|vip|reward|loyalty|trophy|gift|medal|star|bonus|promo|rakeback|cashback/i,
  referral: /refer|invite|affiliate|share/i,
  casino: /casino|slots|dice|cards|spade/i,
  sports: /sport|football|soccer|ball|trophy/i,
  account: /account|profile|avatar|user|person|settings|gear|cog/i,
};

/**
 * Open an area the way a player would: tap a nav label, then an icon that
 * looks right (crown, gift, trophy…), then the hamburger / account menu,
 * then ask the LLM to find it, and only then guess URL paths. Every hop is
 * checked against `verify` so "opened" means the page really shows it.
 */
async function openArea(
  page: ScanPage,
  label: RegExp,
  paths: string[],
  opts: {
    iconHint?: RegExp;
    verify?: RegExp;
    llm?: { stagehand: Stagehand; ask: string };
  } = {},
): Promise<{ opened: boolean; via: string | null }> {
  if (!page.evaluate) return { opened: false, via: null };
  const arrived = async () => {
    if (!opts.verify) return true;
    const t = await pageText(page, 6000);
    return opts.verify.test(t);
  };
  const clickBy = async (mode: "label" | "icon"): Promise<string | null> => {
    try {
      const r = await page.evaluate!(`(async () => {
        ${VIS}
        const labelRe = ${label.toString()};
        const iconRe = ${(opts.iconHint ?? /$^/).toString()};
        const text = (el) => (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || "").replace(/\s+/g, " ").trim();
        const meta = (el) => [el.getAttribute("aria-label"), el.getAttribute("title"), el.className && el.className.toString(), el.id, el.getAttribute("href"),
          ...[...el.querySelectorAll("svg use, svg, img, i, span")].slice(0, 6).map((c) => (c.getAttribute && (c.getAttribute("href") || c.getAttribute("xlink:href") || c.getAttribute("alt") || c.getAttribute("src") || c.getAttribute("data-icon") || c.className && c.className.toString())) || "")]
          .filter(Boolean).join(" ");
        const candidates = () => [...document.querySelectorAll("a, button, [role=button], [role=menuitem], [role=tab], [role=link]")].filter(vis);
        const pick = () => {
          const list = candidates();
          if (${JSON.stringify(mode)} === "label") return list.find((el) => labelRe.test(text(el)));
          // Icon: small control (no long label) whose metadata smells right.
          return list.find((el) => text(el).length <= 14 && iconRe.test(meta(el)));
        };
        let el = pick();
        let via = ${JSON.stringify(mode)};
        if (!el) {
          const openers = candidates().filter((b) => {
            const m = ((b.getAttribute("aria-label") || "") + " " + (b.className || "") + " " + text(b)).toLowerCase();
            return b.getBoundingClientRect().top < 120 && /menu|hamburger|burger|account|profile|avatar|more/.test(m) && !/close/.test(m);
          }).slice(0, 2);
          for (const o of openers) {
            o.click();
            await new Promise((r) => setTimeout(r, 900));
            el = pick();
            if (el) { via = ${JSON.stringify(mode)} + " via menu"; break; }
          }
        }
        if (!el) return null;
        el.scrollIntoView({ block: "center" });
        el.click();
        return via + ": " + (text(el) || meta(el).slice(0, 30));
      })()`);
      return typeof r === "string" ? r : null;
    } catch {
      return null;
    }
  };

  for (const mode of ["label", "icon"] as const) {
    if (mode === "icon" && !opts.iconHint) continue;
    const via = await clickBy(mode);
    if (via) {
      await page.waitForTimeout(2500);
      await dismissPopups(page);
      if (await arrived()) return { opened: true, via };
    }
  }

  if (opts.llm) {
    try {
      await opts.llm.stagehand.act(opts.llm.ask);
      await page.waitForTimeout(2500);
      await dismissPopups(page);
      if (await arrived()) return { opened: true, via: "llm" };
    } catch {
      /* fall through to paths */
    }
  }

  if (!page.goto || !page.url) return { opened: false, via: null };
  let origin = "";
  try {
    origin = new URL(page.url()).origin;
  } catch {
    return { opened: false, via: null };
  }
  for (const p of paths) {
    try {
      await page.goto(`${origin}${p}`, {
        waitUntil: "domcontentloaded",
        timeoutMs: 15000,
      });
      await page.waitForTimeout(2000);
      const t = await pageText(page, 6000);
      if (/404|not found|page doesn.t exist/i.test(t)) continue;
      if (!opts.verify || opts.verify.test(t))
        return { opened: true, via: `path ${p}` };
    } catch {
      /* try next */
    }
  }
  return { opened: false, via: null };
}

/** Structural signals that regexes on text can't see. */
async function readRewardWidgets(page: ScanPage): Promise<{
  progressMeter: boolean;
  countdown: boolean;
  claimable: boolean;
}> {
  const none = { progressMeter: false, countdown: false, claimable: false };
  if (!page.evaluate) return none;
  try {
    const r = (await page.evaluate(`(() => {
      ${VIS}
      const text = (document.body && document.body.innerText || "");
      const progressMeter = [...document.querySelectorAll("progress, [role=progressbar], [class*='progress' i], [class*='meter' i]")].some(vis)
        || /\\b\\d{1,3}\\s?%\\s*(to|until|of the way)\\b/i.test(text);
      const countdown = /\\b\\d{1,2}[dh]\\s?\\d{1,2}[hm]\\b|\\b\\d{2}:\\d{2}:\\d{2}\\b|\\b(ends|resets|expires) in\\b|time left|hurry/i.test(text)
        || [...document.querySelectorAll("[class*='countdown' i], [class*='timer' i]")].some(vis);
      const claimable = [...document.querySelectorAll("button, a, [role=button]")].filter(vis).some((b) => /^\\s*(claim|collect|redeem|open|spin now|activate)\\b/i.test(b.innerText || ""));
      return { progressMeter, countdown, claimable };
    })()`)) as Partial<typeof none> | null;
    return {
      progressMeter: Boolean(r?.progressMeter),
      countdown: Boolean(r?.countdown),
      claimable: Boolean(r?.claimable),
    };
  } catch {
    return none;
  }
}

/** Activity / social proof feeds: live wins, latest bets, "X just won". */
async function readActivityFeed(page: ScanPage): Promise<string | null> {
  if (!page.evaluate) return null;
  try {
    const r = await page.evaluate(`(() => {
      ${VIS}
      const heads = [...document.querySelectorAll("h1,h2,h3,h4,[role=tab],button,span,div")].filter(vis)
        .map((el) => (el.childElementCount <= 2 ? (el.innerText || "") : "").replace(/\\s+/g, " ").trim())
        .filter((t) => t && t.length <= 32);
      const hit = heads.find((t) => /^(live wins|latest bets|recent wins|big wins|live bets|all bets|high rollers|lucky wins|race leaderboard|live feed|recent plays|now playing|top wins)\\b/i.test(t));
      if (hit) return hit;
      const text = (document.body && document.body.innerText || "");
      const m = text.match(/\\b[\\w*]{2,12} (just won|won) [$€£]?\\d[\\d,.]*/i);
      return m ? m[0] : null;
    })()`);
    return typeof r === "string" ? r : null;
  } catch {
    return null;
  }
}

const REGEX_SIGNALS: {
  name: string;
  category: FeatureSignal["category"];
  re: RegExp;
}[] = [
  {
    name: "VIP levels",
    category: "Rewards",
    re: /\b(vip (level|tier|club|program)|loyalty (tier|level|program)|bronze|silver|gold|platinum|diamond)\b/i,
  },
  {
    name: "Rakeback",
    category: "Rewards",
    re: /\b(rakeback|rake back|cashback|cash back|rebate)\b/i,
  },
  {
    name: "Daily bonus",
    category: "Rewards",
    re: /\b(daily (bonus|reward|spin|drop|calendar|streak)|login bonus|daily free)\b/i,
  },
  {
    name: "Weekly bonus",
    category: "Rewards",
    re: /\b(weekly (bonus|reload|reward|drop)|reload bonus)\b/i,
  },
  {
    name: "Monthly bonus",
    category: "Rewards",
    re: /\b(monthly (bonus|reload|reward|drop))\b/i,
  },
  {
    name: "Missions / challenges",
    category: "Engagement",
    re: /\b(missions?|challenges?|quests?|streaks?|achievements?|tasks? to complete)\b/i,
  },
  {
    name: "Leaderboards / races",
    category: "Engagement",
    re: /\b(leaderboards?|wager race|races?|tournaments?|competitions?)\b/i,
  },
  {
    name: "Level / XP progress",
    category: "Engagement",
    re: /\b(level \d+|xp|experience points|rank up|level up)\b/i,
  },
  {
    name: "Withdrawable cash rewards",
    category: "Rewards",
    re: /\b(no wager(ing)? requirement|withdrawable|real cash|instant cash|paid in cash)\b/i,
  },
  {
    name: "Bonus wagering terms",
    category: "Rewards",
    re: /\b(\d{1,2}x (wager|rollover)|rollover|wagering requirement)\b/i,
  },
  {
    name: "Live chat support",
    category: "Support",
    re: /\b(live chat|chat with us|24\/7 support|support chat)\b/i,
  },
  {
    name: "Bet builder / SGP",
    category: "Sports",
    re: /\b(bet builder|same game parlay|sgp|build a bet)\b/i,
  },
  { name: "Cash out", category: "Sports", re: /\b(cash ?out|early payout)\b/i },
  {
    name: "Live betting",
    category: "Sports",
    re: /\b(live betting|in-play|in play|live now)\b/i,
  },
  { name: "Provably fair", category: "Casino", re: /\b(provably fair)\b/i },
  {
    name: "Originals / in-house games",
    category: "Casino",
    re: /\b(originals|in-house games|exclusive games)\b/i,
  },
  { name: "Jackpots", category: "Casino", re: /\b(jackpots?|must drop)\b/i },
  {
    name: "Live casino",
    category: "Casino",
    re: /\b(live casino|live dealer)\b/i,
  },
  {
    name: "Referral programme",
    category: "Acquisition",
    re: /\b(refer a friend|referral|invite friends|affiliates?)\b/i,
  },
  {
    name: "Two-factor authentication",
    category: "Login",
    re: /\b(two[- ]factor|2fa|authenticator app|google authenticator)\b/i,
  },
  {
    name: "Biometrics / passkey",
    category: "Login",
    re: /\b(passkey|biometric|face id|touch id|fingerprint)\b/i,
  },
  {
    name: "Social / wallet login",
    category: "Login",
    re: /\b(sign in with (google|apple|facebook|telegram|steam)|continue with (google|apple)|metamask|walletconnect|connect wallet)\b/i,
  },
  {
    name: "Buy crypto",
    category: "Other",
    re: /\b(buy crypto|banxa|moonpay|simplex)\b/i,
  },
];

function scanText(
  text: string,
  area: string,
  into: Map<string, FeatureSignal>,
): void {
  for (const s of REGEX_SIGNALS) {
    const m = text.match(s.re);
    if (!m) continue;
    if (into.has(s.name)) continue;
    const at = Math.max(0, (m.index ?? 0) - 40);
    into.set(s.name, {
      name: s.name,
      category: s.category,
      area,
      evidence: text.slice(at, at + 110).trim(),
      source: "dom",
    });
  }
}

/** One LLM read per area for features regexes can't name. */
async function llmFeatures(
  stagehand: Stagehand,
  area: string,
): Promise<FeatureSignal[]> {
  try {
    const r = await stagehand.extract(
      `List player-facing features visible on this screen for an iGaming benchmark. JSON only:
{ "features": [ { "name": "short canonical name (e.g. 'Missions', 'Live wins feed', 'Rakeback', 'VIP levels', 'Game search', 'Favourites', 'Recently played', 'Recommended for you', 'Wager races', 'Daily calendar', 'Bet builder', 'Cash out', 'Two-factor authentication', 'Sports → casino promo', 'Casino → sports promo')", "category": "Casino" | "Sports" | "Rewards" | "Engagement" | "Login" | "Support" | "Acquisition" | "Cross-sell" | "Other", "evidence": "the exact on-screen words that prove it (≤ 12 words)" } ] }
Only include things actually visible now. Max 12.`,
    );
    const raw = r.extraction;
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return [];
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      features?: { name?: string; category?: string; evidence?: string }[];
    };
    const cats = new Set<FeatureSignal["category"]>([
      "Casino",
      "Sports",
      "Rewards",
      "Engagement",
      "Login",
      "Support",
      "Acquisition",
      "Cross-sell",
      "Other",
    ]);
    return (parsed.features ?? [])
      .filter((f) => typeof f.name === "string" && f.name.trim())
      .slice(0, 12)
      .map((f) => ({
        name: f.name!.trim().slice(0, 40),
        category: cats.has(f.category as FeatureSignal["category"])
          ? (f.category as FeatureSignal["category"])
          : "Other",
        area,
        evidence: (f.evidence ?? "").toString().trim().slice(0, 120),
        source: "llm" as const,
      }));
  } catch {
    return [];
  }
}

function mergeSignals(
  into: Map<string, FeatureSignal>,
  extra: FeatureSignal[],
): void {
  for (const f of extra) {
    const key = f.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    const existing = [...into.keys()].find(
      (k) =>
        k
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim() === key,
    );
    if (existing) continue;
    into.set(f.name, f);
  }
}

/** Cross-sell prompt on the current screen for the *other* vertical. */
async function crossSellPrompt(
  page: ScanPage,
  toward: "casino" | "sports",
): Promise<string | null> {
  if (!page.evaluate) return null;
  const re =
    toward === "casino"
      ? /\b(casino|slots?|blackjack|roulette|live dealer|free spins?)\b/i
      : /\b(sports?|sportsbook|parlay|odds|bet on|nfl|nba|mlb|soccer|football)\b/i;
  try {
    const r = await page.evaluate(`(() => {
      ${VIS}
      const re = ${re.toString()};
      const cands = [...document.querySelectorAll("[class*='banner' i], [class*='promo' i], [class*='carousel' i] a, [class*='hero' i], [class*='card' i] a, a[class*='btn' i], button")].filter(vis);
      for (const el of cands) {
        const t = (el.innerText || "").replace(/\\s+/g, " ").trim();
        if (t.length >= 6 && t.length <= 140 && re.test(t)) return t;
      }
      return null;
    })()`);
    return typeof r === "string" ? r : null;
  } catch {
    return null;
  }
}

export async function runFeatureScan(args: {
  stagehand: Stagehand;
  page: ScanPage;
  tracker: JourneyStageTracker;
  brandUrl: string;
  /** Lobby read captured during play — reused so the lobby isn't re-walked. */
  lobby: LobbyFeatures | null;
  onShot?: (label: string) => Promise<string | null>;
  /** Public pages only — signup never completed. */
  loggedOut?: boolean;
}): Promise<BrandFeatureScan> {
  const { stagehand, page, tracker, brandUrl, onShot } = args;
  const signals = new Map<string, FeatureSignal>();
  const shots: string[] = [];
  const areaShots: { area: string; url: string }[] = [];
  const shot = async (label: string, area: string) => {
    if (!onShot) return;
    const url = await onShot(label);
    if (url) {
      shots.push(url);
      areaShots.push({ area, url });
    }
  };
  const scan: BrandFeatureScan = {
    scannedAt: new Date().toISOString(),
    navItems: [],
    casinoNavIndex: null,
    lobby: args.lobby,
    activityFeed: null,
    rewards: {
      areaFound: false,
      areaLabel: null,
      progressMeter: false,
      countdown: false,
      claimable: false,
      globallyVisible: false,
    },
    crossSell: { sportsToCasino: null, casinoToSports: null },
    login: { twoFactor: false, biometrics: false, social: false },
    features: [],
    screenshotUrls: [],
    areaShots: [],
    areasVisited: [],
    loggedOut: Boolean(args.loggedOut),
  };
  if (args.loggedOut) {
    tracker.push(
      "Feature scan is logged out — rewards progress and account screens may be hidden",
    );
  }

  tracker.push("Feature scan: reading navigation");
  let origin = brandUrl;
  try {
    origin = new URL(brandUrl).origin;
  } catch {
    /* keep as-is */
  }
  try {
    if (page.goto) {
      await page.goto(`${origin}/`, {
        waitUntil: "domcontentloaded",
        timeoutMs: 20000,
      });
      await page.waitForTimeout(2500);
    }
  } catch {
    /* scan what we can */
  }
  await dismissPopups(page);

  // —— Home: nav, rewards entry visible globally, activity feed ——
  scan.navItems = await readNavigation(page);
  const casinoIdx = scan.navItems.findIndex((t) => /^casino$/i.test(t));
  scan.casinoNavIndex = casinoIdx >= 0 ? casinoIdx + 1 : null;
  const homeText = await pageText(page);
  scanText(homeText, "home", signals);
  scan.rewards.globallyVisible =
    /\b(vip|rewards?|loyalty|rakeback|bonus(es)?|promos?|promotions?)\b/i.test(
      scan.navItems.join(" "),
    ) ||
    Boolean(
      await page
        .evaluate?.(
          `(() => { ${VIS} return [...document.querySelectorAll("header *, nav *")].filter(vis).some((el) => /crown|vip|reward|loyalty|trophy|gift/i.test((el.getAttribute("aria-label") || el.getAttribute("title") || el.className || "").toString())); })()`,
        )
        .catch(() => false),
    );
  scan.activityFeed = await readActivityFeed(page);
  if (scan.activityFeed) {
    signals.set("Activity feed", {
      name: "Activity feed",
      category: "Engagement",
      area: "home",
      evidence: scan.activityFeed,
      source: "dom",
    });
  }
  mergeSignals(signals, await llmFeatures(stagehand, "home"));
  await shot("Feature scan · home", "home");
  scan.areasVisited.push("home");
  tracker.push(
    `Nav: ${scan.navItems.slice(0, 8).join(" · ")}${scan.navItems.length > 8 ? ` +${scan.navItems.length - 8}` : ""}${
      scan.casinoNavIndex
        ? ` · Casino is item ${scan.casinoNavIndex}`
        : " · Casino not in nav"
    }`,
  );

  // —— Rewards / VIP / Promotions ——
  tracker.push("Feature scan: rewards & VIP");
  const REWARDS_VERIFY =
    /\b(vip|rewards?|loyalty|rakeback|cashback|tiers?|levels?|bonus(es)?|promotions?|missions?|challenges?|quests?)\b/i;
  const rewards = await openArea(
    page,
    /^(vip( rewards| club| program)?|rewards?( (hub|center|centre|club))?|loyalty( (program|club))?|rakeback|cashback|promos?|promotions|bonus(es)?|club|missions?|challenges?|quests?)$/i,
    ["/vip", "/rewards", "/loyalty", "/promotions", "/promos", "/bonuses"],
    {
      iconHint: ICON_HINTS.rewards,
      verify: REWARDS_VERIFY,
      llm: {
        stagehand,
        ask: "You are a player looking for the VIP, loyalty or rewards area. Open it: look for a crown, gift or trophy icon in the header, a 'VIP', 'Rewards', 'Loyalty', 'Rakeback' or 'Promotions' link, or the same inside the hamburger or account menu. Tap the single most likely control.",
      },
    },
  );
  const rewardsOpened = rewards.opened;
  if (rewards.via) tracker.push(`Rewards area opened (${rewards.via})`);
  if (rewardsOpened) {
    await dismissPopups(page);
    scan.rewards.areaFound = true;
    try {
      scan.rewards.areaLabel = page.url ? new URL(page.url()).pathname : null;
    } catch {
      scan.rewards.areaLabel = null;
    }
    const widgets = await readRewardWidgets(page);
    scan.rewards.progressMeter = widgets.progressMeter;
    scan.rewards.countdown = widgets.countdown;
    scan.rewards.claimable = widgets.claimable;
    const text = await pageText(page);
    scanText(text, "rewards", signals);
    if (!scan.activityFeed) scan.activityFeed = await readActivityFeed(page);
    mergeSignals(signals, await llmFeatures(stagehand, "rewards"));
    await shot("Feature scan · rewards", "rewards");
    scan.areasVisited.push("rewards");
    tracker.push(
      `Rewards: ${
        [
          widgets.progressMeter ? "progress meter" : null,
          widgets.claimable ? "claimable" : null,
          widgets.countdown ? "countdown" : null,
        ]
          .filter(Boolean)
          .join(" · ") || "no widgets detected"
      }`,
    );
  } else {
    tracker.push(
      "Rewards: no VIP / rewards area found via nav, header icons, menus or common paths",
    );
  }

  // —— Missions / challenges / races — engagement loops, often their own tab ——
  tracker.push("Feature scan: missions, challenges & races");
  const missions = await openArea(
    page,
    /^(missions?|challenges?|quests?|races?|leaderboards?|tournaments?|achievements?|rewards calendar|daily (bonus|rewards?|wheel|spin))$/i,
    [
      "/missions",
      "/challenges",
      "/quests",
      "/races",
      "/leaderboard",
      "/tournaments",
    ],
    {
      verify:
        /\b(missions?|challenges?|quests?|races?|leaderboards?|tournaments?|achievements?|streaks?|prize pool)\b/i,
      llm: {
        stagehand,
        ask: "You are a player looking for missions, challenges, quests, races or a leaderboard. If a link or menu item like that exists (check the hamburger menu and the casino sub-navigation too), tap it. Otherwise do nothing.",
      },
    },
  );
  if (missions.opened) {
    await dismissPopups(page);
    const text = await pageText(page);
    scanText(text, "missions", signals);
    const widgets = await readRewardWidgets(page);
    if (widgets.progressMeter) scan.rewards.progressMeter = true;
    if (widgets.countdown) scan.rewards.countdown = true;
    if (widgets.claimable) scan.rewards.claimable = true;
    mergeSignals(signals, await llmFeatures(stagehand, "missions"));
    await shot("Feature scan · missions", "missions");
    scan.areasVisited.push("missions");
    tracker.push(`Missions / races area opened (${missions.via})`);
  }

  // —— Casino lobby (cross-sell to sports + anything play missed) ——
  tracker.push("Feature scan: casino lobby");
  const casinoOpened = (
    await openArea(page, /^casino$/i, ["/casino", "/games"], {
      iconHint: ICON_HINTS.casino,
      verify:
        /\b(slots?|live casino|blackjack|roulette|jackpots?|providers?|originals|game shows?)\b/i,
      llm: {
        stagehand,
        ask: "Open the casino lobby — tap the 'Casino' tab in the header or bottom bar, or inside the hamburger menu.",
      },
    })
  ).opened;
  if (casinoOpened) {
    await dismissPopups(page);
    if (!scan.lobby || scan.lobby.gameTileCount === 0) {
      scan.lobby = await inspectLobby(page);
    }
    const text = await pageText(page);
    scanText(text, "casino", signals);
    scan.crossSell.casinoToSports = await crossSellPrompt(page, "sports");
    if (
      /\b(recommended|for you|picked for you|because you played)\b/i.test(text)
    ) {
      signals.set("Recommendations", {
        name: "Recommendations",
        category: "Casino",
        area: "casino",
        evidence:
          text.match(
            /.{0,30}\b(recommended|for you|picked for you|because you played)\b.{0,30}/i,
          )?.[0] ?? "",
        source: "dom",
      });
    }
    if (
      /\b(recently played|continue playing|last played|jump back in)\b/i.test(
        text,
      )
    ) {
      signals.set("Recently played", {
        name: "Recently played",
        category: "Casino",
        area: "casino",
        evidence:
          text.match(
            /.{0,30}\b(recently played|continue playing|last played|jump back in)\b.{0,30}/i,
          )?.[0] ?? "",
        source: "dom",
      });
    }
    mergeSignals(signals, await llmFeatures(stagehand, "casino"));
    await shot("Feature scan · casino", "casino");
    scan.areasVisited.push("casino");
  }

  // —— Sportsbook (cross-sell to casino) ——
  tracker.push("Feature scan: sportsbook");
  const sportsOpened = (
    await openArea(
      page,
      /^(sports|sportsbook|sports betting|live betting)$/i,
      ["/sportsbook", "/sports"],
      {
        iconHint: ICON_HINTS.sports,
        verify:
          /\b(odds|moneyline|spread|parlay|bet slip|live betting|football|soccer|nba|nfl|tennis)\b/i,
      },
    )
  ).opened;
  if (sportsOpened) {
    await dismissPopups(page);
    const text = await pageText(page);
    scanText(text, "sports", signals);
    scan.crossSell.sportsToCasino = await crossSellPrompt(page, "casino");
    await shot("Feature scan · sportsbook", "sports");
    scan.areasVisited.push("sports");
  }

  // —— Account / security (2FA, biometrics) ——
  tracker.push("Feature scan: account & security");
  const account = await openArea(
    page,
    /^(account|my account|profile|settings|security|wallet)$/i,
    [
      "/account/security",
      "/settings/security",
      "/account",
      "/profile",
      "/settings",
    ],
    {
      iconHint: ICON_HINTS.account,
      verify:
        /\b(profile|settings|security|password|email|balance|wallet|verification|kyc|refer|referral|logout|log out|sign out)\b/i,
      llm: {
        stagehand,
        ask: "Open your account area — tap the avatar / profile icon or the 'Account' / 'My Account' / 'Settings' item, including inside the hamburger menu.",
      },
    },
  );
  if (account.opened) {
    await dismissPopups(page);
    const accountText = await pageText(page);
    scanText(accountText, "account", signals);
    // Referral usually lives inside the account menu, not the main nav.
    const referral = await openArea(
      page,
      /^(refer( a)? friend|referral(s| program)?|invite( friends)?|affiliates?|earn|share & earn)$/i,
      ["/referral", "/refer", "/refer-a-friend", "/invite", "/affiliates"],
      {
        iconHint: ICON_HINTS.referral,
        verify:
          /\b(refer(ral)?|invite|affiliate|commission|your link|share (your|this) link)\b/i,
      },
    );
    if (referral.opened) {
      const text = await pageText(page);
      const m = text.match(
        /.{0,40}\b(refer(ral)?|invite|affiliate|commission)\b.{0,60}/i,
      );
      signals.set("Referral programme", {
        name: "Referral programme",
        category: "Acquisition",
        area: "account",
        evidence: (m?.[0] ?? `found via ${referral.via}`).trim(),
        source: "dom",
      });
      await shot("Feature scan · referral", "referral");
      scan.areasVisited.push("referral");
      tracker.push(`Referral programme found (${referral.via})`);
      // Back to account for the security read.
      await openArea(
        page,
        /^(account|my account|profile|settings)$/i,
        ["/account", "/profile", "/settings"],
        { iconHint: ICON_HINTS.account },
      );
    }
    // Security is often one level deeper.
    await openArea(
      page,
      /^(security|login & security|password & security|two[- ]factor|2fa)$/i,
      ["/account/security", "/settings/security"],
    );
    const text = `${accountText} ${await pageText(page)}`;
    scan.login.twoFactor = /\b(two[- ]factor|2fa|authenticator)\b/i.test(text);
    scan.login.biometrics =
      /\b(passkey|biometric|face id|touch id|fingerprint)\b/i.test(text);
    await shot("Feature scan · account", "account");
    scan.areasVisited.push("account");
  }
  scan.login.social = signals.has("Social / wallet login");

  scan.features = [...signals.values()];
  scan.screenshotUrls = shots;
  scan.areaShots = areaShots;
  tracker.push(
    `Feature scan done: ${scan.features.length} features across ${scan.areasVisited.length} areas`,
  );
  return scan;
}
