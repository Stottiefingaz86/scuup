import type { Stagehand } from "@browserbasehq/stagehand";
import type {
  EmailWatchItem,
  PlayerDestination,
  PostDepositEmail,
  PostDepositObservation,
} from "./types";

/**
 * Post-deposit research: the moment funds land, what does the brand do?
 * Redirect target, on-site alert, popup / cross-sell, guidance, emails and
 * where their links really resolve — then OKR conflicts raised from that.
 */

type InspectPage = {
  evaluate: (expr: string) => Promise<unknown>;
  waitForTimeout: (ms: number) => Promise<void>;
  frames?: () => { evaluate: (expr: string) => Promise<unknown> }[];
};

const DEPOSIT_SUCCESS_RE =
  /deposit (?:was )?(?:successful|received|complete|confirmed|approved)|funds? (?:have been |were |are )?(?:added|credited|received|available)|successfully deposited|your deposit of|start playing|credited to your|has been credited|payment (?:received|confirmed|successful)|balance (?:has been )?updated/i;

export interface PostDepositScreen {
  url: string;
  title: string;
  alertText: string | null;
  popup: {
    text: string;
    ctas: { label: string; href: string | null }[];
  } | null;
  ctas: { label: string; href: string | null }[];
  bodySnippet: string;
}

// "games" on its own is not casino — sportsbooks say "Popular Games" too.
const CASINO_RE =
  /casino|slots?|live[- ]?dealer|blackjack|roulette|baccarat|table games|jackpot|free spins?/i;
const SPORT_RE =
  /sport|sportsbook|odds|betting|bet slip|parlay|nfl|nba|soccer|football|racing|esports/i;
const CASHIER_RE = /cashier|deposit|wallet|banking|payment|fund/i;
const BONUS_RE =
  /bonus|promo|free spins?|welcome offer|reload|cashback|reward/i;
const ACCOUNT_RE = /account|profile|settings|verify|kyc|documents/i;

/**
 * What section is the player actually looking at? Every page's nav carries
 * both "Sports" and "Casino", so score page *content* — odds, spreads and
 * league names vs. game tiles and slot vocabulary — and only fall back to the
 * URL-based classifier when the content is ambiguous.
 */
