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
import { expertiseFor } from "./igaming-expertise";
import {
  applyRetentionGates,
  fillGatedRetentionNotes,
  type RetentionContext,
} from "./retention-scoring";
import type { DetectedFeature, Observation, RetentionMechanicNote } from "./types";

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
}

export interface JourneyAnalysis extends AnalysisResult {
  area: string;
  analysedAt: string;
  screenshots: string[];
  finalUrl: string;
  /** Signup journeys only: true when the agent's registration ended in an
   * authenticated session — the saved context can now walk gated journeys. */
  authenticated?: boolean;
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
}

/** Navigation the agent performs on its own from the public homepage.
 * Journeys not listed here sit behind a login and need a live session.
 * Must stay in sync with AGENT_JOURNEYS in constants.ts (client-safe). */
const AGENT_PLAYBOOKS: Record<string, PlaybookStep[]> = {
  signup: [
    {
      instruction:
        "click the sign up, join, or register button to open the registration form",
      required: true,
    },
  ],
  casino: [
    {
      instruction:
        "open the casino games lobby from the main navigation (it may be labelled Casino, Games, or Slots)",
      required: true,
      fallbackPaths: ["/casino", "/games", "/slots"],
    },
  ],
  sports_betslip: [
    {
      instruction:
        "open the sports betting or sportsbook section from the main navigation (it may be labelled Sports, Sportsbook, or Betting)",
      required: true,
      fallbackPaths: ["/sports", "/sportsbook", "/sport", "/sports-betting"],
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
        "find and open the loyalty, VIP, rewards, bonus center, or rakeback area — it may be a nav item, a footer link, an icon-only menu entry, or open as a modal",
      required: true,
    },
    {
      instruction:
        "click the second tab inside the rewards or bonus hub (such as 'Level Up', 'Tiers', or similar) to reveal its content",
      required: false,
    },
    {
      instruction:
        "click the next unexplored tab inside the rewards or bonus hub (such as 'All Levels', 'Benefits', or similar) to reveal its content",
      required: false,
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

/** Journeys where we scroll the full page — lobby footers hide live feeds,
 * jackpots, leaderboards and provider rows below the fold. */
const DEEP_SCROLL_JOURNEYS = new Set(["landing", "casino", "sports_betslip"]);

const FEATURE_PROMPT = `\n\nFEATURE DETECTION: Scan ALL screenshots — including scrolled sections at the bottom of the page — for product features. Casino lobbies often hide live win feeds, jackpot rows, leaderboards, provider carousels and recently-played rows below the fold; loyalty hubs show tier grids and reward calendars. Return a "features" array for every feature with visible evidence. Use standard names when possible: "Live wins feed", "Leaderboards", "Jackpot games", "VIP levels", "Rakeback", "Weekly bonus", "Status transfer", "Originals", "Provider filters", "Casino search", "Live casino", "Bet builder", "Cashout", "Live chat", "Crypto payments", "Provably fair", "Free spins", "Missions / streaks", etc. Category: Acquisition | Casino | Sports | Loyalty / Rewards | Payments | Support | My Account. Status: strong (best-in-class), yes (clearly present), medium, partial (weak execution), weak, hidden (hard to find). Include note (one-line evidence) and shot (screenshot index). Only list features you can SEE — omit absent ones.`;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface ScrollCapture {
  capture: () => Promise<string>;
  scrollTo: (y: number) => Promise<void>;
  getHeight: () => Promise<number>;
}

/** Capture top + incremental scroll positions through to the page bottom. */
async function captureScrollSequence(
  sc: ScrollCapture,
  maxShots = 6
): Promise<string[]> {
  const shots: string[] = [];
  await sc.scrollTo(0);
  await sleep(1200);
  shots.push(await sc.capture());

  const height = await sc.getHeight();
  const viewport = 900;
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
    await sleep(1200);
    shots.push(await sc.capture());
  }

  return shots.slice(0, maxShots);
}

/** Evenly sample when we captured more frames than the vision model needs. */
function pickShots(shots: string[], max = 8): string[] {
  if (shots.length <= max) return shots;
  const picked: string[] = [];
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i / (max - 1)) * (shots.length - 1));
    picked.push(shots[idx]!);
  }
  return picked;
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
  sports_betslip:
    "This is the sportsbook/betslip experience, captured while the agent walked a real betting flow: sportsbook → match view → adding a selection → the betslip with a stake entered. Judge usability across that flow: market depth visibility (how many markets per match and how discoverable), odds presentation, how clearly the slip shows the selection, stake input and potential returns, single/multi/bet-builder access, and cash-out cues. If the agent's trail shows a selection was added, score the betslip UX from the screenshots that show it; if no selection could be added, judge what that friction says about the product and note it.",
  loyalty_rewards:
    "This is the loyalty/VIP/rewards area. Judge retention craft by this vertical's standards: layered reward cadence (rakeback, weekly/monthly boosts, reloads, level-ups), aspiration mechanics (lifetime tiers, visible locked rewards), whether the next reward moment feels near, and whether earning rules are discoverable. A modal-based bonus center that keeps the player in their game session is best practice. Compare mentally against Stake's VIP club — the category benchmark.",
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
  },
  required: [
    ...SCHEMA.required,
    "retention",
    "retentionType",
    "retentionContext",
    "retentionNotes",
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

Set retentionType to ONE of: "Crypto loop-led" | "Loyalty-led (weaker loop)" | "Hybrid — promo + loyalty" | "Promo page only (no loop)" — plus a 3-5 word tag (e.g. "Loyalty-led — VIP points, thin cadence"). BetOnline-class regulated books usually belong in Loyalty-led or Hybrid, NOT Promo page only. This answers "how deep is the retention loop vs Stake-class?" not "does loyalty exist at all?"`;

export async function scoreScreenshots(
  journey: string,
  pageTitle: string,
  finalUrl: string,
  screenshots: string[],
  trail: string[] = [],
  source: "agent" | "session" = "agent"
): Promise<AnalysisResult> {
  const guidance = JOURNEY_GUIDANCE[journey] ?? JOURNEY_GUIDANCE.landing;
  const sourceNote =
    source === "session"
      ? "The screenshots were captured at different moments of a REAL RECORDED USER SESSION, in chronological order — they are not a top/scrolled pair of one page. Judge the experience the user actually moved through."
      : screenshots.length > 2
        ? "The screenshots follow the agent's navigation and scroll in chronological order — each step and scroll position produced one screenshot. Judge everything revealed across ALL of them, especially content at the bottom of long lobby pages."
        : "Screenshot 0 = top of page, screenshot 1 = scrolled down.";
  const prompt = `You are PlayerScope, an elite iGaming CX analyst with deep operator-side experience in crypto casinos and sportsbooks. You are scoring one journey of a casino/sportsbook site from screenshots. ${sourceNote}

${expertiseFor(journey)}

Journey: ${journey}. ${guidance}

Page title: "${pageTitle}". Final URL: ${finalUrl}.${
    trail.length
      ? `\n\nAn autonomous agent navigated here from the homepage by: ${trail.join("; then ")}. Factor in how discoverable this area was — if it took obscure steps to find, that itself is a CX finding.`
      : ""
  }

Scoring philosophy — judge DECISION EASE within the vertical's own conventions. A promo-stuffed hero or wall of competing CTAs with no obvious next action lowers the score; but dense game grids, modal hubs, tier locks and reward layering are the category language, not clutter (see the domain brief). Marketing claims ("Trusted by millions") are not trust signals — only verifiable cues (licence numbers, regulator seals, RG links) count.

Score 0-100 calibrated to THIS vertical: 50 = an average licensed operator, 80+ = the Stake/Winna/Rainbet class of execution. If what you see matches how the category leaders do it, the score must reflect that — an analyst who marks the vertical's best practice as a failure has misread the market.

Heuristics: score EXACTLY these, using these exact names (they are compared across brands): ${(JOURNEY_HEURISTICS[journey] ?? JOURNEY_HEURISTICS.landing).map((h) => `"${h}"`).join(", ")}. Each gets a 0-100 score and a one-line note naming the actual UI elements that earned it.

Summary: MAXIMUM 2 short sentences. Sentence 1 = the verdict — what drives this score, in plain product language. Sentence 2 = the single biggest gap (or standout) versus the category leaders. No hedging, no filler, no restating the score.

Observations: concrete findings a product team could act on. Be specific: name actual UI elements you can see. Critique what genuinely underperforms; equally, identify what is executed at a leader level and say why it works.

For each observation, point at the evidence: set "shot" to the screenshot index (0 or 1) showing the element you're discussing, and "region" to that element's bounding box as PERCENTAGES of the image (x,y = top-left corner, w,h = size, all 0-100). Keep regions tight around the specific element. Use null for shot/region only when the observation is about the page as a whole.

If the screenshots show a bot-verification wall, geo-block, error page, or a loading/splash screen with no real product content, set blocked=true, explain in blockReason, and do NOT score the brand's product from it — a capture problem must never read as a bad product.${journey === "loyalty_rewards" ? RETENTION_PROMPT : ""}${FEATURE_PROMPT}`;

  const visionShots = pickShots(screenshots);

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
  return {
    ...parsed,
    retention,
    retentionNotes,
    retentionContext: ctx,
    features: (parsed.features ?? []).map((f) => ({
      ...f,
      source: "extracted" as const,
    })),
  };
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
Status: strong | yes | medium | partial | weak | hidden.
Include note (what you see) and shot (screenshot index). Return empty array if nothing is clearly visible.`;

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
  return parsed.features.map((f) => ({
    ...f,
    source: "extracted" as const,
    area: journey,
  }));
}

const RETENTION_NOTES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    retentionNotes: RETENTION_SCHEMA.properties.retentionNotes,
  },
  required: ["retentionNotes"],
} as const;

const RETENTION_NOTES_PROMPT = `You are PlayerScope. Retention scores were already assigned — do NOT change them. Write retentionNotes explaining WHY each score was given, citing specific UI evidence from the screenshots.

For every mechanic with a non-null score in the provided scores object:
- key: mechanic key
- note: one sentence citing the specific UI element(s) visible in the screenshots
- shot: screenshot index (0-based) showing that evidence
- improve: one actionable sentence for the product team — what would lift this toward Stake/Winna class

Do not invent scores. Only write notes for mechanics listed with a number. Omit mechanics that are null.
If loggedIn is false, do NOT write notes or improvement advice for progress_mechanics, personalisation, or account_integration — those require login. Never suggest adding progress meters or tier UI that may already exist behind login.`;

/** Backfill per-mechanic evidence notes from existing loyalty screenshots. */
export async function extractRetentionNotesFromShots(
  retention: Record<string, number | null>,
  ctx: RetentionContext,
  screenshots: string[]
): Promise<RetentionMechanicNote[]> {
  if (screenshots.length === 0) return [];
  const gated = applyRetentionGates(retention, ctx) ?? retention;
  const scored = Object.entries(gated).filter(([, v]) => v !== null);
  if (scored.length === 0) {
    return fillGatedRetentionNotes(gated, ctx, []);
  }

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
  const parsed = JSON.parse(text) as { retentionNotes: RetentionMechanicNote[] };
  return fillGatedRetentionNotes(gated, ctx, parsed.retentionNotes ?? []);
}

/** Journeys that only make sense with an authenticated session. They run
 * when the brand has a logged-in Browserbase context; otherwise the caller
 * gets a clear "log in first" error. */
const LOGIN_PLAYBOOKS: Record<string, PlaybookStep[]> = {
  deposit: [
    {
      instruction:
        "open the deposit or cashier screen — usually a Deposit or Wallet button in the header for logged-in players",
      required: true,
    },
  ],
  withdraw: [
    {
      instruction:
        "open the withdrawal screen — usually inside the cashier or wallet area, labelled Withdraw or Cash Out",
      required: true,
    },
  ],
  my_account: [
    {
      instruction:
        "open the account, profile, or settings area from the user avatar or account menu in the header",
      required: true,
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
  }
): Promise<JourneyAnalysis & { chainedAnalyses?: JourneyAnalysis[] }> {
  const signupVars = opts?.signupVars ?? null;
  const chainLoginJourneys = opts?.chainLoginJourneys;
  const playbook = AGENT_PLAYBOOKS[journey];
  if (playbook) {
    return analyzeWithAgent(
      url,
      journey,
      playbook,
      contextId,
      proxyCountry,
      journey === "signup" ? signupVars : null,
      journey === "signup" ? chainLoginJourneys : undefined
    );
  }
  const loginPlaybook = LOGIN_PLAYBOOKS[journey];
  if (loginPlaybook) {
    if (!contextId) {
      throw new Error(
        `${journey} sits behind a login — save credentials and log the agent in first (Accounts page), or record a live session.`
      );
    }
    return analyzeWithAgent(
      url,
      journey,
      loginPlaybook,
      contextId,
      proxyCountry
    );
  }
  if (journey !== "landing") {
    throw new Error(
      `${journey} sits behind a login — record a live session to score it.`
    );
  }
  return analyzeLanding(url, contextId, proxyCountry);
}

/** "LOGGED_IN" check the registration walk uses to know it's done. */
async function agentIsLoggedIn(stagehand: Stagehand): Promise<boolean> {
  try {
    const result = await stagehand.extract(
      "Answer with exactly LOGGED_IN or LOGGED_OUT. LOGGED_IN means a player avatar, account menu, deposit button, or wallet balance for an authenticated user is visible. Prominent Sign Up / Register CTAs mean LOGGED_OUT."
    );
    return result.extraction.toUpperCase().includes("LOGGED_IN");
  } catch {
    return false;
  }
}

/** Fill and submit the (possibly multi-step) registration form with the
 * test persona, capturing each step as scoring evidence. Returns true when
 * the walk ended in an authenticated session. */
async function runRegistrationWalk(
  stagehand: Stagehand,
  page: {
    waitForTimeout: (ms: number) => Promise<void>;
  },
  vars: Record<string, string>,
  trail: string[],
  shots: string[],
  capture: () => Promise<string>
): Promise<boolean> {
  const SUBMIT_PHRASINGS = [
    "click the enabled Create Account button to submit the registration",
    "click Register, Sign Up, or Create Account to complete registration",
    "click Continue or Next if this is a multi-step form and not the final screen",
  ];

  for (let step = 1; step <= 4; step++) {
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
    await page.waitForTimeout(1500);
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
      trail.push("registration submitted — account created and logged in");
      return true;
    }
    if (!submitted && step >= 2) {
      trail.push(
        `registration stalled at step ${step} — submit button may be disabled or blocked by captcha`
      );
      break;
    }
  }

  if (await tryLoginAfterSignup(stagehand, page, vars, trail, shots, capture)) {
    return true;
  }

  await page.waitForTimeout(5000);
  if (await agentIsLoggedIn(stagehand)) {
    trail.push("authenticated after registration settled");
    return true;
  }
  trail.push(
    "registration submitted but no authenticated session — email/SMS verification or captcha may be required"
  );
  return false;
}

/** Account may exist after submit but the site routes to verify-first — log
 * in with the same test credentials before giving up. */
async function tryLoginAfterSignup(
  stagehand: Stagehand,
  page: { waitForTimeout: (ms: number) => Promise<void> },
  vars: Record<string, string>,
  trail: string[],
  shots: string[],
  capture: () => Promise<string>
): Promise<boolean> {
  trail.push("trying login with test credentials after registration");
  try {
    const open = await stagehand.act(
      "click Log In or Sign In (not Register or Sign Up) to open the login form"
    );
    if (!open.success) return false;
    await page.waitForTimeout(2500);
    shots.push(await capture());

    await stagehand.act(
      "type %email% into the email or username field of the login form",
      { variables: vars }
    );
    await stagehand.act(
      "type %password% into the password field of the login form",
      { variables: vars }
    );
    const submit = await stagehand.act(
      "click the Log In or Sign In button to submit the login form"
    );
    if (!submit.success) return false;
    trail.push("login submitted with test credentials");
    await page.waitForTimeout(8000);
    shots.push(await capture());
    return agentIsLoggedIn(stagehand);
  } catch {
    return false;
  }
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
  chainLoginJourneys?: string[]
): Promise<JourneyAnalysis & { chainedAnalyses?: JourneyAnalysis[] }> {
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
          viewport: { width: 1440, height: 900 },
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
  try {
    const page =
      stagehand.context.activePage() ?? (await stagehand.context.newPage());
    const capture = async () => {
      const { data } = await page.sendCDP<{ data: string }>(
        "Page.captureScreenshot",
        { format: "jpeg", quality: 60 }
      );
      return data;
    };

    await page
      .goto(url, { waitUntil: "domcontentloaded", timeoutMs: 25000 })
      .catch(() => {});
    await page.waitForTimeout(8000);

    const trail: string[] = [];
    const shots: string[] = [];
    let authenticated: boolean | undefined;

    // A persisted context that's already authenticated has no register
    // button to walk — report the unlocked state instead of a bogus block.
    if (journey === "signup" && signupVars && (await agentIsLoggedIn(stagehand))) {
      const screenshots = await persistShots([await capture()]);
      return {
        area: journey,
        analysedAt: new Date().toISOString(),
        score: 0,
        blocked: true,
        blockReason:
          "This brand already has an authenticated test session from an earlier registration — the signup form can't be re-walked while logged in. Logged-in journeys (deposit, withdraw, account) are unlocked.",
        summary: "",
        heuristics: [],
        observations: [],
        features: [],
        screenshots,
        finalUrl: page.url(),
        authenticated: true,
      };
    }
    for (const step of playbook) {
      let ok = false;
      let message = "";
      // Sites label the same control differently — try each phrasing
      // before concluding the step failed.
      for (const phrasing of [step.instruction, ...(step.alternatives ?? [])]) {
        try {
          const result = await stagehand.act(phrasing);
          ok = result.success;
          message = result.actionDescription || result.message;
        } catch (e) {
          message = e instanceof Error ? e.message : String(e);
        }
        if (ok) break;
      }
      // Section navigation can fall back to well-known URL paths when the
      // agent can't find the nav entry (mega-menus, icon-only navs).
      if (!ok && step.fallbackPaths?.length) {
        for (const path of step.fallbackPaths) {
          try {
            await page.goto(new URL(path, url).toString(), {
              waitUntil: "domcontentloaded",
              timeoutMs: 20000,
            });
            await page.waitForTimeout(5000);
            const bodyText = String(
              await page.evaluate("document.body?.innerText ?? ''")
            );
            const dead =
              bodyText.length < 300 ||
              /404|not found|page (doesn'?t|does not) exist/i.test(
                bodyText.slice(0, 2000)
              );
            if (!dead) {
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
        // Let the destination render (SPA transitions, lazy content), then
        // capture it — every step's screen becomes scoring evidence.
        await page.waitForTimeout(4000);
        shots.push(await capture());
      } else if (step.required) {
        const screenshots = await persistShots([await capture()]);
        return {
          area: journey,
          analysedAt: new Date().toISOString(),
          score: 0,
          blocked: true,
          blockReason: `The agent couldn't ${step.instruction.split(" — ")[0]} on this site${message ? ` (${message})` : ""}. Launch the site to capture this area manually.`,
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
        signupVars,
        trail,
        shots,
        capture
      );
    }

    if (DEEP_SCROLL_JOURNEYS.has(journey)) {
      const scrollShots = await captureScrollSequence({
        capture,
        scrollTo: async (y) => {
          await page.evaluate(`window.scrollTo(0, ${y})`);
        },
        getHeight: async () =>
          Number(await page.evaluate("document.documentElement.scrollHeight")),
      });
      if (shots.length) scrollShots.shift();
      shots.push(...scrollShots);
    } else {
      await page.scroll(720, 450, 0, 900);
      await page.waitForTimeout(1500);
      shots.push(await capture());
    }

    const pageTitle = await page.title().catch(() => "");
    const finalUrl = page.url();

    const [result, screenshots] = await Promise.all([
      scoreScreenshots(journey, pageTitle, finalUrl, shots, trail),
      persistShots(shots),
    ]);
    const analysis: JourneyAnalysis = {
      ...result,
      area: journey,
      analysedAt: new Date().toISOString(),
      screenshots,
      finalUrl,
      ...(authenticated !== undefined ? { authenticated } : {}),
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
        try {
          await page
            .goto(url, { waitUntil: "domcontentloaded", timeoutMs: 25000 })
            .catch(() => {});
          await page.waitForTimeout(5000);
          if (!(await agentIsLoggedIn(stagehand))) {
            trail.push(
              `skipped ${loginJourney} — session lost before logged-in pass`
            );
            break;
          }
          const chained = await walkPlaybookAndScore(
            stagehand,
            page,
            url,
            loginJourney,
            loginPlaybook,
            [`logged-in pass after signup`]
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
  trailPrefix: string[] = []
): Promise<JourneyAnalysis> {
  const capture = async () => {
    const { data } = await page.sendCDP<{ data: string }>(
      "Page.captureScreenshot",
      { format: "jpeg", quality: 60 }
    );
    return data;
  };

  const trail = [...trailPrefix];
  const shots: string[] = [];

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
      if (ok) break;
    }
    if (!ok && step.fallbackPaths?.length) {
      for (const path of step.fallbackPaths) {
        try {
          await page.goto(new URL(path, url).toString(), {
            waitUntil: "domcontentloaded",
            timeoutMs: 20000,
          });
          await page.waitForTimeout(5000);
          const bodyText = String(
            await page.evaluate("document.body?.innerText ?? ''")
          );
          const dead =
            bodyText.length < 300 ||
            /404|not found|page (doesn'?t|does not) exist/i.test(
              bodyText.slice(0, 2000)
            );
          if (!dead) {
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
      await page.waitForTimeout(4000);
      shots.push(await capture());
    } else if (step.required) {
      const screenshots = await persistShots([await capture()]);
      return {
        area: journey,
        analysedAt: new Date().toISOString(),
        score: 0,
        blocked: true,
        blockReason: `The agent couldn't ${step.instruction.split(" — ")[0]} on this site${message ? ` (${message})` : ""}. Launch the site to capture this area manually.`,
        summary: "",
        heuristics: [],
        observations: [],
        features: [],
        screenshots,
        finalUrl: page.url(),
      };
    }
  }

  if (DEEP_SCROLL_JOURNEYS.has(journey)) {
    const scrollShots = await captureScrollSequence({
      capture,
      scrollTo: async (y) => {
        await page.evaluate(`window.scrollTo(0, ${y})`);
      },
      getHeight: async () =>
        Number(await page.evaluate("document.documentElement.scrollHeight")),
    });
    if (shots.length) scrollShots.shift();
    shots.push(...scrollShots);
  } else {
    await page.scroll(720, 450, 0, 900);
    await page.waitForTimeout(1500);
    shots.push(await capture());
  }

  const pageTitle = await page.title().catch(() => "");
  const finalUrl = page.url();
  const [result, screenshots] = await Promise.all([
    scoreScreenshots(journey, pageTitle, finalUrl, shots, trail),
    persistShots(shots),
  ]);
  return {
    ...result,
    area: journey,
    analysedAt: new Date().toISOString(),
    screenshots,
    finalUrl,
  };
}

/** The landing path: straight visit, no navigation needed. */
async function analyzeLanding(
  url: string,
  contextId?: string | null,
  proxyCountry?: string | null
): Promise<JourneyAnalysis> {
  const journey = "landing";
  const { id, connectUrl } = await createSession(
    undefined,
    contextId ?? undefined,
    proxyCountry
  );
  try {
    const browser = await chromium.connectOverCDP(connectUrl);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());
    await page.setViewportSize({ width: 1440, height: 900 });

    await page
      .goto(url, { waitUntil: "domcontentloaded", timeout: 25000 })
      .catch(() => {});
    // Let Cloudflare interstitials resolve and lazy content render. Heavy
    // casino SPAs can sit on a branded splash for several seconds.
    await page.waitForTimeout(10000);

    // Raw CDP capture: unlike page.screenshot() it doesn't wait for page
    // stability, so bot-challenge pages that never settle can't stall us.
    const cdp = await context.newCDPSession(page);
    const capture = async () => {
      const { data } = (await cdp.send("Page.captureScreenshot", {
        format: "jpeg",
        quality: 60,
      })) as { data: string };
      return data;
    };

    const shots = await captureScrollSequence({
      capture,
      scrollTo: async (y) => {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
      },
      getHeight: async () =>
        page.evaluate(() => document.documentElement.scrollHeight),
    });

    const pageTitle = await page.title().catch(() => "");
    const finalUrl = page.url();
    await browser.close().catch(() => {});

    const [result, screenshots] = await Promise.all([
      scoreScreenshots(journey, pageTitle, finalUrl, shots),
      persistShots(shots),
    ]);
    return {
      ...result,
      area: journey,
      analysedAt: new Date().toISOString(),
      screenshots,
      finalUrl,
    };
  } finally {
    await releaseSession(id);
  }
}
