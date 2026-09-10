import type { Stagehand } from "@browserbasehq/stagehand";
import type { JourneyStageTracker } from "./stage-tracker";
import { pageIsWiderThanViewport } from "./capture-shot";
import { STAGE_OWNERS } from "./journeys";

type AgentPage = {
  waitForTimeout: (ms: number) => Promise<void>;
  evaluate?: (expr: string) => Promise<unknown>;
  url?: () => string;
  goto?: (
    url: string,
    opts?: { waitUntil?: "domcontentloaded"; timeoutMs?: number },
  ) => Promise<unknown>;
};

/** Are we actually in the casino (URL or a grid of game tiles), not the sportsbook home? */
async function inCasinoLobby(page: AgentPage): Promise<boolean> {
  try {
    const url = page.url?.() ?? "";
    if (/\/(casino|games|slots|live-casino|livecasino)(\/|\?|#|$)/i.test(url)) {
      return true;
    }
    const f = await inspectLobby(page);
    if (f.gameTileCount >= 8) return true;
    if (!page.evaluate) return false;
    const txt = String(
      await page.evaluate(
        "(document.body && document.body.innerText || '').slice(0, 6000).toLowerCase()",
      ),
    );
    const casinoWords = (
      txt.match(/slots?|blackjack|roulette|live dealer|jackpot|baccarat/g) ?? []
    ).length;
    const sportWords = (
      txt.match(/odds|spread|moneyline|parlay|nfl|mlb|nba|betting/g) ?? []
    ).length;
    return casinoWords >= 6 && casinoWords > sportWords * 2;
  } catch {
    return false;
  }
}

/** Close promo popups ("Got it", ×) that sit over the nav and eat the click. */
async function dismissPopups(page: AgentPage): Promise<boolean> {
  if (!page.evaluate) return false;
  try {
    const r = await page.evaluate(`(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const roots = [...document.querySelectorAll("[role=dialog], [aria-modal=true], [class*='modal' i], [class*='popup' i], [class*='overlay' i], [class*='lightbox' i]")].filter(vis);
      const re = /^(got it|close|dismiss|ok|okay|no thanks|not now|later|maybe later|×|x|✕|✖)$/i;
      for (const root of roots) {
        const btn = [...root.querySelectorAll("button, [role=button], a")].filter(vis).find((b) => {
          const t = (b.innerText || b.getAttribute("aria-label") || b.getAttribute("title") || "").replace(/\s+/g, " ").trim();
          return re.test(t) || /close|dismiss/i.test(b.getAttribute("aria-label") || "") || /\bclose\b/i.test(b.className || "");
        });
        if (btn) { btn.click(); return true; }
      }
      return false;
    })()`);
    return Boolean(r);
  } catch {
    return false;
  }
}

/**
 * Some post-login redirects land on a desktop-only app (BetOnline's
 * sportsbook: ~980px wide, no responsive layout). The player on a phone
 * would go back to the home screen, where the Sports / Casino tabs live.
 */
async function returnToMobileHome(
  page: AgentPage,
  tracker: JourneyStageTracker,
): Promise<boolean> {
  if (!page.goto || !page.url) return false;
  if (!(await pageIsWiderThanViewport(page))) return false;
  try {
    const origin = new URL(page.url()).origin;
    await page.goto(`${origin}/`, {
      waitUntil: "domcontentloaded",
      timeoutMs: 20000,
    });
    await tracker.wait(page, 2500, "casino_discovery");
    tracker.push(
      "Post-login screen was a desktop-only layout — went back to the mobile home for the nav tabs",
    );
    return true;
  } catch {
    return false;
  }
}

/** DOM-first: click the "Casino" entry in the top bar / hamburger menu. */
async function fastOpenCasino(page: AgentPage): Promise<boolean> {
  if (!page.evaluate) return false;
  try {
    const hit = await page.evaluate(`(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const els = [...document.querySelectorAll("a,button,[role=tab],[role=menuitem],[role=link]")].filter(vis);
      const pick = els.find((el) => /^\s*casino\s*$/i.test(el.textContent || "") && !/live/i.test(el.textContent || ""))
        || els.find((el) => /casino/i.test(el.getAttribute("href") || "") && /casino/i.test(el.textContent || ""))
        || els.find((el) => /^\s*(casino|games|slots)\s*$/i.test(el.textContent || ""));
      if (!pick) return false;
      pick.scrollIntoView({ block: "center" });
      pick.click();
      return true;
    })()`);
    return Boolean(hit);
  } catch {
    return false;
  }
}

/** What the casino lobby offers a new player — feeds the Feature benchmark. */
export interface LobbyFeatures {
  hasSearch: boolean;
  hasFavourites: boolean;
  /** Carousel / category row titles in lobby order (capped). */
  carousels: string[];
  categoryTabs: string[];
  providerFilter: boolean;
  gameTileCount: number;
}

/** Cheap DOM read of the lobby — no LLM. */
export async function inspectLobby(page: AgentPage): Promise<LobbyFeatures> {
  const empty: LobbyFeatures = {
    hasSearch: false,
    hasFavourites: false,
    carousels: [],
    categoryTabs: [],
    providerFilter: false,
    gameTileCount: 0,
  };
  if (!page.evaluate) return empty;
  try {
    const raw = await page.evaluate(`(() => {
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const txt = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
      const all = [...document.querySelectorAll("body *")].filter(vis);
      const hasSearch = all.some((el) =>
        (el.matches("input[type=search]") ||
          /search/i.test(el.getAttribute("placeholder") || "") ||
          /search/i.test(el.getAttribute("aria-label") || "") ||
          (el.matches("button,a") && /^search$/i.test(txt(el))))
      );
      const hasFavourites = all.some((el) =>
        /favou?rites?|my games|liked/i.test(
          txt(el).length < 40 ? txt(el) : "",
        ) || /favou?rite/i.test(el.getAttribute("aria-label") || ""),
      );
      const providerFilter = all.some((el) =>
        /^(providers?|game providers?|studios?)$/i.test(txt(el)) && txt(el).length < 30,
      );
      // Carousel titles: headings followed by a horizontally scrolling row of cards.
      const heads = [...document.querySelectorAll("h1,h2,h3,h4,[class*=title],[class*=heading]")]
        .filter(vis)
        .map(txt)
        .filter((t) => t.length > 1 && t.length < 40 && !/^(casino|home|menu|login|register|deposit)$/i.test(t));
      const carousels = [...new Set(heads)].slice(0, 12);
      const tabs = [...document.querySelectorAll("[role=tab],[role=tablist] a,[role=tablist] button,nav a,nav button")]
        .filter(vis)
        .map(txt)
        .filter((t) => t.length > 1 && t.length < 24);
      const categoryTabs = [...new Set(tabs)]
        .filter((t) => /slots?|live|table|popular|new|jackpot|crash|originals?|blackjack|roulette|top|hot|featured|all games|lobby/i.test(t))
        .slice(0, 12);
      const gameTileCount = document.querySelectorAll(
        "[class*=game-card],[class*=gameCard],[class*=game-tile],[class*=GameTile],[class*=game_card],a[href*='/game/'],a[href*='/games/'],a[href*='/casino/game'],a[href*='/slots/']",
      ).length;
      return { hasSearch, hasFavourites, carousels, categoryTabs, providerFilter, gameTileCount };
    })()`);
    const r = (raw ?? {}) as Partial<LobbyFeatures>;
    return {
      hasSearch: Boolean(r.hasSearch),
      hasFavourites: Boolean(r.hasFavourites),
      carousels: Array.isArray(r.carousels) ? r.carousels.slice(0, 12) : [],
      categoryTabs: Array.isArray(r.categoryTabs)
        ? r.categoryTabs.slice(0, 12)
        : [],
      providerFilter: Boolean(r.providerFilter),
      gameTileCount: Number(r.gameTileCount) || 0,
    };
  } catch {
    return empty;
  }
}

export function lobbyFeaturesSummary(f: LobbyFeatures): string {
  const parts = [
    f.hasSearch ? "search ✓" : "no search",
    f.hasFavourites ? "favourites ✓" : "no favourites",
    f.providerFilter ? "provider filter ✓" : null,
    f.carousels.length
      ? `${f.carousels.length} rows (${f.carousels.slice(0, 4).join(", ")}${f.carousels.length > 4 ? "…" : ""})`
      : "no carousels found",
    f.categoryTabs.length
      ? `tabs: ${f.categoryTabs.slice(0, 5).join(", ")}`
      : null,
    f.gameTileCount ? `${f.gameTileCount} tiles` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function parseCompleted(raw: string): { completed: boolean; message: string } {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as {
        completed?: boolean;
        message?: string;
      };
      return {
        completed: Boolean(parsed.completed),
        message: parsed.message ?? "",
      };
    }
  } catch {
    // fall through
  }
  return {
    completed: /yes|complete|success|spun|bet placed/i.test(raw),
    message: raw.slice(0, 120),
  };
}

/** Casino lobby → game launch → minimum first wager. */
export async function runCasinoPlayFlow(
  stagehand: Stagehand,
  page: AgentPage,
  tracker: JourneyStageTracker,
  opts: {
    /** false = zero balance (deposit skipped): explore + launch, don't score the wager. */
    funded: boolean;
    onShot?: (stageId: string, label: string) => Promise<void>;
  } = { funded: true },
): Promise<{ firstBetPlaced: boolean; lobby: LobbyFeatures | null }> {
  const shot = async (stageId: string, label: string) => {
    if (opts.onShot) await opts.onShot(stageId, label);
  };
  // —— Casino discovery ——
  tracker.begin("casino_discovery");
  tracker.push("Navigating to casino lobby");
  let clicks = 0;

  if (await dismissPopups(page)) {
    clicks += 1;
    tracker.push("Closed a promo popup covering the nav");
    await tracker.wait(page, 800, "casino_discovery");
  }
  if (await returnToMobileHome(page, tracker)) {
    clicks += 1;
    await dismissPopups(page);
  }

  // Top bar "Casino" first (mobile sites put it in the header tabs), then the
  // LLM, then a direct /casino URL — and verify we actually left the
  // sportsbook home each time.
  let lobbyOk = false;
  let navMisses = 0;
  if (await fastOpenCasino(page)) {
    clicks += 1;
    await tracker.wait(page, 3500, "casino_discovery");
    lobbyOk = await inCasinoLobby(page);
  }
  if (!lobbyOk) {
    navMisses += 1;
    const nav = await stagehand.act(
      "Open the CASINO section: tap Casino in the top navigation tabs or the menu — not Sports, Live Betting or Poker",
    );
    if (nav.success) clicks += 1;
    await tracker.wait(page, 3500, "casino_discovery");
    lobbyOk = await inCasinoLobby(page);
  }
  if (!lobbyOk && page.goto && page.url) {
    navMisses += 1;
    try {
      const origin = new URL(page.url()).origin;
      await page.goto(`${origin}/casino`, {
        waitUntil: "domcontentloaded",
        timeoutMs: 20000,
      });
      clicks += 1;
      await tracker.wait(page, 3500, "casino_discovery");
      lobbyOk = await inCasinoLobby(page);
    } catch {
      /* fall through */
    }
  }
  tracker.push(
    lobbyOk
      ? `Casino lobby open${navMisses ? ` (after ${navMisses} missed nav attempt${navMisses === 1 ? "" : "s"})` : ""}`
      : "Could not confirm casino lobby — recording the current screen",
  );
  await shot("casino_discovery", lobbyOk ? "Casino lobby" : "Where nav landed");

  // What does the lobby give a new player to find a game? (DOM, no LLM.)
  const lobby = await inspectLobby(page);
  tracker.push(`Lobby: ${lobbyFeaturesSummary(lobby)}`);

  const browse = await stagehand.act(
    "scroll the casino lobby so game tiles or categories are visible. Do not launch a game yet.",
  );
  if (browse.success) clicks += 1;
  await tracker.wait(page, 2000, "casino_discovery");
  await shot("casino_discovery", "Lobby rows");

  if (lobby.hasSearch) {
    const search = await stagehand.act(
      "Open the game search and type 'book' to see results. Do not launch a game.",
    );
    if (search.success) {
      clicks += 1;
      await tracker.wait(page, 2000, "casino_discovery");
      await shot("casino_discovery", "Search results");
      await stagehand
        .act("Close or clear the search so the lobby is visible again")
        .catch(() => {});
      await tracker.wait(page, 1000, "casino_discovery");
    }
  }

  const filter = await stagehand.act(
    "If category tabs exist (Slots, Live, Popular), click one to view games. Skip if already showing games.",
  );
  if (filter.success) clicks += 1;
  await tracker.wait(page, 2000, "casino_discovery");
  await shot("casino_discovery", "Category view");

  tracker.end("casino_discovery", {
    steps: clicks,
    owner: STAGE_OWNERS.casino_discovery,
    evidence: `${lobbyOk ? "Casino lobby" : "Casino not reached from home"} · ${lobbyFeaturesSummary(lobby)}`,
    friction: !lobbyOk
      ? "Casino entry not obvious from the post-deposit screen — needed several attempts to find the lobby"
      : navMisses > 0
        ? "Casino is buried in navigation — first tap did not open it"
        : !lobby.hasSearch && lobby.carousels.length === 0
          ? "Lobby has no search and no visible category rows — hard to find a game"
          : !lobby.hasSearch
            ? "No game search in the lobby"
            : undefined,
    severity: !lobbyOk
      ? "high"
      : navMisses > 0
        ? "medium"
        : !lobby.hasSearch && lobby.carousels.length === 0
          ? "high"
          : !lobby.hasSearch
            ? "medium"
            : null,
  });

  // —— Game launch ——
  tracker.begin("game_launch");
  tracker.push("Launching a casino game");
  clicks = 0;

  const pick = await stagehand.act(
    "click the first visible slot or casino game tile to launch it. Prefer a popular slot over live dealer.",
  );
  if (!pick.success) {
    tracker.end("game_launch", {
      steps: clicks,
      friction: "Could not launch a game from lobby",
      severity: "critical",
    });
    throw new Error("Could not launch a game");
  }
  clicks += 1;
  await tracker.wait(page, 6000, "game_launch");
  await shot("game_launch", "Game opened");

  // Zero balance: does the site block the launch, push a deposit, or offer demo?
  let launchNote = "";
  if (!opts.funded) {
    const gate = await stagehand
      .extract(
        "Looking at the screen after launching a game with a $0 balance: is the game actually loading/playable, or did the site show a prompt (insufficient funds, deposit now, demo/fun mode offer, KYC)? Return JSON only: { playable: boolean, prompt: string }",
      )
      .catch(() => null);
    if (gate) {
      try {
        const start = gate.extraction.indexOf("{");
        const end = gate.extraction.lastIndexOf("}");
        const parsed = JSON.parse(gate.extraction.slice(start, end + 1)) as {
          playable?: boolean;
          prompt?: string;
        };
        launchNote = parsed.prompt?.trim()
          ? `$0 balance: ${parsed.playable ? "game loads" : "blocked"} — “${parsed.prompt.trim().slice(0, 120)}”`
          : `$0 balance: ${parsed.playable ? "game loads without a deposit prompt" : "launch blocked"}`;
      } catch {
        /* keep empty */
      }
    }
    if (launchNote) tracker.push(launchNote);
  }

  const dismiss = await stagehand.act(
    "Dismiss any intro splash, age reminder, or fullscreen prompt so the game UI is playable",
  );
  if (dismiss.success) clicks += 1;
  await tracker.wait(page, 2000, "game_launch");
  await shot("game_launch", "Game ready");

  tracker.end("game_launch", {
    steps: clicks,
    owner: STAGE_OWNERS.game_launch,
    evidence: launchNote
      ? `Game shell open · ${launchNote}`
      : "Game shell open",
  });

  if (!opts.funded) {
    // No money on the account: record what a zero-balance wager attempt
    // shows (insufficient-funds nudge? deposit CTA?) without scoring it.
    tracker.begin("first_bet");
    tracker.push("Zero balance — trying one wager to see the site's response");
    await stagehand
      .act(
        "click Spin, Bet, Play, or Place bet once. If a deposit / insufficient funds prompt appears, leave it open.",
      )
      .catch(() => {});
    await tracker.wait(page, 4000, "first_bet");
    await shot("first_bet", "Wager attempt at $0");
    const resp = await stagehand
      .extract(
        "What did the site show when a wager was attempted with $0 balance? Return JSON only: { prompt: string, hasDepositCta: boolean }",
      )
      .catch(() => null);
    let note = "Not scored — no funds on account (deposit skipped)";
    if (resp) {
      try {
        const start = resp.extraction.indexOf("{");
        const end = resp.extraction.lastIndexOf("}");
        const parsed = JSON.parse(resp.extraction.slice(start, end + 1)) as {
          prompt?: string;
          hasDepositCta?: boolean;
        };
        if (parsed.prompt?.trim()) {
          note += ` · site showed “${parsed.prompt.trim().slice(0, 120)}”${
            parsed.hasDepositCta ? " with a Deposit CTA" : ""
          }`;
        }
      } catch {
        /* keep default */
      }
    }
    tracker.end("first_bet", {
      steps: 1,
      owner: STAGE_OWNERS.first_bet,
      evidence: note,
      severity: null,
    });
    return { firstBetPlaced: false, lobby };
  }

  // —— First bet ——
  tracker.begin("first_bet");
  tracker.push("Placing minimum first wager");
  clicks = 0;

  await stagehand
    .act(
      "If the game offers demo or play-for-fun mode, close it or switch to real-money play using account balance",
    )
    .catch(() => {});

  const minBet = await stagehand.act(
    "set the bet or stake to the minimum allowed amount using minus buttons or the smallest chip if visible",
  );
  if (minBet.success) clicks += 1;

  const spin = await stagehand.act(
    "click Spin, Bet, Play, or Place bet once to place a single minimum wager. Do not auto-spin or repeat.",
  );
  if (!spin.success) {
    tracker.end("first_bet", {
      steps: clicks,
      friction: "Could not place first wager",
      severity: "critical",
    });
    return { firstBetPlaced: false, lobby };
  }
  clicks += 1;
  await tracker.wait(page, 5000, "first_bet");
  await shot("first_bet", "Wager placed");

  const outcome = await stagehand.extract(
    "Did a spin or bet complete with real balance? Return JSON only: { completed: boolean, message: string }",
  );
  const parsed = parseCompleted(outcome.extraction);
  tracker.end("first_bet", {
    steps: clicks,
    owner: STAGE_OWNERS.first_bet,
    evidence: parsed.message || (parsed.completed ? "Wager placed" : "Unclear"),
    friction: parsed.completed
      ? undefined
      : "First wager may not have completed",
    severity: parsed.completed ? null : "high",
  });

  return { firstBetPlaced: parsed.completed, lobby };
}
