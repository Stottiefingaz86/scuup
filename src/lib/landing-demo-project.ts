import { faviconUrl, LANDING } from "./constants";
import type {
  Brand,
  DesignReview,
  JourneyAnalysis,
  Project,
  VocAnalysis,
} from "./types";

export const LANDING_DEMO_PROJECT_ID = "landing-demo";

const now = "2026-07-13T12:00:00.000Z";

function journey(
  area: string,
  score: number,
  summary: string,
  url: string
): JourneyAnalysis {
  return {
    area,
    analysedAt: now,
    score,
    blocked: false,
    blockReason: null,
    summary,
    heuristics: [],
    observations: [],
    finalUrl: url,
  };
}

function voc(trustScore: number, totalReviews: number): VocAnalysis {
  return {
    source: "trustpilot",
    sourceUrl: "https://www.trustpilot.com",
    fetchedAt: now,
    trustScore,
    totalReviews,
    sampled: 40,
    ratingSplit: { positive: 24, neutral: 6, negative: 10 },
    summary: "Sampled public reviews for the landing demo.",
    positives: [],
    negatives: [],
    alignment: [],
  };
}

function design(score: number): DesignReview {
  return {
    fetchedAt: now,
    score,
    summary: "Landing demo design score.",
    theme: "dark",
    themeNote: "Dark casino shell.",
    palette: [],
    typography: "Sans-serif UI stack",
    stack: {
      framework: "Next.js",
      designSystem: "Custom",
      evidence: "Demo",
      health: "solid",
      verdict: "Coherent product UI.",
    },
    accessibility: { score: score - 4, findings: [] },
    consistency: { score, note: "Branding holds across journeys." },
    journeyNotes: [],
    strengths: [],
    improvements: [],
  };
}

function brand(
  id: string,
  name: string,
  url: string,
  role: Brand["role"],
  data: {
    landing: number;
    casino: number;
    signup: number;
    sports: number;
    loyalty: number;
    trust: number;
    reviews: number;
    design: number;
  }
): Brand {
  return {
    id,
    name,
    url,
    favicon: faviconUrl(url),
    role,
    analyses: {
      [LANDING]: journey(
        LANDING,
        data.landing,
        role === "own_brand"
          ? "Winna's Bonus Center and crypto loop read well for retention-minded players, but sports depth and first-impression polish still trail Stake in this set."
          : `${name} first-impression walk for the landing demo.`,
        url
      ),
      casino: journey("casino", data.casino, `${name} casino lobby.`, url),
      signup: journey("signup", data.signup, `${name} registration flow.`, url),
      sports_betslip: journey(
        "sports_betslip",
        data.sports,
        `${name} sportsbook slip.`,
        url
      ),
      loyalty_rewards: journey(
        "loyalty_rewards",
        data.loyalty,
        `${name} rewards hub.`,
        url
      ),
    },
    voc: voc(data.trust, data.reviews),
    design: design(data.design),
  };
}

/** Static showcase project for the marketing hero — not stored in Supabase. */
export function landingDemoProject(): Project {
  return {
    id: LANDING_DEMO_PROJECT_ID,
    name: "Winna — Canada (rest)",
    market: "Canada (rest / crypto)",
    products: ["Casino", "Sports", "Rewards"],
    journeys: ["casino", "sports_betslip", "signup", "loyalty_rewards"],
    analysisMode: "Public Audit Mode",
    brands: [
      brand("demo-winna", "Winna", "https://winna.com", "own_brand", {
        landing: 78,
        casino: 83,
        signup: 73,
        sports: 76,
        loyalty: 84,
        trust: 2.9,
        reviews: 412,
        design: 68,
      }),
      brand("demo-stake", "Stake", "https://stake.com", "competitor", {
        landing: 82,
        casino: 91,
        signup: 88,
        sports: 89,
        loyalty: 76,
        trust: 3.9,
        reviews: 28400,
        design: 74,
      }),
      brand("demo-rainbet", "Rainbet", "https://rainbet.com", "competitor", {
        landing: 74,
        casino: 72,
        signup: 71,
        sports: 70,
        loyalty: 68,
        trust: 4.1,
        reviews: 6200,
        design: 74,
      }),
      brand("demo-fanduel", "FanDuel", "https://fanduel.com", "competitor", {
        landing: 64,
        casino: 66,
        signup: 64,
        sports: 69,
        loyalty: 62,
        trust: 2.9,
        reviews: 18200,
        design: 54,
      }),
    ],
    sessions: [],
    status: "complete",
    createdAt: now,
    analysedAt: now,
  };
}
