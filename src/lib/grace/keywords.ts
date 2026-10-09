import { POKER_KEYWORDS } from "./analysis";

export interface KeywordGroup {
  id: string;
  name: string;
  locked?: boolean;
  keywords: string[];
}

export const CASINO_KEYWORDS: string[] = [
  "casino",
  "slots",
  "roulette",
  "blackjack",
  "baccarat",
  "live casino",
  "table game",
  "crash",
  "scratch",
  "bingo",
  "casino bonus",
  "wagering",
  "spin",
  "progressive",
];

export const SPORTS_KEYWORDS: string[] = [
  "sportsbook",
  "betting",
  "odds",
  "parlay",
  "spread",
  "moneyline",
  "live betting",
  "props",
  "soccer",
  "nfl",
  "nba",
  "mlb",
  "ufc",
  "bet slip",
];

export const ALL_GROUPS_ID = "all";

export function defaultKeywordGroups(custom: string[] = []): KeywordGroup[] {
  const poker = [...POKER_KEYWORDS];
  for (const k of custom) {
    if (!poker.some((p) => p.toLowerCase() === k.toLowerCase())) poker.push(k);
  }
  return [
    { id: "poker", name: "Poker", keywords: poker },
    { id: "casino", name: "Casino", keywords: [...CASINO_KEYWORDS] },
    { id: "sports", name: "Sports", keywords: [...SPORTS_KEYWORDS] },
  ];
}

export function normalizeKeywordGroups(raw: unknown, custom: string[] = []): KeywordGroup[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultKeywordGroups(custom);
  const out: KeywordGroup[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Partial<KeywordGroup>;
    const name = String(r.name ?? "").trim();
    if (!name) continue;
    const id = slugGroupId(String(r.id ?? name), seen);
    seen.add(id);
    const keywords = Array.isArray(r.keywords)
      ? [...new Set(r.keywords.map((k) => String(k).trim()).filter(Boolean))]
      : [];
    out.push({ id, name, keywords });
  }
  return out.length ? out : defaultKeywordGroups(custom);
}

export function slugGroupId(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "group";
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export function allGroupKeywords(groups: KeywordGroup[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of groups) {
    for (const k of g.keywords) {
      const key = k.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(k);
    }
  }
  return out;
}

export function pokerGroupTerms(groups: KeywordGroup[]): string[] {
  return groups.find((g) => g.id === "poker")?.keywords ?? [...POKER_KEYWORDS];
}

export function isAllInGroup(keywords: string[], group: KeywordGroup): boolean {
  if (!group.keywords.length) return false;
  const set = new Set(keywords.map((k) => k.toLowerCase()));
  return group.keywords.every((k) => set.has(k.toLowerCase()));
}

export function isAllGroupsFilter(keywords: string[], groups: KeywordGroup[]): boolean {
  const all = allGroupKeywords(groups);
  return all.length > 0 && isAllInGroup(keywords, { id: ALL_GROUPS_ID, name: "All groups", keywords: all });
}

export function groupFilterLabel(keywords: string[], groups: KeywordGroup[]): string {
  if (!keywords.length) return "All reviews";
  if (isAllGroupsFilter(keywords, groups)) return "All groups";
  const selected = new Set(keywords.map((k) => k.toLowerCase()));
  const complete = groups.filter(
    (g) => g.keywords.length > 0 && g.keywords.every((k) => selected.has(k.toLowerCase())),
  );
  const covered = new Set(complete.flatMap((g) => g.keywords.map((k) => k.toLowerCase())));
  const leftover = keywords.filter((k) => !covered.has(k.toLowerCase()));
  if (complete.length === 1 && leftover.length === 0) return complete[0].name;
  if (complete.length > 1 && leftover.length === 0) return complete.map((g) => g.name).join(" + ");
  if (keywords.length === 1) return keywords[0];
  return `${keywords[0]} +${keywords.length - 1}`;
}
