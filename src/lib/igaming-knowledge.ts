import knowledge from "./igaming-knowledge.json";

/**
 * Industry knowledgebase distilled from published iGaming research
 * (iGB reports, Bettormetrics trading reviews, market intelligence).
 *
 * Each source carries citeable insights tagged by journey area and market.
 * knowledgeFor() composes the relevant ones into the scoring prompt so the
 * analyst judges against current industry benchmarks, not just built-in
 * heuristics — and every borrowed fact stays attributable to its source.
 *
 * Refresh with: node scripts/ingest-igaming-reports.mjs
 */

export interface KnowledgeSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  date: string;
  /** Journey areas ("casino", "sports_betslip") and market tags ("market:Mexico"). */
  topics: string[];
  insights: string[];
}

const SOURCES = (knowledge as { sources: KnowledgeSource[] }).sources;

export function allKnowledgeSources(): KnowledgeSource[] {
  return SOURCES;
}

/** Newest-first cap on injected facts: keeps the prompt sharp and ensures
 * stale intel (the archive goes back to 2016) never displaces current
 * benchmarks. */
const MAX_FACTS = 12;

/** Industry research relevant to one journey (and optionally the audit's
 * market), formatted for the scoring prompt. Empty string when nothing
 * relevant exists — the prompt simply omits the section. */
export function knowledgeFor(journey: string, market?: string): string {
  const marketTag = market ? `market:${market.split(" (")[0]}` : null;
  const relevant = SOURCES.filter(
    (s) =>
      s.topics.includes(journey) ||
      (marketTag && s.topics.some((t) => t.startsWith(marketTag)))
  ).sort((a, b) => (a.date < b.date ? 1 : -1));
  if (relevant.length === 0) return "";

  // Facts only, no source names: the analyst speaks WITH this knowledge,
  // it never cites reports at the reader (attribution lives in the JSON
  // for our own auditing).
  const facts = relevant
    .flatMap((s) => s.insights)
    .slice(0, MAX_FACTS)
    .map((i) => `- ${i}`)
    .join("\n");

  return `\n\nYOUR INDUSTRY KNOWLEDGE — recent market intelligence you know as an operator-side expert. Let it sharpen your judgement and vocabulary where relevant. NEVER mention reports, studies, publications, surveys or data providers in your output — no "according to", "a report found", "industry data shows". State conclusions as your own expertise, and never invent numbers beyond what the screenshots show:\n${facts}`;
}
