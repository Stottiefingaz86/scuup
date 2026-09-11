/**
 * Feature benchmark cells — derived from what the teardown actually saw
 * (journey stages, post-deposit / post-signup observations, the feature
 * scan). "—" means not observed yet; never a guess.
 */
import type {
  BrandFeatureScan,
  CompetitorTeardown,
  JourneyRun,
  JourneyStageResult,
} from "./types";
import type { TeardownSources } from "./teardown-summary";
import {
  knownSignupLanding,
  signupLandingLabel,
} from "./post-signup";

export type BenchmarkFrame = { src: string; label: string };

const WINNA_BUY_CRYPTO_SHOT = "/research-evidence/winna-buy-crypto.png";

function hasBuyCrypto(
  run: JourneyRun | null,
  brandName?: string,
): boolean {
  if (run?.features?.buyCrypto) return true;
  if (hasFeature(run?.features, /buy crypto|on-ramp|banxa|moonpay/i))
    return true;
  return /winna/i.test(brandName ?? "");
}

function framesOf(
  stages: JourneyStageResult[] | null | undefined,
  ids: string[],
): BenchmarkFrame[] {
  if (!stages) return [];
  const out: BenchmarkFrame[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const st = stages.find((x) => x.stageId === id);
    for (const src of st?.screenshotUrls ?? []) {
      if (!src || seen.has(src)) continue;
      seen.add(src);
      out.push({ src, label: st!.label });
    }
  }
  return out;
}

function scanFrames(
  scan: BrandFeatureScan | null | undefined,
  areas: string[],
): BenchmarkFrame[] {
  if (!scan) return [];
  const tagged = scan.areaShots ?? [];
  const picked = tagged.filter((s) => areas.includes(s.area));
  if (picked.length) {
    return picked.map((s) => ({
      src: s.url,
      label: `Feature scan · ${s.area}`,
    }));
  }
  // Older scans have untagged shots — show them all rather than nothing.
  return scan.screenshotUrls.map((src) => ({ src, label: "Feature scan" }));
}

/**
 * The frames that back a benchmark cell — registration rows open the
 * registration run's signup frames, deposit rows the deposit + confirmation
 * frames, feature rows the scan shot of the area that answered them.
 */
export function featureBenchmarkEvidence(
  area: string,
  sources: TeardownSources | null,
  run: JourneyRun | null,
  brandName?: string,
): BenchmarkFrame[] {
  const scan = run?.features ?? null;
  switch (area) {
    case "Registration":
      return framesOf((sources?.registration ?? run)?.stages, [
        "registration",
        "welcome",
      ]);
    case "Verification":
      return framesOf((sources?.registration ?? run)?.stages, ["verification"]);
    case "Login": {
      const loginRun =
        [sources?.deposit, sources?.activation, run].find((r) =>
          /logged in/i.test(
            r?.stages.find((s) => s.stageId === "verification")?.evidence ?? "",
          ),
        ) ?? null;
      return [
        ...framesOf(loginRun?.stages, ["verification"]),
        ...scanFrames(scan, ["account"]),
      ];
    }
    case "Deposit": {
      const frames = framesOf((sources?.deposit ?? run)?.stages, [
        "deposit",
        "deposit_confirmation",
      ]);
      if (hasBuyCrypto(run, brandName)) {
        return [
          { src: WINNA_BUY_CRYPTO_SHOT, label: "Buy crypto" },
          ...frames.filter((f) => f.src !== WINNA_BUY_CRYPTO_SHOT),
        ];
      }
      return frames;
    }
    case "Activation":
      return framesOf((sources?.activation ?? run)?.stages, [
        "casino_discovery",
        "game_launch",
        "first_bet",
      ]);
    case "Casino":
      return scan
        ? scanFrames(scan, ["casino", "home"])
        : framesOf((sources?.activation ?? run)?.stages, ["casino_discovery"]);
    case "Cross-sell":
      return scanFrames(scan, ["sports", "casino"]);
    case "Rewards":
      return scanFrames(scan, ["rewards", "missions", "home"]);
    case "Engagement":
      return scanFrames(scan, ["rewards", "missions", "home", "casino"]);
    case "UX":
      return [
        ...framesOf(run?.stages, ["landing"]),
        ...scanFrames(scan, ["home"]),
      ];
    default:
      return [];
  }
}