export function classifyScreen(screen: {
  url: string;
  bodySnippet?: string | null;
}): PlayerDestination | null {
  let path = "";
  try {
    const u = new URL(screen.url);
    path = `${u.pathname}${u.search}${u.hash}`.toLowerCase();
  } catch {
    path = screen.url.toLowerCase();
  }
  if (
    /\/(sportsbook|sports|betting|live-betting|racebook)(\/|\?|#|$)/.test(path)
  ) {
    return "sportsbook";
  }
  if (/\/(casino|slots|live-casino|livecasino|games)(\/|\?|#|$)/.test(path)) {
    return "casino";
  }
  if (CASHIER_RE.test(path)) return "cashier";

  const body = (screen.bodySnippet ?? "").toLowerCase();
  const count = (re: RegExp) => (body.match(re) ?? []).length;
  const sport =
    count(/[+-]\d{3}\b/g) * 2 + // american odds
    count(
      /\b(spread|moneyline|money line|parlay|sgp|odds boost|bet slip|live betting|nfl|nba|mlb|nhl|mls|ncaa|ufc|mma|soccer|tennis|baseball|football|basketball|hockey|racing)\b/g,
    );
  const casino =
    count(
      /\b(slots?|blackjack|roulette|baccarat|live dealer|jackpots?|megaways|table games|video poker|keno|scratch)\b/g,
    ) + count(/\bplay (now|demo)\b/g);
  if (sport >= 4 && sport >= casino * 2) return "sportsbook";
  if (casino >= 4 && casino >= sport * 2) return "casino";
  if (sport >= 3 && casino >= 3) return "lobby";
  return classifyDestination(screen.url, screen.bodySnippet);
}

const SPORT_EVIDENCE_RE =
  /\b(sgps?|same game parlay|parlay|spread|moneyline|money line|odds boost|bet slip|betslip|live betting|nfl|nba|mlb|nhl|mls|ncaa|ufc|mma|soccer|football|baseball|basketball|hockey|racing|racebook)\b/gi;
const CASINO_EVIDENCE_RE =
  /\b(slots?|blackjack|roulette|baccarat|live dealer|live casino|jackpots?|megaways|table games|video poker|keno|scratch|free spins?|game providers?)\b/gi;

/**
 * Re-derive "landed on" from what an observation already recorded — URL path,
 * popup copy, CTA labels, guidance. Earlier runs stored a nav-word guess
 * ("Popular Games" → casino); the evidence usually says otherwise. Returns the
 * observation unchanged when the record has nothing better to go on.
 */
export function reconcilePostDeposit(
  obs: PostDepositObservation,
): PostDepositObservation {
  let path = "";
  try {
    if (obs.landingUrl) path = new URL(obs.landingUrl).pathname.toLowerCase();
  } catch {
    path = (obs.landingUrl ?? "").toLowerCase();
  }
  let landedOn: PlayerDestination | null = null;
  if (/\/(sportsbook|sports|betting|live-betting|racebook)(\/|$)/.test(path)) {
    landedOn = "sportsbook";
  } else if (/\/(casino|slots|live-casino|livecasino|games)(\/|$)/.test(path)) {
    landedOn = "casino";
  } else {
    const text = [
      obs.popup.text ?? "",
      obs.popup.cta ?? "",
      obs.guidance ?? "",
      ...(obs.ctas ?? []),
      obs.balanceAlert.text ?? "",
    ].join(" ");
    const sport = (text.match(SPORT_EVIDENCE_RE) ?? []).length;
    const casino = (text.match(CASINO_EVIDENCE_RE) ?? []).length;
    if (sport >= 2 && sport > casino) landedOn = "sportsbook";
    else if (casino >= 2 && casino > sport) landedOn = "casino";
  }
  const startPlaying = /start playing/i.test(
    `${obs.popup.cta ?? ""} ${obs.guidance ?? ""}`,
  );
  const guidedTo = startPlaying ? "sportsbook" : obs.guidedTo;
  const ctaTarget = startPlaying ? "sportsbook" : obs.popup.ctaTarget;
  const guidance = startPlaying
    ? "Start playing opens sports"
    : obs.guidance;
  const popup =
    startPlaying && obs.popup.ctaTarget !== "sportsbook"
      ? { ...obs.popup, ctaTarget: "sportsbook" as const }
      : obs.popup;

  if (
    (!landedOn || landedOn === obs.landedOn) &&
    guidedTo === obs.guidedTo &&
    ctaTarget === obs.popup.ctaTarget &&
    guidance === obs.guidance
  ) {
    return obs;
  }
  const { okrFlags: _drop, ...rest } = obs;
  void _drop;
  const next = {
    ...rest,
    ...(landedOn ? { landedOn } : {}),
    guidedTo,
    guidance,
    popup,
  };
  return { ...next, okrFlags: postDepositOkrFlags(next) };
}

/** Classify a URL (path + query) and/or nearby text into a player destination. */
export function classifyDestination(
  url: string | null | undefined,
  text?: string | null,
): PlayerDestination | null {
  let path = "";
  let isRoot = false;
  if (url) {
    try {
      const u = new URL(url);
      path = `${u.pathname} ${u.search} ${u.hash}`.toLowerCase();
      isRoot = u.pathname === "/" || u.pathname === "";
    } catch {
      path = url.toLowerCase();
    }
  }
  const hay = `${path} ${text ?? ""}`.trim();
  if (!hay) return null;
  // Path is the strongest signal — check it alone first.
  if (path) {
    if (CASHIER_RE.test(path)) return "cashier";
    if (SPORT_RE.test(path)) return "sportsbook";
    if (CASINO_RE.test(path)) return "casino";
    if (BONUS_RE.test(path)) return "bonus";
    if (ACCOUNT_RE.test(path)) return "account";
  }
  if (text) {
    if (SPORT_RE.test(text) && !CASINO_RE.test(text)) return "sportsbook";
    if (CASINO_RE.test(text) && !SPORT_RE.test(text)) return "casino";
    if (BONUS_RE.test(text)) return "bonus";
    if (CASHIER_RE.test(text)) return "cashier";
    if (SPORT_RE.test(text) && CASINO_RE.test(text)) return "lobby";
  }
  if (isRoot) return "lobby";
  return url ? "other" : null;
}

/**
 * Cheap DOM read of the current screen: success toast, open modal + its CTAs,
 * visible primary CTAs. No LLM — safe to call every confirmation pass.
 */
export async function inspectPostDepositScreen(
  page: InspectPage,
): Promise<PostDepositScreen | null> {
  try {
    const raw = await page.evaluate(`(() => {
      const vis = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return false;
        const cs = getComputedStyle(el);
        return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
      };
      const clean = (s) => String(s || "").replace(/\\s+/g, " ").trim();
      const ctaOf = (root) => {
        const out = [];
        const seen = new Set();
        for (const el of root.querySelectorAll("a, button, [role='button']")) {
          if (!vis(el)) continue;
          const label = clean(el.innerText || el.getAttribute("aria-label") || "");
          if (!label || label.length > 48 || seen.has(label.toLowerCase())) continue;
          seen.add(label.toLowerCase());
          const href = el instanceof HTMLAnchorElement && el.href && !/^javascript:/i.test(el.href) ? el.href : null;
          out.push({ label, href });
          if (out.length >= 12) break;
        }
        return out;
      };

      const alertRe = /deposit (?:was )?(?:successful|received|complete|confirmed|approved)|funds? (?:have been |were |are )?(?:added|credited|received|available)|balance (?:has been )?updated|payment (?:received|confirmed|successful)|credited to your|has been credited|successfully deposited|your deposit of|start playing/i;
      let alertText = null;
      const alertNodes = document.querySelectorAll(
        "[role='alert'], [role='status'], [class*='toast' i], [class*='snackbar' i], [class*='notification' i], [class*='alert' i], [class*='banner' i], [class*='success' i]"
      );
      for (const el of alertNodes) {
        if (!vis(el)) continue;
        const t = clean(el.innerText).slice(0, 240);
        if (t && alertRe.test(t)) { alertText = t; break; }
      }
      if (!alertText) {
        const body = clean(document.body && document.body.innerText).slice(0, 12000);
        const m = body.match(alertRe);
        if (m) {
          const i = body.indexOf(m[0]);
          alertText = body.slice(Math.max(0, i - 40), i + 160);
        }
      }

      let popup = null;
      const modals = document.querySelectorAll(
        "[role='dialog'], [aria-modal='true'], [class*='modal' i], [class*='popup' i], [class*='dialog' i], [class*='overlay' i] > div, [class*='drawer' i]"
      );
      for (const el of modals) {
        if (!vis(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 200 || r.height < 120) continue;
        const text = clean(el.innerText).slice(0, 600);
        if (text.length < 12) continue;
        popup = { text, ctas: ctaOf(el) };
        break;
      }

      return {
        url: location.href,
        title: document.title,
        alertText,
        popup,
        ctas: ctaOf(document.body),
        bodySnippet: clean(document.body && document.body.innerText).slice(0, 1200),
      };
    })()`);
    if (!raw || typeof raw !== "object") return null;
    return raw as PostDepositScreen;
  } catch {
    return null;
  }
}

/**
 * Header balance as the player sees it ("$0.00", "0.00000000 BTC"). Cheap DOM
 * read so the deposit watch can poll it every few seconds without an LLM.
 */
export async function readHeaderBalance(
  page: InspectPage,
): Promise<string | null> {
  try {
    const raw = await page.evaluate(`(() => {
      const vis = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8 || r.top > 160) return false;
        const cs = getComputedStyle(el);
        return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
      };
      const moneyRe = /^(?:[A-Z]{0,4}[\\$€£¥₿]\\s?\\d[\\d,]*(?:\\.\\d{1,8})?|\\d[\\d,]*(?:\\.\\d{1,8})?\\s?(?:usd|eur|cad|gbp|btc|usdt|usdc|eth|\\$|€|£))$/i;
      const junk = /min(?:imum)?|need help|trusted/i;
      const hinted = [...document.querySelectorAll("[class*='balance' i], [data-testid*='balance' i], [aria-label*='balance' i]")]
        .filter(vis)
        .map((el) => (el.innerText || "").replace(/\\s+/g, " ").trim())
        .find((t) => t && t.length <= 24 && /\\d/.test(t) && !junk.test(t));
      if (hinted) return hinted;
      for (const el of document.querySelectorAll("button, a, div, span, p")) {
        if (!vis(el)) continue;
        const t = (el.innerText || "").replace(/\\s+/g, " ").trim();
        const around = ((el.parentElement && el.parentElement.innerText) || "").replace(/\\s+/g, " ");
        if (junk.test(t) || /min(?:imum)?\\s*\\d/i.test(around)) continue;
        if (t.length <= 20 && moneyRe.test(t)) return t;
      }
      return null;
    })()`);
    return typeof raw === "string" && raw ? raw : null;
  } catch {
    return null;
  }
}

/** Cashier "Min 10 USD" is not a wallet balance. */
export function looksLikeMinimumDepositLabel(
  text: string | null | undefined,
): boolean {
  return /min(?:imum)?/i.test((text ?? "").trim());
}

/**
 * Full-page deposit success ("Your deposit was successful", Start playing).
 * Reads the active page plus same-origin frames — cashiers often sit in iframes.
 */
export async function pageLooksLikeDepositSuccess(
  page: InspectPage,
): Promise<{ ok: boolean; text: string | null }> {
  const fromScreen = (raw: string | null | undefined) => {
    const t = (raw ?? "").replace(/\s+/g, " ").trim();
    if (!t || !DEPOSIT_SUCCESS_RE.test(t)) return null;
    const m = t.match(DEPOSIT_SUCCESS_RE);
    return (m?.[0] ?? t).slice(0, 160);
  };
  try {
    const screen = await inspectPostDepositScreen(page);
    const hit =
      fromScreen(screen?.alertText) ||
      fromScreen(screen?.popup?.text) ||
      fromScreen(screen?.bodySnippet) ||
      fromScreen(screen?.ctas.map((c) => c.label).join(" "));
    if (hit) return { ok: true, text: hit };
    const frames = page.frames?.() ?? [];
    for (const frame of frames) {
      try {
        const t = await frame.evaluate(
          `(document.body && document.body.innerText || "").slice(0, 4000)`,
        );
        const framed = fromScreen(typeof t === "string" ? t : null);
        if (framed) return { ok: true, text: framed };
      } catch {
        /* cross-origin */
      }
    }
  } catch {
    /* keep going */
  }
  return { ok: false, text: null };
}

/** "$0.00" / "0.00000000 BTC" → true when the visible figure is zero. */
export function balanceIsZero(text: string | null | undefined): boolean {
  if (!text) return true;
  const n = parseFloat(text.replace(/[^\d.]/g, ""));
  return !Number.isFinite(n) || n === 0;
}

/** Winna-style header: "T$0.00" is Tether, not the BTC wallet we just funded. */
export function headerLooksLikeTether(text: string | null | undefined): boolean {
  return /tether|^t\s?\$|usdt/i.test((text ?? "").trim());
}

export function headerLooksLikeBitcoin(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  return /btc|bitcoin|₿/i.test(t) && !headerLooksLikeTether(t);
}

export type DisplayCurrencySwitch = {
  needed: boolean;
  switched: boolean;
  from: string | null;
  to: string | null;
};

/**
 * Open the header balance dropdown and pick Bitcoin. Winna defaults the
 * chip to Tether — a BTC credit stays invisible until the player switches.
 * Never clicks chat or the wallet/cashier chip.
 */
export async function selectBitcoinDisplayCurrency(
  page: InspectPage,
): Promise<DisplayCurrencySwitch> {
  const none: DisplayCurrencySwitch = {
    needed: false,
    switched: false,
    from: null,
    to: null,
  };
  try {
    const opened = (await page.evaluate(`(() => {
      const vis = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 16 || r.height < 12 || r.top > 150) return false;
        const cs = getComputedStyle(el);
        return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
      };
      const txt = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
      const moneyish = (t) =>
        /^(?:[A-Z]{0,4}[\\$€£¥₿]\\s?\\d|\\d[\\d.]*(?:\\s?(?:btc|usdt|usd))?)/i.test(t) && t.length <= 28;
      const header = [...document.querySelectorAll("button, a, [role='button'], div")]
        .filter((el) => vis(el) && el.getBoundingClientRect().top < 140);
      let best = null;
      let from = null;
      for (const el of header) {
        const t = txt(el).replace(/[v▼▾⌄˅].*$/, "").trim();
        if (!t || !moneyish(t)) continue;
        const hint = [el.getAttribute("aria-label"), el.getAttribute("title"), el.className]
          .map((v) => String(v || "")).join(" ");
        const dropdown = Boolean(el.getAttribute("aria-haspopup") || el.hasAttribute("aria-expanded")
          || /dropdown|chevron|caret|currency|wallet|balance/i.test(hint + t));
        if (/tether|^t\\s?\\$|usdt/i.test(t) || dropdown) {
          best = el;
          from = t;
          if (/tether|^t\\s?\\$|usdt/i.test(t)) break;
        }
      }
      if (!best || !from) return { from: null, clicked: false, alreadyBtc: false };
      if (/btc|bitcoin|₿/i.test(from) && !/tether|usdt|^t\\s?\\$/i.test(from)) {
        return { from, clicked: false, alreadyBtc: true };
      }
      const needed = /tether|^t\\s?\\$|usdt/i.test(from) || Boolean(best.getAttribute("aria-haspopup"));
      if (!needed) return { from, clicked: false, alreadyBtc: false };
      best.click();
      return { from, clicked: true, alreadyBtc: false };
    })()`)) as {
      from: string | null;
      clicked: boolean;
      alreadyBtc: boolean;
    } | null;
    if (!opened?.from) return none;
    if (opened.alreadyBtc) {
      return { needed: false, switched: false, from: opened.from, to: opened.from };
    }
    if (!opened.clicked) {
      return {
        needed: headerLooksLikeTether(opened.from),
        switched: false,
        from: opened.from,
        to: null,
      };
    }
    await page.waitForTimeout(700);
    const picked = (await page.evaluate(`(() => {
      const vis = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 24 || r.height < 16) return false;
        const cs = getComputedStyle(el);
        return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
      };
      const nodes = [...document.querySelectorAll("button, a, [role='option'], [role='menuitem'], li, div, span")];
      for (const el of nodes) {
        if (!vis(el)) continue;
        const t = (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
        if (!t || t.length > 48) continue;
        if (/^bitcoin\\b|\\bbtc\\b/i.test(t) && !/tether|usdt|eth|ltc|sol|card/i.test(t)) {
          el.click();
          return t.slice(0, 40);
        }
      }
      return null;
    })()`)) as string | null;
    if (picked) await page.waitForTimeout(800);
    const after = await readHeaderBalance(page);
    return {
      needed: true,
      switched: Boolean(picked) || headerLooksLikeBitcoin(after),
      from: opened.from,
      to: after ?? picked,
    };
  } catch {
    return none;
  }
}

/**
 * After the human sends BTC, most cashiers want a "I've completed the
 * payment" / "I have paid" click before they start watching the chain.
 * DOM first (exact phrasing), no LLM guessing at buttons that move money.
 */
export async function clickPaymentSentButton(
  page: InspectPage,
): Promise<string | null> {
  try {
    const raw = await page.evaluate(`(() => {
      const vis = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 40 || r.height < 20) return false;
        const cs = getComputedStyle(el);
        return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
      };
      const re = /^(i'?ve? (have )?(completed|paid|sent|made)( the)?( payment| transfer| deposit)?|i have (paid|sent|completed)( the)?( payment| transfer| deposit)?|payment (sent|made|completed|done)|mark as paid|i sent (it|the (btc|bitcoin|funds|payment))|sent|done|complete(d)?|confirm (payment|transfer|deposit)|check (payment|status)|i'?ve? transferred)$/i;
      for (const el of document.querySelectorAll("button, a, [role='button'], input[type='submit']")) {
        if (!vis(el)) continue;
        const t = (el.innerText || el.value || el.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
        if (t && t.length <= 48 && re.test(t) && !/cancel|back|close/i.test(t)) {
          el.click();
          return t;
        }
      }
      return null;
    })()`);
    return typeof raw === "string" && raw ? raw : null;
  } catch {
    return null;
  }
}

export type ChainStatus = "none" | "mempool" | "confirmed";

/**
 * Has anything actually been sent to the deposit address? Public mempool.space
 * lookup — keeps the report fair when the transfer is still stuck on the
 * sender's side (bank KYC, exchange withdrawal queue) rather than the brand's.
 */
export async function checkBtcAddressOnChain(
  address: string,
): Promise<ChainStatus | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(
      `https://mempool.space/api/address/${encodeURIComponent(address)}`,
      { signal: ctrl.signal, headers: { accept: "application/json" } },
    ).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const j = (await res.json()) as {
      chain_stats?: { funded_txo_count?: number };
      mempool_stats?: { funded_txo_count?: number };
    };
    if ((j.chain_stats?.funded_txo_count ?? 0) > 0) return "confirmed";
    if ((j.mempool_stats?.funded_txo_count ?? 0) > 0) return "mempool";
    return "none";
  } catch {
    return null;
  }
}

