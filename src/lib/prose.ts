/** Strip em/en dashes from text shown to users or returned by models. */
import type {
  ActionPlan,
  DesignReview,
  Project,
  VocAnalysis,
} from "./types";

export function sanitizeProse(text: string): string {
  if (!text.includes("—") && !text.includes("–")) return text;

  let out = text
    .replace(/\s—\s(?=[A-Z])/g, ". ")
    .replace(/\s—\s/g, ", ")
    .replace(/\s–\s/g, ", ")
    .replace(/—/g, ", ")
    .replace(/–/g, ", ");

  out = out
    .replace(/,\s*,/g, ",")
    .replace(/\.\s*\./g, ".")
    .replace(/,\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();

  return out;
}

/** Instruction appended to analyst / copy prompts. */
export const PLAIN_PROSE_RULE =
  "Write in plain professional English. Do not use em dashes (—) or en dashes (–). Use periods, commas, or colons instead.";

/** Sanitize all user-visible strings on a journey analysis result. */
export function sanitizeAnalysisProse<
  T extends {
    summary?: string;
    blockReason?: string | null;
    heuristics?: { name: string; score: number; note: string }[];
    observations?: (
      | string
      | { text: string; shot?: number | null; region?: unknown }
    )[];
    features?: { note?: string; name?: string }[];
    retentionNotes?: { note: string; improve: string; key: string; shot?: number | null }[];
    loyaltySnapshot?: {
      ftdOffer: string | null;
      cadence: string | null;
      tiers: { name: string; perks: string }[];
    } | null;
  },
>(result: T): T {
  return {
    ...result,
    summary: result.summary ? sanitizeProse(result.summary) : result.summary,
    blockReason: result.blockReason
      ? sanitizeProse(result.blockReason)
      : result.blockReason,
    heuristics: result.heuristics?.map((h) => ({
      ...h,
      note: sanitizeProse(h.note),
    })),
    observations: result.observations?.map((o) =>
      typeof o === "string"
        ? sanitizeProse(o)
        : { ...o, text: sanitizeProse(o.text) }
    ),
    features: result.features?.map((f) => ({
      ...f,
      note: f.note ? sanitizeProse(f.note) : f.note,
    })),
    retentionNotes: result.retentionNotes?.map((n) => ({
      ...n,
      note: sanitizeProse(n.note),
      improve: sanitizeProse(n.improve),
    })),
    loyaltySnapshot: result.loyaltySnapshot
      ? {
          ...result.loyaltySnapshot,
          ftdOffer: result.loyaltySnapshot.ftdOffer
            ? sanitizeProse(result.loyaltySnapshot.ftdOffer)
            : null,
          cadence: result.loyaltySnapshot.cadence
            ? sanitizeProse(result.loyaltySnapshot.cadence)
            : null,
          tiers: result.loyaltySnapshot.tiers.map((t) => ({
            ...t,
            name: sanitizeProse(t.name),
            perks: sanitizeProse(t.perks),
          })),
        }
      : result.loyaltySnapshot,
  };
}

export function sanitizeDesignReview(review: DesignReview): DesignReview {
  return {
    ...review,
    summary: sanitizeProse(review.summary),
    themeNote: sanitizeProse(review.themeNote),
    typography: sanitizeProse(review.typography),
    stack: {
      ...review.stack,
      evidence: sanitizeProse(review.stack.evidence),
      verdict: review.stack.verdict
        ? sanitizeProse(review.stack.verdict)
        : review.stack.verdict,
    },
    craft: review.craft
      ? { ...review.craft, note: sanitizeProse(review.craft.note) }
      : review.craft,
    accessibility: {
      ...review.accessibility,
      findings: review.accessibility.findings.map((f) => ({
        ...f,
        note: sanitizeProse(f.note),
      })),
    },
    consistency: {
      ...review.consistency,
      note: sanitizeProse(review.consistency.note),
    },
    journeyNotes: review.journeyNotes.map((j) => ({
      ...j,
      note: sanitizeProse(j.note),
    })),
    strengths: review.strengths.map(sanitizeProse),
    improvements: review.improvements.map(sanitizeProse),
  };
}

export function sanitizeVocAnalysis(voc: VocAnalysis): VocAnalysis {
  const theme = (t: VocAnalysis["positives"][number]) => ({
    ...t,
    theme: sanitizeProse(t.theme),
    insight: sanitizeProse(t.insight),
    quotes: t.quotes.map((q) => ({ ...q, text: sanitizeProse(q.text) })),
  });
  return {
    ...voc,
    summary: sanitizeProse(voc.summary),
    positives: voc.positives.map(theme),
    negatives: voc.negatives.map(theme),
    alignment: voc.alignment.map((a) => ({
      ...a,
      note: sanitizeProse(a.note),
    })),
  };
}

export function sanitizeActionPlan(plan: ActionPlan): ActionPlan {
  return {
    ...plan,
    recommendations: plan.recommendations.map((r) => ({
      ...r,
      title: sanitizeProse(r.title),
      description: sanitizeProse(r.description),
      evidence: sanitizeProse(r.evidence),
    })),
  };
}

/** Strip em dashes from all stored analysis copy when loading a project. */
export function sanitizeProject(project: Project): Project {
  return {
    ...project,
    brands: project.brands.map((b) => ({
      ...b,
      analyses: Object.fromEntries(
        Object.entries(b.analyses).map(([area, analysis]) => [
          area,
          sanitizeAnalysisProse(analysis),
        ])
      ),
      voc: b.voc ? sanitizeVocAnalysis(b.voc) : b.voc,
      design: b.design ? sanitizeDesignReview(b.design) : b.design,
    })),
    actionPlan: project.actionPlan
      ? sanitizeActionPlan(project.actionPlan)
      : project.actionPlan,
  };
}
