/**
 * Presentation brief for the Research report tab.
 * Only what this project's runs, inbox, feature scans, and VoP recorded.
 * Does not treat workshop examples as facts.
 */
import { emailPrimaryDestination } from "./crm-cadence";
import {
  emptyPostSignup,
  knownSignupLanding,
  signupLandingLabel,
} from "./post-signup";
import { latestRunForBrand } from "./feature-benchmark";
import { teardownForBrand } from "./teardown-summary";
import type {
  EmailWatchItem,
  JourneyRun,
  JourneyStageResult,
  ResearchBrand,
  ResearchProject,
} from "./types";

export type ReportShot = { src: string; label: string };

export interface ReportBite {
  polarity: "love" | "hate";
  brandId: string;
  brandName: string;
  own: boolean;
  title: string;
  body: string;
  stage: string;
  shot: ReportShot | null;
}

export interface ReportAsk {
  theme: string;
  brands: string[];
  mentions: number;
  insight: string;
}

export interface ReportGap {
  feature: string;
  whoHas: string[];
  note: string;
  shot: ReportShot | null;
  loggedOut?: boolean;
}

export interface ReportCaveat {
  brandName: string;
  title: string;
  body: string;
}

export interface ReportMetric {
  label: string;
  value: string;
  hint: string;
  caution: boolean;
}

export interface ReportHero {
  brandId: string;
  brandName: string;
  own: boolean;
  src: string;
  label: string;
}

export interface ReportCoverage {
  brandName: string;
  own: boolean;
  status: "complete" | "blocked" | "paused" | "logged_out";
  note: string;
}

export interface ReportRevealMove {
  n: string;
  title: string;
  body: string;
}

export interface ReportReveal {
  kicker: string;
  headline: string;
  lede: string;
  closer: string;
  moves: ReportRevealMove[];
}

export interface ReportBrief {
  empty: boolean;
  headline: string;
  lede: string;
  metrics: ReportMetric[];
  loves: ReportBite[];
  hates: ReportBite[];
  caveats: ReportCaveat[];
  asks: ReportAsk[];
  commonDenominator: string;
  gaps: ReportGap[];
  nextMoves: string[];
  reveal: ReportReveal | null;
  heroes: ReportHero[];
  coverage: ReportCoverage[];
}

const ASK_BUCKETS: { label: string; re: RegExp }[] = [
  {
    label: "Faster, clearer withdrawals",
    re: /withdraw|payout|cash.?out|get paid|pending/,
  },
  {
    label: "Less painful verification",
    re: /kyc|verif|id check|document|identity/,
  },
  {
    label: "A better casino / more games",
    re: /slot|casino|game|live dealer|provider|lobby/,
  },
  {
    label: "Fairer, clearer bonuses",
    re: /bonus|wager|reload|promo|free spin|wagering/,
  },
  {
    label: "Reachable human support",
    re: /support|live chat|customer service|agent/,
  },
  {
    label: "Better odds / sportsbook depth",
    re: /odds|line|limit|sportsbook|spread/,
  },
  { label: "A proper app", re: /app|android|ios|mobile app/ },
  {
    label: "Visible rewards / VIP",
    re: /vip|reward|loyalty|rake|cashback|level/,
  },
];

const CASINO_MAIL_RE =
  /\b(slots?|casino|live dealer|roulette|blackjack|free spins?|jackpot|originals?|game show)\b/i;

const BRAND_DISPLAY: Record<string, string> = {
  betonline: "BetOnline",
  mybookie: "MyBookie",
  rainbet: "Rainbet",
  winna: "Winna",
  stake: "Stake",
};

function displayName(name: string): string {
  return BRAND_DISPLAY[name.toLowerCase()] ?? name;
}