export function chainStatusLabel(s: ChainStatus | null | undefined): string {
  switch (s) {
    case "none":
      return "nothing sent on-chain yet";
    case "mempool":
      return "broadcast, awaiting confirmation";
    case "confirmed":
      return "confirmed on-chain";
    default:
      return "chain not checked";
  }
}

/** One LLM pass: what is the site telling the player to do next? */
export async function describeNextStepGuidance(
  stagehand: Stagehand,
): Promise<{ guidance: string | null; routedTo: PlayerDestination | null }> {
  try {
    const r = await stagehand.extract(
      `The player has just deposited. Answer with JSON only:
{ "guidance": "one sentence — what this screen tells or nudges the player to do next (e.g. 'Claim 100% bonus', 'Bet on NFL', 'Play slots', or 'nothing — left on cashier')", "routedTo": "casino" | "sportsbook" | "cashier" | "bonus" | "account" | "lobby" | "other" }
routedTo is the product area this screen is about.`,
    );
    const raw = r.extraction;
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return { guidance: null, routedTo: null };
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      guidance?: string;
      routedTo?: string;
    };
    const routed = String(parsed.routedTo ?? "").toLowerCase();
    const allowed: PlayerDestination[] = [
      "casino",
      "sportsbook",
      "cashier",
      "bonus",
      "account",
      "lobby",
      "other",
    ];
    return {
      guidance:
        typeof parsed.guidance === "string" && parsed.guidance.trim()
          ? parsed.guidance.trim().slice(0, 200)
          : null,
      routedTo: (allowed as string[]).includes(routed)
        ? (routed as PlayerDestination)
        : null,
    };
  } catch {
    return { guidance: null, routedTo: null };
  }
}

