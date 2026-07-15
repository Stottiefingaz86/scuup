import { chromium } from "playwright-core";
import { createSession, releaseSession } from "./browserbase";
import { ANALYSIS_AREA_LABELS } from "./constants";
import { PLAIN_PROSE_RULE, sanitizeVocAnalysis } from "./prose";
import type {
  Brand,
  Project,
  VocAnalysis,
  VocTheme,
  VocAlignment,
} from "./types";

/**
 * Voice of Customer: scrape a brand's public Trustpilot reviews through a
 * Browserbase session (which clears the Cloudflare wall), then have the
 * analyst turn them into themes, quotes and a cross-check against what the
 * audit measured — where customers confirm our scores, where they
 * contradict them, and what they complain about that we can't see from
 * the outside (payouts, support response times, account closures).
 */

interface ScrapedReview {
  rating: number;
  title: string;
  text: string;
  date: string;
  replied: boolean;
}

interface TrustpilotScrape {
  sourceUrl: string;
  trustScore: number | null;
  totalReviews: number | null;
  reviews: ScrapedReview[];
}

const REVIEW_PAGES = 5; // 20 reviews per page → up to 100 sampled

export function trustpilotHost(brandUrl: string): string {
  const host = new URL(
    brandUrl.startsWith("http") ? brandUrl : `https://${brandUrl}`
  ).hostname;
  return host.replace(/^www\./, "");
}

/** Pull recent reviews from trustpilot.com/review/{domain}. Throws when the
 * brand has no Trustpilot profile. */
export async function scrapeTrustpilot(
  brandUrl: string
): Promise<TrustpilotScrape> {
  const domain = trustpilotHost(brandUrl);
  const sourceUrl = `https://www.trustpilot.com/review/${domain}`;
  // Always a US residential proxy: datacenter egress gets a stripped page
  // from Trustpilot (no business data), and the US site is the canonical
  // English review corpus regardless of the audited market.
  const session = await createSession(undefined, undefined, "US");
  const browser = await chromium.connectOverCDP(session.connectUrl);

  try {
    const page = browser.contexts()[0].pages()[0];
    let trustScore: number | null = null;
    let totalReviews: number | null = null;
    const reviews: ScrapedReview[] = [];

    for (let p = 1; p <= REVIEW_PAGES; p++) {
      const url = `${sourceUrl}?sort=recency${p > 1 ? `&page=${p}` : ""}`;
      await page
        .goto(url, { waitUntil: "domcontentloaded", timeout: 45000 })
        .catch(() => {});

      // Cloudflare interstitial: poll until the real page renders —
      // Browserbase solves the challenge in the background. Later pages
      // reuse the clearance cookie and pass immediately.
      let raw: string | null = null;
      for (let i = 0; i < 20 && !raw; i++) {
        raw = await page
          .evaluate(
            () =>
              document.getElementById("__NEXT_DATA__")?.textContent ?? null
          )
          .catch(() => null);
        if (!raw) await page.waitForTimeout(1500);
      }
      if (!raw) {
        if (p === 1) {
          throw new Error(
            `Couldn't reach the Trustpilot page for ${domain}. The review site did not load.`
          );
        }
        break;
      }

      const json = JSON.parse(raw) as {
        props?: {
          pageProps?: {
            businessUnit?: {
              trustScore?: number;
              numberOfReviews?: number;
            } | null;
            reviews?: {
              rating?: number;
              title?: string;
              text?: string;
              dates?: { publishedDate?: string };
              reply?: unknown;
            }[];
          };
        };
      };
      const pp = json.props?.pageProps;
      if (p === 1) {
        if (!pp?.businessUnit) {
          throw new Error(
            `${domain} has no Trustpilot profile. No public reviews to analyse.`
          );
        }
        trustScore = pp.businessUnit.trustScore ?? null;
        totalReviews = pp.businessUnit.numberOfReviews ?? null;
      }
      const pageReviews = pp?.reviews ?? [];
      for (const r of pageReviews) {
        if (!r.rating) continue;
        reviews.push({
          rating: r.rating,
          title: r.title ?? "",
          text: (r.text ?? "").slice(0, 600),
          date: r.dates?.publishedDate ?? "",
          replied: r.reply != null,
        });
      }
      if (pageReviews.length < 20) break; // last page reached
    }

    if (reviews.length === 0) {
      throw new Error(
        `${domain} has a Trustpilot profile but no readable reviews.`
      );
    }
    return { sourceUrl, trustScore, totalReviews, reviews };
  } finally {
    await browser.close().catch(() => {});
    await releaseSession(session.id).catch(() => {});
  }
}

/* ---------------------------------------------------------------- */

const THEME_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      theme: { type: "string" },
      area: { type: ["string", "null"] },
      mentions: { type: "number" },
      insight: { type: "string" },
      quotes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string" },
            rating: { type: "number" },
            date: { type: "string" },
          },
          required: ["text", "rating", "date"],
        },
      },
    },
    required: ["theme", "area", "mentions", "insight", "quotes"],
  },
} as const;

