export type JourneyType =
  | "signup"
  | "deposit"
  | "withdraw"
  | "casino"
  | "sports_betslip"
  | "loyalty_rewards"
  | "support"
  | "my_account";

export type BrandRole = "own_brand" | "competitor";

export interface HeuristicResult {
  name: string;
  score: number;
  note: string;
}

/** Bounding box of the element an observation refers to, as percentages
 * (0-100) of the screenshot's width/height. */
export interface EvidenceRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Observation {
  text: string;
  /** Index into the analysis screenshots, when the observation points at a
   * specific captured screen. */
  shot: number | null;
  region: EvidenceRegion | null;
}

/** Older analyses stored observations as plain strings. */
export function toObservation(o: string | Observation): Observation {
  return typeof o === "string" ? { text: o, shot: null, region: null } : o;
}

/** Split an analysis's screenshots into the desktop and mobile captures.
 * Legacy analyses (no mobileFrom) are all desktop. */
export function splitScreenshots(analysis: {
  screenshots?: string[];
  mobileFrom?: number | null;
}): { desktop: string[]; mobile: string[] } {
  const shots = analysis.screenshots ?? [];
  const from = analysis.mobileFrom;
  if (from == null || from >= shots.length) {
    return { desktop: shots, mobile: [] };
  }
  return { desktop: shots.slice(0, from), mobile: shots.slice(from) };
}

/** True when a shot index points at a mobile-viewport frame. */
export function isMobileShot(
  analysis: { mobileFrom?: number | null },
  index: number | null | undefined
): boolean {
  return (
    index != null &&
    analysis.mobileFrom != null &&
    index >= analysis.mobileFrom
  );
}

export type FeatureStatus =
  | "strong"
  | "medium"
  | "weak"
  | "partial"
  | "yes"
  | "no"
  | "hidden"
  | "promo_led";

export type Priority = "critical" | "high" | "medium" | "low";

/** A product feature detected from journey screenshots or inferred from
 * analysis text when older runs predate feature extraction. */
export interface DetectedFeature {
  name: string;
  category: string;
  status: FeatureStatus;
  note?: string;
  shot?: number | null;
  /** Journey area this was detected in. */
  area?: string;
  /** extracted = seen in a screenshot; inferred = legacy keyword (unused). */
  source?: "extracted" | "inferred";
}

/** Proof behind one feature-matrix cell: where it was seen and the shot. */
export interface FeatureCellEvidence {
  status: FeatureStatus;
  note?: string;
  /** Journey area the feature was detected in. */
  area: string;
  /** True when the evidence came from a logged-in session. */
  loggedIn: boolean;
  /** URL of the screenshot that proves it, when available. */
  screenshot: string | null;
}

export interface FeatureMatrixRow {
  feature: string;
  category: string;
  priority: Priority;
  values: Record<string, FeatureStatus | null>;
  /** Per-brand evidence backing the values. */
  evidence: Record<string, FeatureCellEvidence | null>;
}

/** One real AI analysis of one journey/area for one brand. Everything the
 * product displays derives from these — no synthetic data. */