const IGNORE_LINK_RE =
  /unsubscribe|privacy|terms|preferences|facebook|twitter|instagram|youtube|tiktok|apple\.com|play\.google|mailto:|\.(png|jpe?g|gif|svg|webp)(\?|$)|list-manage|responsible|gamcare|begambleaware|18\+/i;

/** Follow redirects (tracking → real page) so we know where the email really sends the player. */
export async function resolveEmailLink(
  url: string,
  maxHops = 6,
): Promise<string> {
  let current = url;
  for (let hop = 0; hop < maxHops; hop++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: ctrl.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          accept: "text/html,*/*",
        },
      }).finally(() => clearTimeout(timer));
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        current = new URL(loc, current).toString();
        continue;
      }
      // Some trackers redirect via meta refresh / JS — sniff the first bytes.
      if (res.ok) {
        const text = (await res.text().catch(() => "")).slice(0, 6000);
        const meta = text.match(
          /http-equiv=["']?refresh["']?[^>]*url=([^"'>\s]+)/i,
        );
        const js = text.match(
          /(?:location\.(?:href|replace)\s*[=(]\s*|window\.location\s*=\s*)["']([^"']+)["']/i,
        );
        const next = meta?.[1] ?? js?.[1];
        if (next) {
          current = new URL(next, current).toString();
          continue;
        }
      }
      break;
    } catch {
      break;
    }
  }
  return current;
}

