"use client";

import { saveAnalysis } from "./project-store";
import type { DetectedFeature, JourneyAnalysis, Project } from "./types";

export interface BackfillJob {
  brandId: string;
  brandName: string;
  area: string;
}

export function jobsNeedingFeatures(project: Project): BackfillJob[] {
  const jobs: BackfillJob[] = [];
  for (const brand of project.brands) {
    for (const [area, analysis] of Object.entries(brand.analyses)) {
      if (
        analysis &&
        !analysis.blocked &&
        !analysis.features?.length &&
        analysis.screenshots?.length
      ) {
        jobs.push({ brandId: brand.id, brandName: brand.name, area });
      }
    }
  }
  return jobs;
}

async function shotUrlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(",")[1] ?? null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function extractForAnalysis(
  area: string,
  analysis: JourneyAnalysis
): Promise<DetectedFeature[]> {
  const urls = analysis.screenshots ?? [];
  const shots: string[] = [];
  for (const url of urls) {
    const b64 = await shotUrlToBase64(url);
    if (b64) shots.push(b64);
  }
  if (shots.length === 0) return [];

  const res = await fetch("/api/features/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ journey: area, screenshots: shots }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.error === "string" ? err.error : "Feature extract failed"
    );
  }
  const data = (await res.json()) as { features: DetectedFeature[] };
  return data.features;
}

/** Scan existing evidence screenshots and extract features — no re-visit. */
export async function backfillFeatures(
  projectId: string,
  project: Project,
  onProgress?: (done: number, total: number, label: string) => void
): Promise<{ ok: number; failed: { brand: string; area: string; error: string }[] }> {
  const jobs = jobsNeedingFeatures(project);
  const failed: { brand: string; area: string; error: string }[] = [];
  let ok = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]!;
    onProgress?.(i, jobs.length, `${job.brandName} · ${job.area}`);
    const brand = project.brands.find((b) => b.id === job.brandId);
    const analysis = brand?.analyses[job.area];
    if (!analysis) continue;

    try {
      const features = await extractForAnalysis(job.area, analysis);
      saveAnalysis(projectId, job.brandId, { ...analysis, features });
      ok += 1;
    } catch (e) {
      failed.push({
        brand: job.brandName,
        area: job.area,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  onProgress?.(jobs.length, jobs.length, "Done");
  return { ok, failed };
}
