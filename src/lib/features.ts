import type {
  Brand,
  DetectedFeature,
  FeatureMatrixRow,
  FeatureStatus,
  JourneyAnalysis,
  Priority,
  Project,
} from "./types";

const STATUS_RANK: Record<FeatureStatus, number> = {
  strong: 7,
  yes: 6,
  medium: 5,
  partial: 4,
  promo_led: 3,
  weak: 2,
  hidden: 1,
  no: 0,
};

function betterStatus(a: FeatureStatus, b: FeatureStatus): FeatureStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

/** Only structured features from the vision model count — never keyword
 * guessing. Older analyses without a features array simply don't appear
 * until the journey is re-run. */
function extractedFeatures(analysis: JourneyAnalysis): DetectedFeature[] {
  if (!analysis.features?.length) return [];
  return analysis.features.map((f) => ({
    ...f,
    source: "extracted" as const,
    area: f.area ?? analysis.area,
  }));
}

function featuresForBrand(brand: Brand): DetectedFeature[] {
  const all: DetectedFeature[] = [];
  for (const analysis of Object.values(brand.analyses)) {
    if (analysis.blocked) continue;
    all.push(...extractedFeatures(analysis));
  }
  return all;
}

function derivePriority(
  own: FeatureStatus | null,
  compBest: FeatureStatus | null
): Priority {
  if (!own && compBest && STATUS_RANK[compBest] >= 5) return "high";
  if (own && compBest && STATUS_RANK[compBest] - STATUS_RANK[own] >= 2)
    return "high";
  if (own === "no" || own === "weak" || own === "hidden") return "high";
  if (own === "partial") return "medium";
  return "low";
}

const PRIORITY_ORDER: Priority[] = ["critical", "high", "medium", "low"];

/** Build the side-by-side feature matrix from screenshot-detected features
 * only. */
export function buildFeatureMatrix(project: Project): FeatureMatrixRow[] {
  const featureMap = new Map<
    string,
    { category: string; values: Record<string, FeatureStatus | null> }
  >();

  for (const brand of project.brands) {
    for (const f of featuresForBrand(brand)) {
      if (!featureMap.has(f.name)) {
        featureMap.set(f.name, { category: f.category, values: {} });
      }
      const row = featureMap.get(f.name)!;
      const prev = row.values[brand.id];
      row.values[brand.id] = prev
        ? betterStatus(prev, f.status)
        : f.status;
    }
  }

  const own = project.brands.find((b) => b.role === "own_brand")!;
  const competitors = project.brands.filter((b) => b.role !== "own_brand");

  const rows: FeatureMatrixRow[] = [];
  for (const [feature, { category, values }] of featureMap) {
    const compStatuses = competitors
      .map((c) => values[c.id])
      .filter((v): v is FeatureStatus => v != null);
    const compBest = compStatuses.length
      ? compStatuses.reduce((a, b) => betterStatus(a, b))
      : null;
    rows.push({
      feature,
      category,
      priority: derivePriority(values[own.id] ?? null, compBest),
      values,
    });
  }

  rows.sort((a, b) => {
    const pd =
      PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
    if (pd !== 0) return pd;
    return a.feature.localeCompare(b.feature);
  });

  return rows;
}

/** How many journey analyses have screenshots but no extracted features yet. */
export function analysesNeedingFeatureExtract(project: Project): number {
  let n = 0;
  for (const brand of project.brands) {
    for (const analysis of Object.values(brand.analyses)) {
      if (
        !analysis.blocked &&
        !analysis.features?.length &&
        analysis.screenshots?.length
      ) {
        n += 1;
      }
    }
  }
  return n;
}

export function totalFeaturesDetected(project: Project): number {
  return buildFeatureMatrix(project).length;
}