function brandHost(brandUrl: string): string {
  try {
    return new URL(brandUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Build the email side of the post-deposit picture from the run's inbox. */
export async function summarizePostDepositEmails(
  emails: EmailWatchItem[],
  paidAt: Date,
  brandUrl: string,
): Promise<PostDepositEmail[]> {
  const host = brandHost(brandUrl);
  const since = paidAt.getTime() - 30_000;
  const after = emails
    .filter((e) => new Date(e.receivedAt).getTime() >= since)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
    .slice(0, 6);

  const out: PostDepositEmail[] = [];
  for (const e of after) {
    const links = (e.links ?? []).filter((l) => !IGNORE_LINK_RE.test(l));
    // Prefer a link on the brand's own domain, else the first CTA-ish link.
    const brandLink =
      links.find((l) => {
        try {
          return new URL(l).hostname.replace(/^www\./, "").endsWith(host);
        } catch {
          return false;
        }
      }) ?? null;
    const primary = brandLink ?? links[0] ?? null;
    let resolved: string | null = null;
    if (primary) {
      resolved = await resolveEmailLink(primary).catch(() => primary);
    }
    out.push({
      subject: e.subject,
      from: e.from,
      receivedAfterSec: Math.max(
        0,
        Math.round(
          (new Date(e.receivedAt).getTime() - paidAt.getTime()) / 1000,
        ),
      ),
      primaryLink: primary,
      resolvedUrl: resolved,
      linkTarget: resolved
        ? classifyDestination(resolved, `${e.subject} ${e.summary ?? ""}`)
        : null,
    });
  }
  return out;
}

const DEST_LABEL: Record<PlayerDestination, string> = {
  casino: "casino",
  sportsbook: "sportsbook",
  cashier: "cashier",
  bonus: "bonus / promo",
  account: "account",
  lobby: "lobby",
  other: "other",
};

export function destinationLabel(d: PlayerDestination | null | undefined) {
  return d ? DEST_LABEL[d] : "—";
}

/**
 * OKR lens. Product OKRs are casino-led (Time to stake = deposit → first
 * casino stake; NR per player; distinct games). Anything that routes a fresh
 * deposit away from casino, or leaves the player with no next step, is a flag.
 */
export function postDepositOkrFlags(
  obs: Omit<PostDepositObservation, "okrFlags">,
): string[] {
  const flags: string[] = [];
  const to = obs.guidedTo ?? obs.popup.ctaTarget ?? obs.landedOn;

  if (to === "sportsbook") {
    flags.push(
      "Routes the fresh deposit to sportsbook — works against casino Time to stake (≤12 min) and casino NR per player",
    );
  } else if (to === "cashier") {
    flags.push(
      "Player left in the cashier after funds land — no push into play; adds clicks to Time to stake",
    );
  } else if (to === "account" || to === "other") {
    flags.push(
      "Post-deposit screen is not a play surface — player must find casino themselves",
    );
  }

  if (!obs.balanceAlert.seen) {
    flags.push(
      "No on-site confirmation that funds landed — player has to check balance manually (reassure gap)",
    );
  }
  if (!obs.popup.seen && !obs.guidance) {
    flags.push(
      "No next-step guidance after deposit (no popup, no prompt) — activation left to chance",
    );
  }
  if (obs.popup.seen && obs.popup.ctaTarget === "bonus") {
    flags.push(
      "Bonus upsell shown before first stake — check it doesn't delay Time to stake",
    );
  }
  if (obs.emails.length === 0) {
    flags.push(
      "No deposit confirmation email within the confirmation window — CRM reassurance gap",
    );
  } else {
    const toSport = obs.emails.filter((e) => e.linkTarget === "sportsbook");
    if (toSport.length) {
      flags.push(
        `Deposit email link(s) resolve to sportsbook (${toSport
          .map((e) => e.subject.slice(0, 40))
          .join("; ")}) — CRM pulls casino deposit to sports`,
      );
    }
    const toCasino = obs.emails.filter((e) => e.linkTarget === "casino");
    if (!toSport.length && !toCasino.length) {
      flags.push(
        "Deposit email has no direct 'play now' casino link — missed re-entry into play",
      );
    }
  }
  return flags;
}