export interface JourneyAnalysis {
  /** "landing" (first impression) or a JourneyType. */
  area: string;
  analysedAt: string;
  /** 0-100 for what was observed. */
  score: number;
  /** Re-runs only: the model's unanchored score before the guardrail
   * smoothed it against the previous run. Missing = published as scored. */
  rawScore?: number;
  /** True when a bot wall / geo block hid the real product. */
  blocked: boolean;
  blockReason: string | null;
  summary: string;
  heuristics: HeuristicResult[];
  observations: (string | Observation)[];
  /** URLs of the captured screenshots this analysis was scored from.
   * Desktop frames first; mobile frames (if any) appended after them. */
  screenshots?: string[];
  /** Index into screenshots where the mobile-viewport frames start.
   * Missing/null = the visit captured desktop only (legacy analyses). */
  mobileFrom?: number | null;
  /** Loyalty analyses only: the eight retention mechanics scored 0-100, or
   * null when a mechanic can't be observed from this visit alone. */
  retention?: Record<string, number | null>;
  /** Per-mechanic evidence and improvement notes from the loyalty analysis. */
  retentionNotes?: RetentionMechanicNote[];
  /** What kind of session produced the retention scores. */
  retentionContext?: {
    loggedIn: boolean;
    fromSession: boolean;
  };
  /** Loyalty analyses only: short archetype of the brand's retention
   * strategy, e.g. "Casino-first, rewards-led". */
  retentionType?: string;
  /** Loyalty analyses only: concrete FTD offer, tier perks and reward
   * cadence in plain language. Explicit null = extracted but nothing was
   * documented (stops the backfill retrying); undefined = never extracted. */
  loyaltySnapshot?: LoyaltySnapshot | null;
  /** Product features detected in the captured screenshots. */
  features?: DetectedFeature[];
  /** Signup journeys only: the agent's registration ended in an
   * authenticated session, unlocking the brand's logged-in journeys. */
  authenticated?: boolean;
  /** True when this specific visit was scored while logged in — set from
   * what the agent actually observed, not the journey type. */
  loggedIn?: boolean;
  finalUrl: string;
}

/** Plain-language loyalty facts extracted from the visit — what a player
 * actually gets, in their words, not analyst mechanics. */
export interface LoyaltySnapshot {
  /** What a first-time depositor gets (bonus %, free spins, terms), or null
   * when no welcome offer was visible. */
  ftdOffer: string | null;
  /** Each documented loyalty level and its concrete perks. */
  tiers: { name: string; perks: string }[];
  /** Recurring reward rhythm visible on the site (daily spins, weekly
   * cashback, monthly reload), or null when none documented. */
  cadence: string | null;
}

export interface RetentionMechanicNote {
  key: string;
  /** Why this score — cites specific UI evidence. */
  note: string;
  shot: number | null;
  /** What the brand should do to close the gap vs leaders. */
  improve: string;
}

export interface Brand {
  id: string;
  name: string;
  url: string;
  /** Favicon URL resolved from the brand's domain at creation time. */
  favicon: string;
  role: BrandRole;
  /** Real analyses keyed by area ("landing" or JourneyType). Missing key =
   * not yet analysed; blocked=true = analysed but the agent was walled. */
  analyses: Record<string, JourneyAnalysis>;
  /** Voice-of-customer analysis built from scraped public reviews. */
  voc?: VocAnalysis;
  /** Design review built from the live site's rendered code + captured
   * journey screens. */
  design?: DesignReview;
}

/** One colour sampled from the live site, with its role in the UI. */
export interface DesignSwatch {
  /** #rrggbb */
  hex: string;
  /** e.g. "Page background", "Primary CTA", "Accent". */
  role: string;
}

/** A single accessibility check with its verdict. */
export interface A11yFinding {
  check: string;
  /** true = passes, false = fails, null = couldn't verify from outside. */
  pass: boolean | null;
  note: string;
}

/** In-depth design review: what the site is built with, how it looks, and
 * whether the craft holds up across the core journeys. Code signals are
 * measured from the rendered DOM; visual judgement comes from the captured
 * journey screenshots. */