const VOC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    positives: THEME_SCHEMA,
    negatives: THEME_SCHEMA,
    alignment: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          area: { type: "string" },
          verdict: { type: "string", enum: ["confirms", "contradicts", "gap"] },
          note: { type: "string" },
        },
        required: ["area", "verdict", "note"],
      },
    },
  },
  required: ["summary", "positives", "negatives", "alignment"],
} as const;

/** What the audit measured for this brand — the LLM cross-checks reviews
 * against exactly this, so every alignment note points at real numbers. */
function reportContext(project: Project, brand: Brand): string {
  const lines: string[] = [];
  for (const [area, a] of Object.entries(brand.analyses)) {
    const label = ANALYSIS_AREA_LABELS[area] ?? area;
    if (a.blocked) {
      lines.push(`- ${label}: NOT SCORED (agent blocked: ${a.blockReason ?? "unknown"})`);
      continue;
    }
    lines.push(`- ${label}: scored ${a.score}/100 — ${a.summary}`);
  }
  const features = [
    ...new Set(
      Object.values(brand.analyses).flatMap((a) =>
        (a.features ?? []).map((f) => f.name)
      )
    ),
  ];
  if (features.length) {
    lines.push(`- Features detected on the site: ${features.join(", ")}`);
  }
  const loyalty = Object.values(brand.analyses).find(
    (a) => a.loyaltySnapshot
  )?.loyaltySnapshot;
  if (loyalty) {
    lines.push(
      `- Loyalty observed: FTD offer: ${loyalty.ftdOffer ?? "none visible"}; tiers: ${loyalty.tiers.map((t) => t.name).join(", ") || "none"}; cadence: ${loyalty.cadence ?? "none visible"}`
    );
  }
  lines.push(`- Market audited: ${project.market}`);
  return lines.join("\n");
}

/** Turn scraped reviews into the analyst's VoC read. */
export async function buildVocAnalysis(
  project: Project,
  brand: Brand,
  scrape: TrustpilotScrape
): Promise<VocAnalysis> {
  const split = { positive: 0, neutral: 0, negative: 0 };
  for (const r of scrape.reviews) {
    if (r.rating >= 4) split.positive++;
    else if (r.rating === 3) split.neutral++;
    else split.negative++;
  }

  const reviewBlock = scrape.reviews
    .map(
      (r, i) =>
        `[${i}] ${r.rating}★ ${r.date.slice(0, 10)}${r.replied ? " (brand replied)" : ""} — ${r.title ? r.title + ": " : ""}${r.text.replace(/\s+/g, " ")}`
    )
    .join("\n");

  const areas = Object.keys(ANALYSIS_AREA_LABELS).join(", ");

  const prompt = `You are PlayerScope's voice-of-customer analyst for iGaming. Below are ${scrape.reviews.length} recent public reviews of ${brand.name}, plus what our own product audit measured on their site. Your job: what are customers ACTUALLY saying, and does it match what we measured?

RULES:
- Themes must come from the reviews, in customer language ("Withdrawals stuck for days", not "payment friction"). Merge duplicates; count mentions honestly from the reviews given.
- positives = what customers praise (from 4-5★ reviews mostly). negatives = what needs attention (from 1-3★). 3-5 themes each, strongest/most damaging first. Skip themes with fewer than 2 mentions unless severe (e.g. account closures with funds held).
- Each theme: map "area" to one of [${areas}] when it corresponds, else null. 1-2 SHORT verbatim quotes (translate to English if needed, trim to one sentence). "insight" = one sentence a product team can act on.
- Review-farming signals: if many 5★ reviews are one-line generic praise posted in bursts, note that in the summary — don't count them as a real strength.
- alignment: compare reviews against the audit below. For each meaningful link output one item: verdict "confirms" (reviews echo what we scored), "contradicts" (reviews clash with a score — e.g. we scored withdrawals 80 but reviews are full of payout complaints), or "gap" (reviews reveal something the audit cannot see from outside: real payout speed, support quality after deposit, account closures, bonus confiscation). Cite the audit number in the note when relevant. 2-5 items, most important first.
- summary: 2 sentences max — the verdict a CEO reads. Overall sentiment, the one thing to fix first, and whether reviews look organic.
- Never invent numbers. Mentions counts must be countable in the reviews provided.

OUR AUDIT OF ${brand.name.toUpperCase()} (for alignment only — do not restate as customer opinion):
${reportContext(project, brand)}

REVIEWS (recent first):
${reviewBlock}

${PLAIN_PROSE_RULE}`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      reasoning: { effort: "low" },
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      text: {
        format: {
          type: "json_schema",
          name: "voc_analysis",
          schema: VOC_SCHEMA,
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
  const parsed = JSON.parse(text) as {
    summary: string;
    positives: VocTheme[];
    negatives: VocTheme[];
    alignment: VocAlignment[];
  };

  return sanitizeVocAnalysis({
    source: "trustpilot",
    sourceUrl: scrape.sourceUrl,
    fetchedAt: new Date().toISOString(),
    trustScore: scrape.trustScore,
    totalReviews: scrape.totalReviews,
    sampled: scrape.reviews.length,
    ratingSplit: split,
    summary: parsed.summary,
    positives: parsed.positives,
    negatives: parsed.negatives,
    alignment: parsed.alignment,
  });
}
