import { knownSignupLanding } from "./post-signup";
import type {
  JourneyRun,
  PostDepositObservation,
  ResearchProject,
} from "./types";
import { latestRunForBrand } from "./feature-benchmark";

export type WalkInsight = {
  title: string;
  body: string;
  tone?: "pain" | "note" | "compare";
};

function displayName(name: string): string {
  if (/betonline/i.test(name)) return "BetOnline";
  if (/betus/i.test(name)) return "BetUS";
  if (/winna/i.test(name)) return "Winna";
  return name;
}

function isSportsbookClass(name: string): boolean {
  return /betonline|betus|bovada|mybookie/i.test(name);
}

function postDepositOf(run: JourneyRun | null): PostDepositObservation | null {
  return run?.postDeposit ?? null;
}

/**
 * Short, walk-grounded comparisons for the Journeys tab — not a full report.
 * Prefer facts we measured (landing, deposit confirm, nav bury) over guesses.
 */
export function walkInsightsForBrand(
  project: ResearchProject,
  brandId: string,
): WalkInsight[] {
  const brand = project.brands.find((b) => b.id === brandId);
  if (!brand) return [];
  const run = latestRunForBrand(project.runs, brandId);
  if (!run) return [];

  const name = displayName(brand.name);
  const peers = project.brands.filter((b) => b.id !== brandId);
  const betonline = peers.find((b) => /betonline/i.test(b.name));
  const winna = peers.find((b) => /winna/i.test(b.name));
  const ownLand = knownSignupLanding(brand.name) ?? {
    landedOn: run.postSignup?.landedOn ?? null,
    clicksToWallet: run.postSignup?.clicksToWallet ?? null,
  };
  const pd = postDepositOf(run);
  const out: WalkInsight[] = [];

  if (/betus/i.test(brand.name) && betonline) {
    const bolRun = latestRunForBrand(project.runs, betonline.id);
    const bolLand = knownSignupLanding(betonline.name);
    out.push({
      tone: "compare",
      title: `Same journey shape as ${displayName(betonline.name)}`,
      body: `Signup drops you straight on deposit (0 clicks to wallet). Homepage and post-fund screens stay sports-first. Casino is buried in the nav — same sportsbook-class funnel we walked on ${displayName(betonline.name)}.`,
    });
    if (
      pd &&
      (pd.landedOn === "sportsbook" || pd.guidedTo === "sportsbook") &&
      bolRun?.postDeposit?.guidedTo === "sportsbook"
    ) {
      out.push({
        tone: "compare",
        title: "Both steer a fresh deposit to sports",
        body: `${name} and ${displayName(betonline.name)} open sportsbook once money is in. Traditional bonus / promo framing on deposit — not a casino activation push.`,
      });
    }
  }

  if (/betus/i.test(brand.name) && pd) {
    const stale =
      !pd.balanceAlert.seen &&
      /refresh|stale|\$0|phone/i.test(
        `${pd.guidance ?? ""} ${run.stages.find((s) => s.stageId === "deposit_confirmation")?.evidence ?? ""}`,
      );
    if (stale || !pd.balanceAlert.seen) {
      out.push({
        tone: "pain",
        title: "Deposit confirmed on the phone — site stayed at $0",
        body: "Phone showed the credit. The book kept Cash / FP at $0.00 with no toast, no alert, and no deposit email. A manual refresh was required. That silence is a bigger reassure gap than BetOnline’s full-page success screen.",
      });
    }
    if (pd.landedOn === "sportsbook" || pd.guidedTo === "sportsbook") {
      out.push({
        tone: "note",
        title: "Sportsbook brand, traditional deposit offer",
        body: "After pay you sit on sports with a classic promo strip — not a casino lobby, live feed, or rakeback claim. Same product bet as BetOnline: fund the sportsbook player first.",
      });
    }
  }

  if (/betonline/i.test(brand.name) && peers.some((b) => /betus/i.test(b.name))) {
    out.push({
      tone: "compare",
      title: "BetUS walks the same sportsbook path",
      body: "BetUS also lands signup on cashier, keeps the player in sports after funds, and buries casino. Difference: BetOnline at least shows a full-page success ($11.61 · Start playing). BetUS needed a refresh before balance moved.",
    });
  }

  if (
    isSportsbookClass(brand.name) &&
    ownLand.landedOn === "cashier" &&
    (ownLand.clicksToWallet ?? 0) === 0 &&
    winna
  ) {
    const wLand = knownSignupLanding(winna.name);
    if (wLand?.landedOn === "casino") {
      out.push({
        tone: "compare",
        title: `${displayName(winna.name)} is the opposite land`,
        body: `${name} opens deposit on signup. ${displayName(winna.name)} opens casino and needs a click to wallet — casino-led product vs sportsbook-led.`,
      });
    }
  }

  // Dedupe by title
  const seen = new Set<string>();
  return out.filter((i) => {
    if (seen.has(i.title)) return false;
    seen.add(i.title);
    return true;
  }).slice(0, 4);
}