export interface DesignReview {
  fetchedAt: string;
  /** Overall design score 0-100 — computed as 40% visual craft + 30%
   * consistency + 30% accessibility, never the model's gut number. */
  score: number;
  /** Visual craft judged from the screenshots alone, against anchored
   * bands. Optional on reviews stored before this field existed. */
  craft?: { score: number; note: string };
  /** Two-sentence designer's verdict. */
  summary: string;
  /** What the UI actually renders as. */
  theme: "dark" | "light" | "mixed";
  /** Why this theme (doesn't) fit the vertical, e.g. why crypto goes dark. */
  themeNote: string;
  /** Real colours sampled from the rendered page, biggest coverage first. */
  palette: DesignSwatch[];
  /** Font stack observation — what's used for body vs headings. */
  typography: string;
  stack: {
    /** e.g. "Next.js", "Nuxt", "Angular", null = undetected. */
    framework: string | null;
    /** e.g. "MUI", "Tailwind (shadcn-style)", "Bootstrap", "Custom CSS". */
    designSystem: string | null;
    /** One line: the code fingerprints this was detected from. */
    evidence: string;
    /** Engineering-foundation judgement: solid = modern & coherent,
     * mixed = mismatched pieces stitched together, fragile = legacy or
     * no real foundation. Optional on reviews stored before this field. */
    health?: "solid" | "mixed" | "fragile";
    /** The call-out: what this stack choice causes in practice —
     * drift, bloat, slower iteration, a11y gaps. */
    verdict?: string;
  };
  accessibility: {
    /** 0-100 from the measurable checks below. */
    score: number;
    findings: A11yFinding[];
  };
  /** Does branding carry through the captured journeys? */
  consistency: { score: number; note: string };
  /** UI-practice critique per captured journey area. */
  journeyNotes: { area: string; note: string }[];
  /** Exact screens the reviewer saw — keeps mood board in sync with the score. */
  reviewedScreens?: { area: string; screenshot: string }[];
  strengths: string[];
  improvements: string[];
}

/** A verbatim customer quote backing a VoC theme. */
export interface VocQuote {
  /** Review text excerpt, translated to English when needed. */
  text: string;
  /** 1-5 stars given by that reviewer. */
  rating: number;
  /** ISO date of the review. */
  date: string;
}

/** One recurring topic customers raise in reviews. */
export interface VocTheme {
  /** Short customer-language label, e.g. "Withdrawal delays". */
  theme: string;
  /** Journey area this maps to ("withdraw", "support", …) or null when it
   * doesn't correspond to an audited journey. */
  area: string | null;
  /** How many sampled reviews raise this topic. */
  mentions: number;
  /** What this means for the product team. */
  insight: string;
  quotes: VocQuote[];
}

/** How a VoC finding relates to what the audit measured. */
export interface VocAlignment {
  /** Journey area, "features" or "retention". */
  area: string;
  verdict: "confirms" | "contradicts" | "gap";
  /** Plain sentence tying the review evidence to the report numbers. */
  note: string;
}

/** Voice of customer built from scraped public reviews (Trustpilot). */
export interface VocAnalysis {
  source: "trustpilot";
  /** The reviews page this was scraped from. */
  sourceUrl: string;
  fetchedAt: string;
  /** Trustpilot TrustScore 0-5 (null when unavailable). */
  trustScore: number | null;
  /** Total review count on the platform. */
  totalReviews: number | null;
  /** How many recent reviews were sampled for this analysis. */
  sampled: number;
  /** Counts from sampled ratings: 4-5★ positive, 3★ neutral, 1-2★ negative. */
  ratingSplit: { positive: number; neutral: number; negative: number };
  /** Two-sentence verdict of what customers actually say. */
  summary: string;
  /** What customers praise, strongest theme first. */
  positives: VocTheme[];
  /** What needs attention, most damaging theme first. */
  negatives: VocTheme[];
  /** Where reviews confirm, contradict or extend the audit. */
  alignment: VocAlignment[];
}

/** A recorder event from a live capture session. */
export interface CaptureEvent {
  at: number; // seconds since session start
  kind: "screen" | "money" | "reward" | "info";
  label: string;
  detail?: string;
}

/** A saved live capture session — real evidence recorded by the user. */
export interface CaptureRecord {
  id: string;
  brandId: string;
  brandName: string;
  date: string; // ISO
  durationSec: number;
  events: CaptureEvent[];
}

export type RecommendationType = "fix_now" | "improve_next" | "strategic_bet";

export type RecommendationLevel = "high" | "medium" | "low";