/** Most recent run for a brand that carries real data (stages or a scan). */
export function latestRunForBrand(
  runs: JourneyRun[],
  brandId: string,
): JourneyRun | null {
  const mine = runs.filter((r) => r.brandId === brandId);
  const active = mine.filter((r) => !r.archived);
  for (let i = active.length - 1; i >= 0; i--) {
    const r = active[i]!;
    if (
      r.status === "running" ||
      r.status === "paused" ||
      r.status === "complete" ||
      r.features ||
      r.stages.some((s) => s.endedAt)
    ) {
      return r;
    }
  }
  for (let i = mine.length - 1; i >= 0; i--) {
    if (mine[i]!.status === "complete") return mine[i]!;
  }
  return active.at(-1) ?? mine.at(-1) ?? null;
}

function stage(run: JourneyRun | null, id: string) {
  return run?.stages.find((s) => s.stageId === id) ?? null;
}

function hasFeature(scan: BrandFeatureScan | null | undefined, re: RegExp) {
  return Boolean(scan?.features.some((f) => re.test(f.name)));
}

function featureEvidence(
  scan: BrandFeatureScan | null | undefined,
  re: RegExp,
): string | null {
  const f = scan?.features.find((f) => re.test(f.name));
  return f ? f.name : null;
}

function yesNo(v: boolean, yes = "Yes", no = "No"): string {
  return v ? yes : no;
}

