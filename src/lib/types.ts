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

export interface FeatureMatrixRow {
  feature: string;
  category: string;
  priority: Priority;
  values: Record<string, FeatureStatus | null>;
}

/** One real AI analysis of one journey/area for one brand. Everything the
 * product displays derives from these — no synthetic data. */
export interface JourneyAnalysis {
  /** "landing" (first impression) or a JourneyType. */
  area: string;
  analysedAt: string;
  /** 0-100 for what was observed. */
  score: number;
  /** True when a bot wall / geo block hid the real product. */
  blocked: boolean;
  blockReason: string | null;
  summary: string;
  heuristics: HeuristicResult[];
  observations: (string | Observation)[];
  /** URLs of the captured screenshots this analysis was scored from. */
  screenshots?: string[];
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
  /** Product features detected in the captured screenshots. */
  features?: DetectedFeature[];
  finalUrl: string;
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
  status: "draft" | "analyzing" | "complete";
  createdAt: string;
  analysedAt?: string;
}

/* ---- Derived score helpers (single source of truth for all pages) ---- */

/** A brand's score for an area, or null when unanalysed / blocked. */
export function areaScore(brand: Brand, area: string): number | null {
  const a = brand.analyses[area];
  if (!a || a.blocked) return null;
  return a.score;
}

/** Overall brand score: average of all successful analyses, else null. */
export function overallScore(brand: Brand): number | null {
  const scores = Object.values(brand.analyses)
    .filter((a) => !a.blocked)
    .map((a) => a.score);
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
}
