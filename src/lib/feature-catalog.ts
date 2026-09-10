/** Curated iGaming features for competitive comparison — one row per
 * capability, no synonym sprawl. Extraction must use these exact names. */
import type { FeatureStatus } from "./types";

export interface CatalogFeature {
  name: string;
  category: string;
  aliases: string[];
}

export const FEATURE_CATALOG: CatalogFeature[] = [
  { name: "Welcome offer", category: "Acquisition", aliases: ["welcome bonus", "ftd offer"] },
  { name: "Live chat", category: "Support", aliases: ["live support", "24/7 support", "24/7 live support", "chat support"] },
  { name: "Help centre", category: "Support", aliases: ["help center", "helpcentre", "faq", "knowledge base"] },
  { name: "Casino search", category: "Casino", aliases: ["game search", "search games"] },
  { name: "Live casino", category: "Casino", aliases: ["live dealer", "live dealers"] },
  { name: "Game shows", category: "Casino", aliases: ["game show"] },
  { name: "Live wins feed", category: "Casino", aliases: ["recent wins", "win feed", "live wins"] },
  { name: "Jackpot games", category: "Casino", aliases: ["jackpots", "progressive jackpot"] },
  { name: "Provider filters", category: "Casino", aliases: ["game providers", "provider filter"] },
  { name: "Originals", category: "Casino", aliases: ["in-house games", "proprietary games"] },
  { name: "Sportsbook", category: "Sports", aliases: ["sports book", "sports betting"] },
  { name: "Bet builder", category: "Sports", aliases: ["same game parlay", "bet builder"] },
  { name: "Cashout", category: "Sports", aliases: ["cash out", "early cashout"] },
  { name: "Live bets feed", category: "Sports", aliases: ["live betting", "live matches", "in-play feed"] },
  { name: "Expert tips", category: "Sports", aliases: ["betting tips", "picks"] },
  { name: "VIP levels", category: "Loyalty / Rewards", aliases: ["vip tiers", "loyalty tiers", "tier system"] },
  { name: "Rakeback", category: "Loyalty / Rewards", aliases: ["cashback", "rebate"] },
  { name: "Weekly bonus", category: "Loyalty / Rewards", aliases: ["weekly reload"] },
  { name: "Daily bonus", category: "Loyalty / Rewards", aliases: ["daily rewards", "daily spin", "calendar rewards"] },
  { name: "Missions / streaks", category: "Loyalty / Rewards", aliases: ["missions", "streaks", "challenges", "quests"] },
  { name: "Leaderboards", category: "Loyalty / Rewards", aliases: ["leaderboard", "races"] },
  { name: "Crypto payments", category: "Payments", aliases: ["crypto deposit", "bitcoin deposit"] },
  { name: "Fiat on-ramp", category: "Payments", aliases: ["card deposit", "apple pay", "buy crypto"] },
  { name: "Free spins", category: "Acquisition", aliases: ["free spin"] },
  { name: "Provably fair", category: "Casino", aliases: ["provably fair games"] },
];

const ALIAS_TO_CANONICAL = new Map<string, { name: string; category: string }>();

for (const f of FEATURE_CATALOG) {
  ALIAS_TO_CANONICAL.set(f.name.toLowerCase(), {
    name: f.name,
    category: f.category,
  });
  for (const alias of f.aliases) {
    ALIAS_TO_CANONICAL.set(alias.toLowerCase(), {
      name: f.name,
      category: f.category,
    });
  }
}

/** Footer/compliance noise — not product capabilities. */
const DROP_NAME =
  /\b(licensed|licence|license|regulated|curacao|malta gaming|18\+|gamble responsibly|copyright)\b/i;

/** Map a raw model name to a canonical feature, or null to drop. */
export function normalizeFeature(
  name: string,
  category?: string
): { name: string; category: string } | null {
  const trimmed = name.trim();
  if (!trimmed || DROP_NAME.test(trimmed)) return null;
  const key = trimmed.toLowerCase();
  const hit = ALIAS_TO_CANONICAL.get(key);
  if (hit) return hit;
  // Fuzzy: catalog name contained in raw string
  for (const f of FEATURE_CATALOG) {
    if (key.includes(f.name.toLowerCase())) {
      return { name: f.name, category: f.category };
    }
  }
  // Unknown features add matrix noise — drop unless exact catalog match
  const exact = FEATURE_CATALOG.find(
    (f) => f.name.toLowerCase() === key
  );
  if (exact) return { name: exact.name, category: exact.category };
  void category;
  return null;
}

export function featureCatalogPrompt(): string {
  const byCategory = new Map<string, string[]>();
  for (const f of FEATURE_CATALOG) {
    const list = byCategory.get(f.category) ?? [];
    list.push(f.name);
    byCategory.set(f.category, list);
  }
  const lines = [...byCategory.entries()].map(
    ([cat, names]) => `${cat}: ${names.join(", ")}`
  );
  return `ALLOWED FEATURE NAMES (use EXACTLY one of these — no synonyms, no extras):
${lines.join("\n")}

Rules:
- Maximum 6 features per journey — only the most important visible capabilities.
- One name per capability (never list both "Live chat" and "24/7 support").
- Do NOT list footer badges, license text, or compliance copy as features.
- If nothing from the list is clearly visible, return an empty array.`;
}

export function isCompetitiveGap(
  own: FeatureStatus | null,
  compBest: FeatureStatus | null
): boolean {
  if (!compBest) return false;
  const rank: Record<FeatureStatus, number> = {
    strong: 7,
    yes: 6,
    medium: 5,
    partial: 4,
    promo_led: 3,
    weak: 2,
    hidden: 1,
    no: 0,
  };
  if (!own) return rank[compBest] >= 5;
  return rank[compBest] - rank[own] >= 2;
}