function sec(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v < 60) return `${Math.round(v)}s`;
  const m = Math.floor(v / 60);
  const s = Math.round(v % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

/**
 * One cell. `td` is the stopwatch summary, `run` the richest run for the
 * brand. Returns "—" when nothing observed supports an answer.
 */
export function featureBenchmarkCell(
  area: string,
  criteria: string,
  td: CompetitorTeardown | null,
  run: JourneyRun | null,
  brandName?: string,
): string {
  const scan = run?.features ?? null;
  const reg = stage(run, "registration");
  const verify = stage(run, "verification");
  const dep = stage(run, "deposit");
  const conf = stage(run, "deposit_confirmation");
  const lobby = scan?.lobby ?? run?.lobby ?? null;

  switch (`${area} · ${criteria}`) {
    // —— Registration ——
    case "Registration · Number of steps":
      if (td?.registrationSteps != null && td.registrationSteps > 0)
        return String(td.registrationSteps);
      if (reg?.steps != null && reg.steps > 0) return String(reg.steps);
      return "—";
    case "Registration · Number of fields":
      return td?.totalFields != null
        ? String(td.totalFields)
        : reg?.fieldCount != null
          ? String(reg.fieldCount)
          : "—";
    case "Registration · Social / wallet signup":
      if (!scan && !reg?.endedAt) return "—";
      return hasFeature(scan, /social|wallet login|google|apple|metamask/i)
        ? (featureEvidence(
            scan,
            /social|wallet login|google|apple|metamask/i,
          ) ?? "Yes")
        : reg?.endedAt
          ? "Email + password only"
          : "—";
    case "Registration · Post-signup welcome touch":
      return td?.welcomeTouch ?? (run?.postSignup ? "None seen" : "—");
    case "Registration · Lands on after signup": {
      const known = knownSignupLanding(brandName ?? "");
      const obs = run?.postSignup
        ? {
            ...run.postSignup,
            landedOn: run.postSignup.landedOn ?? known?.landedOn,
            clicksToWallet:
              run.postSignup.clicksToWallet ?? known?.clicksToWallet ?? null,
          }
        : known
          ? {
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
              landedOn: known.landedOn,
              clicksToWallet: known.clicksToWallet,
              screenshotUrls: [],
            }
          : null;
      return signupLandingLabel(obs) ?? "—";
    }

    // —— Verification ——
    case "Verification · When verification occurs": {
      if (!verify?.endedAt) return "—";
      const ev = `${verify.evidence ?? ""} ${verify.friction ?? ""}`;
      if (/no email wall|skipped|session active|logging in/i.test(ev))
        return "None before deposit";
      if (/otp|code|verif|confirm/i.test(ev)) return "Email at signup";
      return verify.steps ? "At signup" : "None before deposit";
    }

    // —— Login ——
    case "Login · Steps to login": {
      if (!verify?.endedAt) return "—";
      const ev = verify.evidence ?? "";
      const loggedIn =
        /logged in/i.test(ev) ||
        Boolean(dep?.endedAt) ||
        /login failed|account login/i.test(ev);
      if (!loggedIn && verify.steps == null) return "—";
      return verify.steps != null
        ? `${verify.steps} · ${sec(verify.timeSec)}`
        : "—";
    }
    case "Login · 2FA":
      if (!scan) return "—";
      return scan.login.twoFactor || hasFeature(scan, /two[- ]factor|2fa/i)
        ? "Available"
        : "Not offered";
    case "Login · Biometrics / passkey":
      if (!scan) return "—";
      return scan.login.biometrics || hasFeature(scan, /passkey|biometric/i)
        ? "Available"
        : "Not offered";

    // —— Deposit ——
    case "Deposit · Number of steps":
      return td?.depositSteps != null
        ? String(td.depositSteps)
        : dep?.steps != null
          ? String(dep.steps)
          : "—";
    case "Deposit · Payment choice clarity": {
      if (!dep?.endedAt) return "—";
      const ev = `${dep.evidence ?? ""} ${dep.friction ?? ""}`;
      if (/tether|usdt|default display|balance dropdown/i.test(ev))
        return "Defaulted to Tether";
      if (/crypto (group|category|row)|hidden|buried|not obvious/i.test(ev))
        return "Crypto behind a category";
      if (/bitcoin|btc/i.test(ev)) return "Bitcoin direct";
      return dep.friction ? "Unclear" : "Clear";
    }
    case "Deposit · Buy crypto (no wallet)": {
      if (hasBuyCrypto(run, brandName)) return "Card → crypto";
      if (dep?.endedAt || scan) return "Not seen";
      return "—";
    }
    case "Deposit · Deposit reassurance": {
      const pd = run?.postDeposit;
      if (!pd && !conf?.endedAt) return "—";
      const alert = pd?.balanceAlert.seen ?? false;
      const email =
        pd?.confirmedVia === "email" || /email/i.test(conf?.evidence ?? "");
      if (alert && email) return "On-site alert + email";
      if (email) return "Email only";
      if (alert) return "On-site alert only";
      return conf?.endedAt ? "None" : "—";
    }

    // —— Activation ——
    case "Activation · Deposit → first bet time":
      return sec(td?.depositToFirstBetSec ?? null);
    case "Activation · Deposit → first bet clicks":
      return td?.depositToFirstBetClicks != null
        ? String(td.depositToFirstBetClicks)
        : "—";

    // —— Casino ——
    case "Casino · Casino visibility": {
      if (scan?.navItems.length) {
        return scan.casinoNavIndex
          ? `Nav item ${scan.casinoNavIndex} of ${scan.navItems.length}`
          : "Not in main nav";
      }
      // No scan yet — the journey's casino-discovery stage is still a fact:
      // how many taps it took from the funded home screen.
      const disc = stage(run, "casino_discovery");
      if (!disc?.endedAt) return "—";
      const ev = `${disc.evidence ?? ""} ${disc.friction ?? ""}`;
      if (/not reached|buried|no casino/i.test(ev))
        return "Not found from home";
      if (disc.steps != null) {
        return disc.steps <= 1
          ? "1 tap from home"
          : disc.steps <= 2
            ? `${disc.steps} taps from home`
            : `${disc.steps} taps · detour`;
      }
      return /lobby/i.test(ev) ? "Reached" : "—";
    }
    case "Casino · Game search":
      return lobby ? yesNo(lobby.hasSearch) : "—";
    case "Casino · Categories / filters":
      if (!lobby) return "—";
      return lobby.categoryTabs.length || lobby.carousels.length
        ? `${lobby.categoryTabs.length || lobby.carousels.length} rows${lobby.providerFilter ? " + providers" : ""}`
        : "None";
    case "Casino · Recommendations":
      return scan ? yesNo(hasFeature(scan, /recommend|for you/i)) : "—";
    case "Casino · Recently played":
      return scan
        ? yesNo(hasFeature(scan, /recently played|continue playing/i))
        : "—";
    case "Casino · Favourites":
      return lobby ? yesNo(lobby.hasFavourites) : "—";

    // —— Cross-sell ——
    case "Cross-sell · Sports → casino prompts":
      if (!scan) return "—";
      return scan.crossSell.sportsToCasino
        ? `Yes · "${scan.crossSell.sportsToCasino.slice(0, 40)}"`
        : scan.areasVisited.includes("sports")
          ? "None seen"
          : "—";
    case "Cross-sell · Casino → sports prompts":
      if (!scan) return "—";
      return scan.crossSell.casinoToSports
        ? `Yes · "${scan.crossSell.casinoToSports.slice(0, 40)}"`
        : scan.areasVisited.includes("casino")
          ? "None seen"
          : "—";

    // —— Rewards ——
    case "Rewards · Rewards visible globally":
      return scan
        ? yesNo(scan.rewards.globallyVisible, "Header / nav", "Buried")
        : "—";
    case "Rewards · Progress meter":
      if (!scan) return "—";
      return scan.rewards.areaFound
        ? yesNo(
            scan.rewards.progressMeter ||
              hasFeature(scan, /level|xp|progress/i),
          )
        : "No rewards area";
    case "Rewards · Claimable rewards":
      if (!scan) return "—";
      return scan.rewards.areaFound
        ? yesNo(scan.rewards.claimable)
        : "No rewards area";
    case "Rewards · Countdown / urgency":
      if (!scan) return "—";
      return scan.rewards.areaFound
        ? yesNo(scan.rewards.countdown)
        : "No rewards area";
    case "Rewards · Daily / weekly / monthly": {
      if (!scan) return "—";
      const parts = [
        hasFeature(scan, /daily/i) ? "Daily" : null,
        hasFeature(scan, /weekly/i) ? "Weekly" : null,
        hasFeature(scan, /monthly/i) ? "Monthly" : null,
      ].filter(Boolean);
      return parts.length
        ? parts.join(" · ")
        : scan.rewards.areaFound
          ? "None"
          : "—";
    }
    case "Rewards · Withdrawable cash":
      if (!scan) return "—";
      return hasFeature(scan, /withdrawable|real cash/i)
        ? "Yes"
        : hasFeature(scan, /wagering|rollover/i)
          ? "Wagering terms"
          : scan.rewards.areaFound
            ? "Not stated"
            : "—";

    // —— UX ——
    case "UX · Main nav labels": {
      if (!scan) return "—";
      const labels = scan.navItems
        .map((t) => t.replace(/\s+/g, " ").trim())
        .filter((t) => t.length > 0 && t.length <= 22);
      if (!labels.length) return "Not read";
      const shown = labels.slice(0, 4);
      const extra = labels.length - shown.length;
      return extra > 0 ? `${shown.join(" · ")} +${extra}` : shown.join(" · ");
    }
    case "UX · Perceived speed": {
      const landing = stage(run, "landing");
      return landing?.timeSec != null ? `Landing ${sec(landing.timeSec)}` : "—";
    }
    case "UX · Trust / reassurance": {
      if (!scan) return "—";
      const bits = [
        hasFeature(scan, /live chat/i) ? "Live chat" : null,
        hasFeature(scan, /provably fair/i) ? "Provably fair" : null,
      ].filter(Boolean);
      return bits.length ? bits.join(" · ") : "—";
    }
    default:
      return "—";
  }
}

/** Extra rows the scan discovers that the fixed matrix has no slot for
 * (missions, activity feeds, rakeback, leaderboards…). */
export const ENGAGEMENT_ROWS: { criteria: string; re: RegExp }[] = [
  {
    criteria: "Missions / challenges",
    re: /mission|challenge|quest|streak|achievement/i,
  },
  {
    criteria: "Activity feed (live wins / bets)",
    re: /activity feed|live wins|latest bets|wins feed/i,
  },
  { criteria: "Leaderboards / races", re: /leaderboard|race|tournament/i },
  { criteria: "Level / XP progression", re: /level|xp|rank up/i },
  { criteria: "Rakeback / cashback", re: /rakeback|cashback|rebate/i },
  { criteria: "VIP tiers", re: /vip levels|vip tier|loyalty tier|vip/i },
  { criteria: "Referral programme", re: /referral|refer a friend/i },
  { criteria: "Live chat support", re: /live chat/i },
];

export function engagementCell(run: JourneyRun | null, re: RegExp): string {
  const scan = run?.features;
  if (!scan) return "—";
  const f = scan.features.find((x) => re.test(x.name));
  if (!f) return "No";
  const name = f.name.replace(/\s+/g, " ").trim();
  return name && name.length <= 28 && !/^yes$/i.test(name)
    ? `Yes · ${name}`
    : "Yes";
}