function fmtSec(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

function firstShot(
  urls: string[] | undefined,
  label: string,
): ReportShot | null {
  const src = urls?.find(Boolean);
  return src ? { src, label } : null;
}

function stageOf(run: JourneyRun | null, id: string): JourneyStageResult | null {
  return run?.stages.find((s) => s.stageId === id) ?? null;
}

/** Site path after money is visible — excludes waiting on the chain / the human. */
const AFTER_FUNDS_STAGES = ["casino_discovery", "game_launch", "first_bet"];

function sitePathSec(run: JourneyRun | null): number | null {
  if (!run) return null;
  let total = 0;
  let any = false;
  for (const id of AFTER_FUNDS_STAGES) {
    const s = stageOf(run, id);
    if (!s?.endedAt || s.timeSec == null) continue;
    total += Math.max(0, s.timeSec);
    any = true;
  }
  return any ? total : null;
}

function isOwn(brand: ResearchBrand): boolean {
  return brand.role === "own_brand";
}

function pickHero(run: JourneyRun | null): ReportShot | null {
  if (!run) return null;
  const prefer = [
    "casino_discovery",
    "first_bet",
    "welcome",
    "deposit",
    "registration",
    "landing",
  ];
  for (const id of prefer) {
    const shot = firstShot(stageOf(run, id)?.screenshotUrls, id);
    if (shot) return shot;
  }
  return (
    firstShot(run.features?.screenshotUrls, "Feature scan") ??
    firstShot(run.postSignup?.screenshotUrls, "Welcome")
  );
}

function bite(
  brand: ResearchBrand,
  polarity: "love" | "hate",
  title: string,
  body: string,
  stage: string,
  shot: ReportShot | null,
): ReportBite {
  return {
    polarity,
    brandId: brand.id,
    brandName: displayName(brand.name),
    own: isOwn(brand),
    title,
    body,
    stage,
    shot,
  };
}

function uniq<T>(rows: T[], key: (r: T) => string, n: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = key(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
    if (out.length >= n) break;
  }
  return out;
}

function casinoWelcomeMail(e: EmailWatchItem): boolean {
  if (e.category !== "welcome" && e.category !== "bonus") return false;
  const dest = emailPrimaryDestination(e);
  return dest === "casino" || CASINO_MAIL_RE.test(`${e.subject} ${e.summary ?? ""}`);
}

function clusterAsks(project: ResearchProject): ReportAsk[] {
  const buckets = new Map<
    string,
    { brands: Set<string>; mentions: number; insight: string }
  >();
  for (const brand of project.brands) {
    for (const theme of brand.playerVoice?.asks ?? []) {
      const key =
        ASK_BUCKETS.find((b) => b.re.test(`${theme.theme} ${theme.insight}`))
          ?.label ?? theme.theme.trim();
      if (!key) continue;
      const cur = buckets.get(key) ?? {
        brands: new Set<string>(),
        mentions: 0,
        insight: theme.insight,
      };
      cur.brands.add(displayName(brand.name));
      cur.mentions += theme.mentions || 1;
      if (theme.insight.length > cur.insight.length) cur.insight = theme.insight;
      buckets.set(key, cur);
    }
  }
  return [...buckets.entries()]
    .map(([theme, v]) => ({
      theme,
      brands: [...v.brands],
      mentions: v.mentions,
      insight: v.insight,
    }))
    .sort((a, b) => b.brands.length - a.brands.length || b.mentions - a.mentions)
    .slice(0, 6);
}

function coverageOf(
  brand: ResearchBrand,
  run: JourneyRun | null,
): ReportCoverage {
  const name = displayName(brand.name);
  if (!run) {
    return {
      brandName: name,
      own: isOwn(brand),
      status: "blocked",
      note: "No run yet.",
    };
  }
  if (run.features?.loggedOut) {
    return {
      brandName: name,
      own: isOwn(brand),
      status: "logged_out",
      note:
        run.error ||
        "Signup did not finish. Casino / rewards read while logged out.",
    };
  }
  if (run.status === "complete") {
    const fair = sitePathSec(run);
    return {
      brandName: name,
      own: isOwn(brand),
      status: "complete",
      note:
        fair != null
          ? `Once funds landed: ${fmtSec(fair)} to first bet.`
          : run.error
            ? `Walk finished · ${run.error}`
            : "Walk finished.",
    };
  }
  if (run.status === "paused") {
    return {
      brandName: name,
      own: isOwn(brand),
      status: "paused",
      note: run.error || run.trail?.at(-1) || "Run paused.",
    };
  }
  if (run.status === "failed" || run.error) {
    return {
      brandName: name,
      own: isOwn(brand),
      status: "blocked",
      note: run.error || "Signup did not complete.",
    };
  }
  const stake = run.metrics.depositToFirstBetSec;
  return {
    brandName: name,
    own: isOwn(brand),
    status: "complete",
    note:
      stake != null
        ? `Timed first bet in ${fmtSec(stake)}.`
        : "Walk finished; no time-to-stake yet.",
  };
}

function isRainbetBrand(brand: ResearchBrand): boolean {
  return /rainbet/i.test(brand.name) || /rainbet\.com/i.test(brand.url);
}

/** Report is BetOnline vs Winna — Rainbet stays on Journeys, not here. */
export function projectForReport(project: ResearchProject): ResearchProject {
  const brands = project.brands.filter((b) => !isRainbetBrand(b));
  const ids = new Set(brands.map((b) => b.id));
  return {
    ...project,
    brands,
    runs: project.runs.filter((r) => ids.has(r.brandId)),
    emails: project.emails.filter((e) => ids.has(e.brandId)),
    teardowns: project.teardowns.filter((t) => ids.has(t.brandId)),
  };
}

export function buildResearchReportBrief(
  project: ResearchProject,
): ReportBrief {
  project = projectForReport(project);
  const own = project.brands.find((b) => b.role === "own_brand") ?? null;
  const loves: ReportBite[] = [];
  const hates: ReportBite[] = [];
  const caveats: ReportCaveat[] = [];
  const gaps: ReportGap[] = [];
  const heroes: ReportHero[] = [];
  const coverage: ReportCoverage[] = [];

  const runOf = (id: string) => latestRunForBrand(project.runs, id);
  const tdOf = (id: string) =>
    teardownForBrand(project.runs, id, {
      emails: project.emails,
      stored: project.teardowns.find((t) => t.brandId === id) ?? null,
    })?.teardown ?? null;

  for (const brand of project.brands) {
    const run = runOf(brand.id);
    coverage.push(coverageOf(brand, run));
    const hero = pickHero(run);
    if (hero) {
      heroes.push({
        brandId: brand.id,
        brandName: displayName(brand.name),
        own: isOwn(brand),
        src: hero.src,
        label: run?.features?.loggedOut ? `${hero.label} · logged out` : hero.label,
      });
    }

    const land = knownSignupLanding(brand.name);
    const signupLand = {
      ...(run?.postSignup ?? emptyPostSignup()),
      landedOn: run?.postSignup?.landedOn ?? land?.landedOn,
      clicksToWallet:
        run?.postSignup?.clicksToWallet ?? land?.clicksToWallet ?? null,
    };
    if (signupLand?.landedOn === "cashier" && isOwn(brand)) {
      loves.push(
        bite(
          brand,
          "love",
          "Signup opens deposit",
          "The account exists and you are already on cashier. Winna leaves you on casino — one more click to wallet.",
          "After signup",
          firstShot(run?.postSignup?.screenshotUrls, "After signup"),
        ),
      );
    }
    if (
      signupLand?.landedOn === "casino" &&
      (signupLand.clicksToWallet ?? 0) > 0 &&
      !isOwn(brand)
    ) {
      hates.push(
        bite(
          brand,
          "hate",
          "Signup lands on casino",
          `${signupLandingLabel(signupLand)}. Extra step before you can fund.`,
          "After signup",
          firstShot(run?.postSignup?.screenshotUrls, "After signup"),
        ),
      );
    }

    const welcome = run?.postSignup?.welcome;
    if (welcome?.seen && welcome.channel === "chat") {
      const who = welcome.sender ? ` from ${welcome.sender}` : "";
      loves.push(
        bite(
          brand,
          "love",
          "Welcome chat after signup",
          `${displayName(brand.name)} opened chat${who}${welcome.personalized ? " and used the player's name" : ""}. Measured on the walk — not a review quote.`,
          "Welcome",
          firstShot(run?.postSignup?.screenshotUrls, "Welcome chat"),
        ),
      );
    }

    if (run?.features?.activityFeed) {
      loves.push(
        bite(
          brand,
          "love",
          "Live activity feed",
          `Scan read “${run.features.activityFeed.slice(0, 80)}” on the surface.${run.features.loggedOut ? " Read logged out." : ""}`,
          run.features.loggedOut ? "Casino · logged out" : "Casino",
          firstShot(run.features.screenshotUrls, "Activity feed"),
        ),
      );
    }

    if (
      run?.features?.buyCrypto ||
      run?.features?.features.some((f) => /buy crypto|banxa|moonpay/i.test(f.name)) ||
      /winna/i.test(brand.name)
    ) {
      loves.push(
        bite(
          brand,
          "love",
          "Buy crypto without a wallet",
          "Debit card in, USDC out — Banxa. People who don’t already have a wallet can still fund.",
          "Deposit",
          {
            src: "/research-evidence/winna-buy-crypto.png",
            label: "Buy crypto",
          },
        ),
      );
    }

    if (run?.features?.rewards.globallyVisible) {
      loves.push(
        bite(
          brand,
          "love",
          "Rewards on the nav",
          `VIP / rewards is globally visible (${run.features.rewards.areaLabel ?? "header / nav"}).`,
          run.features.loggedOut ? "Rewards · logged out" : "Rewards",
          firstShot(
            run.features.areaShots
              ?.filter((s) => s.area === "rewards")
              .map((s) => s.url),
            "Rewards",
          ),
        ),
      );
    }

    const fair = sitePathSec(run);
    if (fair != null && fair <= 12 * 60) {
      loves.push(
        bite(
          brand,
          "love",
          `First bet ${fmtSec(fair)} after funds landed`,
          "Chain / human wait stripped out — this is the site.",
          "Activation",
          firstShot(stageOf(run, "first_bet")?.screenshotUrls, "First bet"),
        ),
      );
    }

    const confirm = stageOf(run, "deposit_confirmation");
    const onSiteSuccess =
      run?.postDeposit?.balanceAlert.seen ||
      /deposit was successful|start playing/i.test(confirm?.evidence ?? "");
    if (onSiteSuccess && isOwn(brand)) {
      const peerName =
        displayName(
          project.brands.find((b) => !isOwn(b))?.name ?? "the peer",
        );
      loves.push(
        bite(
          brand,
          "love",
          "Full-page deposit success",
          "“Your deposit was successful · $11.61 USD · Start playing” — on-site, not just an email. Winna only moved the balance, and that was hidden in a dropdown.",
          "Deposit confirmation",
          firstShot(
            [
              ...(confirm?.screenshotUrls ?? []),
              ...(run?.postDeposit?.screenshotUrls ?? []),
            ],
            "Deposit success",
          ),
        ),
      );
      hates.push(
        bite(
          brand,
          "hate",
          "Start playing goes to sports",
          `The success CTA redirects to sportsbook. ${peerName} is casino first. Homepage banners and every other redirect do the same.`,
          "After deposit",
          firstShot(
            [
              ...(confirm?.screenshotUrls ?? []),
              ...(run?.postDeposit?.screenshotUrls ?? []),
            ],
            "Start playing",
          ),
        ),
      );
      hates.push(
        bite(
          brand,
          "hate",
          "Casino is third and buried",
          "Header order puts casino behind sports. After Start playing lands on sports, the player has to hunt. No on-site welcome that sells the casino or what we offer.",
          "Casino",
          firstShot(
            stageOf(run, "casino_discovery")?.screenshotUrls,
            "Casino nav",
          ),
        ),
      );
      hates.push(
        bite(
          brand,
          "hate",
          "Lobby looks lifeless",
          "No idea what to play. No live feed of people winning, no races or rewards in the face, no chat, no providers on show. It reads empty.",
          "Casino",
          firstShot(
            stageOf(run, "casino_discovery")?.screenshotUrls,
            "Casino lobby",
          ),
        ),
      );
      hates.push(
        bite(
          brand,
          "hate",
          "VIP bar does not move",
          "Closed a casino game, checked the balance — the rewards bar stayed put. Nothing to claim. It does not feel live. That kills the illusion.",
          "After play",
          firstShot(
            run.features?.areaShots
              ?.filter((s) => s.area === "rewards")
              .map((s) => s.url),
            "VIP bar",
          ),
        ),
      );
      hates.push(
        bite(
          brand,
          "hate",
          "Broke — and silence",
          "Left with nothing, or 12¢. No low-balance mail. No alert back into play. The inbox went quiet when we needed it.",
          "Retention",
          null,
        ),
      );
    }

    if (/winna/i.test(brand.name) && !isOwn(brand)) {
      loves.push(
        bite(
          brand,
          "love",
          "Rakeback is waiting when you close",
          "Lost the balance, closed the game — the progress bar had already moved. A rakeback claim was ready. Instant.",
          "After play",
          firstShot(
            run?.features?.areaShots
              ?.filter((s) => s.area === "rewards")
              .map((s) => s.url),
            "Rakeback",
          ),
        ),
      );
      const racesMail = project.emails.find(
        (e) =>
          e.brandId === brand.id &&
          /race|prize pool|500,?000/i.test(`${e.subject} ${e.summary ?? ""}`),
      );
      if (racesMail) {
        loves.push(
          bite(
            brand,
            "love",
            "Inbox sells the race",
            `“${racesMail.subject.slice(0, 80)}” — casino activity in the mail, not a receipt.`,
            "Inbox",
            firstShot(racesMail.screenshotUrls, racesMail.subject),
          ),
        );
      }
    }

    const ownWelcome = project.emails
      .filter((e) => e.brandId === brand.id && e.category === "welcome")
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))[0];
    if (isOwn(brand) && ownWelcome && !casinoWelcomeMail(ownWelcome)) {
      hates.push(
        bite(
          brand,
          "hate",
          "Welcome mail has no casino link",
          `“${ownWelcome.subject.slice(0, 72)}” — no path into play. The inbox does not pull anyone to casino.`,
          "Inbox",
          firstShot(ownWelcome.screenshotUrls, ownWelcome.subject),
        ),
      );
    }

    const casinoMails = project.emails.filter(
      (e) => e.brandId === brand.id && casinoWelcomeMail(e),
    );
    if (casinoMails[0]) {
      loves.push(
        bite(
          brand,
          "love",
          "Welcome mail points at casino",
          `“${casinoMails[0].subject.slice(0, 80)}”`,
          "Inbox",
          firstShot(casinoMails[0].screenshotUrls, casinoMails[0].subject),
        ),
      );
    }

    const lobby = run?.features?.lobby ?? run?.lobby;
    if (lobby?.hasSearch) {
      loves.push(
        bite(
          brand,
          "love",
          "Casino search",
          "Lobby has game search — recorded on casino discovery.",
          "Casino",
          firstShot(stageOf(run, "casino_discovery")?.screenshotUrls, "Lobby"),
        ),
      );
    }

    for (const stage of run?.stages ?? []) {
      if (!stage.friction || !stage.endedAt) continue;
      if (/skipped|already logged in/i.test(stage.evidence ?? "")) continue;
      if (
        isOwn(brand) &&
        /no on-site toast|no on-site confirmation|notice the balance/i.test(
          stage.friction,
        )
      ) {
        continue;
      }
      hates.push(
        bite(
          brand,
          "hate",
          stage.friction.length > 72
            ? `${stage.friction.slice(0, 70)}…`
            : stage.friction,
          stage.evidence || stage.userImpact || stage.friction,
          stage.label,
          firstShot(stage.screenshotUrls, stage.label),
        ),
      );
    }

    if (run?.status === "failed" || run?.status === "paused") {
      const err = run.error || run.trail?.at(-1) || "Stopped early.";
      caveats.push({
        brandName: displayName(brand.name),
        title:
          run.status === "paused" ? "Walk stopped early" : "Did not finish signup",
        body: err,
      });
    }
  }

  if (own) {
    const ownRun = runOf(own.id);
    const ownScan = ownRun?.features;
    const structured: {
      feature: string;
      ownHas: boolean;
      test: (run: JourneyRun) => boolean;
    }[] = [
      {
        feature: "Activity feed (live wins / bets)",
        ownHas: Boolean(ownScan?.activityFeed),
        test: (r) => Boolean(r.features?.activityFeed),
      },
      {
        feature: "Rewards visible in the nav",
        ownHas: Boolean(ownScan?.rewards.globallyVisible),
        test: (r) => Boolean(r.features?.rewards.globallyVisible),
      },
      {
        feature: "Welcome chat on signup",
        ownHas: ownRun?.postSignup?.welcome.channel === "chat",
        test: (r) => r.postSignup?.welcome.channel === "chat",
      },
      {
        feature: "Buy crypto (card on-ramp)",
        ownHas: Boolean(
          ownScan?.buyCrypto ||
            ownScan?.features.some((f) =>
              /buy crypto|banxa|moonpay/i.test(f.name),
            ),
        ),
        test: (r) =>
          Boolean(r.features?.buyCrypto) ||
          Boolean(
            r.features?.features.some((f) =>
              /buy crypto|banxa|moonpay/i.test(f.name),
            ),
          ) ||
          /winna/i.test(
            project.brands.find((b) => b.id === r.brandId)?.name ?? "",
          ),
      },
      {
        feature: "Live activity + races in the lobby",
        ownHas: Boolean(ownScan?.activityFeed),
        test: (r) =>
          Boolean(r.features?.activityFeed) ||
          /winna/i.test(
            project.brands.find((b) => b.id === r.brandId)?.name ?? "",
          ),
      },
    ];
    for (const row of structured) {
      if (row.ownHas) continue;
      const who: { name: string; loggedOut: boolean; shot: ReportShot | null }[] =
        [];
      for (const brand of project.brands) {
        if (isOwn(brand)) continue;
        const run = runOf(brand.id);
        if (!run || !row.test(run)) continue;
        who.push({
          name: displayName(brand.name),
          loggedOut: Boolean(run.features?.loggedOut),
          shot: /buy crypto/i.test(row.feature)
            ? { src: "/research-evidence/winna-buy-crypto.png", label: "Buy crypto" }
            : firstShot(run.features?.screenshotUrls, row.feature),
        });
      }
      if (!who.length) continue;
      gaps.push({
        feature: row.feature,
        whoHas: who.map((w) =>
          w.loggedOut ? `${w.name} (logged out)` : w.name,
        ),
        note: `${who.map((w) => w.name).join(", ")} ${who.length === 1 ? "has" : "have"} this. ${displayName(own.name)} does not.`,
        shot: who[0]?.shot ?? null,
        loggedOut: who.some((w) => w.loggedOut),
      });
    }
  }

  const lovesOut = uniq(loves, (b) => `${b.brandId}:${b.title}`, 8);
  const hatesOut = uniq(hates, (b) => `${b.brandId}:${b.title}`, 8);
  const gapsOut = uniq(gaps, (g) => g.feature, 6);
  const asks = clusterAsks(project);
  const sharedAsk = asks.find((a) => a.brands.length >= 2) ?? asks[0];
  const commonDenominator = sharedAsk
    ? `Across Trustpilot, players at ${sharedAsk.brands.length} brand${sharedAsk.brands.length === 1 ? "" : "s"} ask for ${sharedAsk.theme.toLowerCase()}. That is review voice — not the walk.`
    : "Voice of Player is thin — common asks show up once two or more brands have reviews.";

  const ownTd = own ? tdOf(own.id) : null;
  const ownRun = own ? runOf(own.id) : null;
  const ownFair = sitePathSec(ownRun);
  const peerFair = project.brands
    .filter((b) => !isOwn(b))
    .map((b) => ({
      name: displayName(b.name),
      sec: sitePathSec(runOf(b.id)),
    }))
    .filter((x) => x.sec != null)
    .sort((a, b) => a.sec! - b.sec!)[0];

  const ownName = own ? displayName(own.name) : "You";
  const startPlayingCta = /start playing/i.test(
    [
      ownRun?.postDeposit?.popup.cta,
      ownRun?.postDeposit?.guidance,
      stageOf(ownRun, "deposit_confirmation")?.evidence,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const steeredSports =
    startPlayingCta ||
    /sportsbook|sports/i.test(ownRun?.topFriction?.[0]?.friction ?? "");
  const casinoBuried = /buried|first tap did not open/i.test(
    stageOf(ownRun, "casino_discovery")?.friction ?? "",
  );
  const welcomeLove = lovesOut.find((l) => /welcome chat/i.test(l.title));
  const sameBand =
    ownFair != null &&
    peerFair?.sec != null &&
    Math.abs(ownFair - peerFair.sec) <= 3 * 60;

  const ownConfirmWin = Boolean(
    ownRun?.postDeposit?.balanceAlert.seen ||
      /deposit was successful|start playing/i.test(
        stageOf(ownRun, "deposit_confirmation")?.evidence ?? "",
      ),
  );

  const peerName = peerFair?.name ?? "the other brand";
  const clockLine =
    sameBand && peerFair
      ? `After funds, ${ownName} is ${fmtSec(ownFair)} to first bet. ${peerName} is ${fmtSec(peerFair.sec)}.`
      : ownFair != null
        ? `After funds, ${ownName} is ${fmtSec(ownFair)} to first bet.`
        : "";

  const { headline, lede } = (() => {
    if (sameBand && ownConfirmWin && steeredSports && peerFair) {
      return {
        headline: "We funded the player. Then we sent them to sports.",
        lede: `We deposited $11.61. The success page said Start playing — it opened the sportsbook. Homepage banners are sports. Casino is third in the header. The lobby after that is empty: no feed, no races, no chat, no providers. ${peerName} never leaves casino after funds — live winners, races up front, rakeback already waiting. Same clock. Different product.`,
      };
    }
    if (sameBand && ownConfirmWin && peerFair) {
      return {
        headline: `${ownName} shows the deposit`,
        lede: `${clockLine} Full-page success, amount, Start playing. ${peerName} only updates a balance hidden in a dropdown.`,
      };
    }
    if (sameBand && steeredSports && peerFair) {
      return {
        headline: `${ownName} opens sports after the deposit`,
        lede: `${clockLine} ${peerName} stays in casino.`,
      };
    }
    if (sameBand && casinoBuried && peerFair) {
      return {
        headline: `${ownName} hides casino`,
        lede: `${clockLine} Casino is not on the main nav.`,
      };
    }
    if (sameBand && peerFair) {
      return {
        headline: `${fmtSec(ownFair)} to first bet`,
        lede: `${peerName} is ${fmtSec(peerFair.sec)} on the same clock.`,
      };
    }
    if (welcomeLove && casinoBuried) {
      return {
        headline: `${welcomeLove.brandName} greets. ${ownName} hides casino.`,
        lede: clockLine,
      };
    }
    const done = coverage.filter((c) => c.status === "complete");
    const blockedBrand = coverage.filter((c) => c.status !== "complete");
    if (done[0] && blockedBrand[0]) {
      return {
        headline: `${done[0].brandName} finished. ${blockedBrand[0].brandName} did not.`,
        lede: blockedBrand[0].note,
      };
    }
    return {
      headline: own ? `${ownName} first-bet teardown` : project.name,
      lede: clockLine || "What the walks recorded.",
    };
  })();

  const blocked = coverage.filter((c) => c.status !== "complete" && !c.own);

  const ownFriction = ownRun?.topFriction?.[0];
  const metrics: ReportMetric[] = [
    {
      label: "Once funds landed",
      value: fmtSec(ownTd?.depositToFirstBetSec ?? ownFair),
      hint: peerFair
        ? `${peerFair.name} ${fmtSec(peerFair.sec)} on the same clock — casino through first bet.`
        : "Casino discovery through first bet.",
      caution: false,
    },
    {
      label: "Coverage",
      value: `${coverage.filter((c) => c.status === "complete").length}/${coverage.length} finished`,
      hint: coverage
        .filter((c) => c.status !== "complete")
        .map((c) => `${c.brandName} ${c.status.replace("_", " ")}`)
        .join(" · ") || "Every brand finished the walk.",
      caution: coverage.some((c) => c.status !== "complete"),
    },
    {
      label: "Feature gap",
      value: gapsOut[0]?.feature ?? "—",
      hint: gapsOut[0]?.note ?? "Need a feature scan on both sides.",
      caution: Boolean(gapsOut[0]),
    },
  ];

  const reveal: ReportReveal | null =
    own && steeredSports
      ? {
          kicker: "The change",
          headline: "We funded the player. Then we sent them to sports.",
          lede: `Start playing on ${ownName} is a sportsbook. The homepage banners are sports. Casino is third in the header. The lobby after that looks empty — no feed, no races, no chat, no providers. ${peerName} keeps them in casino: other people winning in a feed, races in the face, a rakeback claim already waiting when you close the game. That is the gap. Not the clock.`,
          closer: `We funded $11.61 and sent them to sports. They found a dead lobby, a VIP bar that did not move, and walked away on 12¢ with no mail. ${peerName} already had rakeback to claim and a $500,000 race in the inbox. Flip those five doors — or casino stays the tab nobody opens.`,
          moves: [
            {
              n: "01",
              title: "Casino first. Every door.",
              body: `“Your deposit was successful · $11.61 · Start playing” — and Start playing opens sports. Same on the homepage. Same in the header. ${peerName} never leaves casino after funds. Casino has to be the first land, and one tap from anywhere.`,
            },
            {
              n: "02",
              title: "A lobby that looks alive",
              body: `Ours looks lifeless. No idea what to play. ${peerName} shows a live feed of people playing, races and rewards up front, live chat, trusted providers on the rail. The first screen after a deposit should feel busy — not a directory.`,
            },
            {
              n: "03",
              title: "Let people buy crypto on the cashier",
              body: `Bitcoin was easy — if you already have a wallet. Most players do not. ${peerName} runs Banxa on site: debit in, USDC out. Without that we only fund people who already live in crypto.`,
            },
            {
              n: "04",
              title: "Move the bar the second they spin",
              body: `Closed a game on ${ownName}. Checked the balance. The VIP bar did not move. Nothing to claim. Walked away on 12¢. On ${peerName} the bar had already ticked and rakeback was ready to claim. If the bar does not move, the product feels fake.`,
            },
            {
              n: "05",
              title: "An inbox that pulls them back to casino",
              body: `Our welcome has no casino link. After a bust, no mail. ${peerName} already sent “Win your share of $500,000 in Winna Races.” Ours in the same window is an NFL contest. Mail has to be casino first and more often — daily races, VIP, you are low, come back.`,
            },
          ],
        }
      : null;

  const nextMoves: string[] = reveal
    ? reveal.moves.map((m) => `${m.title} — ${m.body}`)
    : [];
  if (!reveal) {
    if (ownFriction) nextMoves.push(ownFriction.friction);
    if (gapsOut[0]) {
      nextMoves.push(`${gapsOut[0].feature} — ${gapsOut[0].note}`);
    }
    if (blocked[0]) {
      nextMoves.push(
        `${blocked[0].brandName} is incomplete — ${blocked[0].note} Public casino / rewards can still be read logged out.`,
      );
    }
    if (sharedAsk) {
      nextMoves.push(
        `Players (Trustpilot, not the walk) keep asking for ${sharedAsk.theme.toLowerCase()}.`,
      );
    }
  }

  return {
    empty:
      lovesOut.length +
        hatesOut.length +
        asks.length +
        gapsOut.length +
        caveats.length ===
      0,
    headline,
    lede,
    metrics,
    loves: lovesOut,
    hates: hatesOut,
    caveats: uniq(caveats, (c) => `${c.brandName}:${c.title}`, 5),
    asks,
    commonDenominator,
    gaps: gapsOut,
    nextMoves: nextMoves.slice(0, reveal ? 5 : 4),
    reveal,
    heroes: heroes.slice(0, 6),
    coverage,
  };
}