/** One prioritised action synthesised from the project's real analyses. */
export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  /** Analysis area this action belongs to, or "cross_journey". */
  area: string;
  impact: RecommendationLevel;
  effort: RecommendationLevel;
  confidence: RecommendationLevel;
  /** Team best placed to own it, e.g. "Product", "CRM", "Design". */
  owner: string;
  /** What the analyst saw — on your site or a named competitor — that
   * justifies this action. */
  evidence: string;
}

/** AI-synthesised prioritised roadmap, built from all real analyses. */
export interface ActionPlan {
  generatedAt: string;
  /** Number of successful analyses the plan was built from. */
  basedOnAnalyses: number;
  recommendations: Recommendation[];
}

export interface Project {
  id: string;
  name: string;
  market: string;
  products: string[];
  /** Journeys in scope for this audit. */
  journeys: JourneyType[];
  analysisMode: string;
  brands: Brand[];
  sessions: CaptureRecord[];
  actionPlan?: ActionPlan;
  /** archived = paused: kept readable but no agent runs or updates
   * happen until it's reactivated. Only one non-archived report may
   * exist per account (future tiers will raise this). */
  status: "draft" | "analyzing" | "complete" | "archived";
  createdAt: string;
  analysedAt?: string;
  /** How the signed-in account relates to this report. Owners run and
   * manage it; viewers were invited and can only read the report. */
  access?: "owner" | "viewer";
}

/* ---- Derived score helpers (single source of truth for all pages) ---- */

/** A brand's score for an area, or null when unanalysed / blocked. */
export function areaScore(brand: Brand, area: string): number | null {
  const a = brand.analyses[area];
  if (!a || a.blocked) return null;
  return a.score;
}

/** One component of the Player CX Score. The overall is the plain average
 * of the pillars that have evidence — shown on every card so the number is
 * auditable, never a black box. */
export interface ScorePillar {
  key: "journeys" | "retention" | "voc" | "design";
  label: string;
  score: number | null;
  /** Where the number comes from, e.g. "avg of 4 scored journeys". */
  detail: string;
}

const RETENTION_AREA = "loyalty_rewards";

export function scorePillars(brand: Brand): ScorePillar[] {
  const journeyScores = Object.entries(brand.analyses)
    .filter(([area, a]) => area !== RETENTION_AREA && !a.blocked)
    .map(([, a]) => a.score);
  const journeys =
    journeyScores.length > 0
      ? Math.round(
          journeyScores.reduce((s, v) => s + v, 0) / journeyScores.length
        )
      : null;

  const retention = areaScore(brand, RETENTION_AREA);

  const trust = brand.voc?.trustScore ?? null;
  const voc = trust !== null ? Math.round(trust * 20) : null;

  return [
    {
      key: "journeys",
      label: "Journeys",
      score: journeys,
      detail:
        journeyScores.length > 0
          ? `avg of ${journeyScores.length} scored journey${journeyScores.length === 1 ? "" : "s"}`
          : "no journeys scored yet",
    },
    {
      key: "retention",
      label: "Retention",
      score: retention,
      detail:
        retention !== null
          ? "loyalty & rewards visit"
          : "loyalty visit not scored yet",
    },
    {
      key: "voc",
      label: "Voice of Customer",
      score: voc,
      detail:
        trust !== null
          ? `Trustpilot ${trust.toFixed(1)}/5${brand.voc?.totalReviews ? ` · ${brand.voc.totalReviews.toLocaleString()} reviews` : ""}`
          : "reviews not analysed yet",
    },
    {
      key: "design",
      label: "Design",
      score: brand.design?.score ?? null,
      detail: brand.design
        ? "live code + accessibility review"
        : "design not reviewed yet",
    },
  ];
}

/** Overall Player CX Score: the average of the scored pillars (journeys,
 * retention, voice of customer, design). Null until at least one has
 * evidence. */
export function overallScore(brand: Brand): number | null {
  const scores = scorePillars(brand)
    .map((p) => p.score)
    .filter((s): s is number => s !== null);
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
}
