"use client";

import {
  applyRetentionGates,
  fillGatedRetentionNotes,
  RETENTION_MECHANIC_META,
} from "./retention-scoring";
import { saveAnalysis } from "./project-store";
import type { JourneyAnalysis, Project, RetentionMechanicNote } from "./types";

const LOYALTY = "loyalty_rewards";

export interface RetentionBackfillJob {
  brandId: string;
  brandName: string;
}

function retentionContext(analysis: JourneyAnalysis) {
  return analysis.retentionContext ?? { loggedIn: false, fromSession: false };
}

function hasStaleLoginAdvice(analysis: JourneyAnalysis): boolean {
  const ctx = retentionContext(analysis);
  if (ctx.loggedIn) return false;
  for (const note of analysis.retentionNotes ?? []) {
    const meta = RETENTION_MECHANIC_META.find((m) => m.key === note.key);
    if (meta?.requires === "login" && !note.note.startsWith("Not scored —")) {
      return true;
    }
  }
  const loginKeys = RETENTION_MECHANIC_META.filter(
    (m) => m.requires === "login"
  ).map((m) => m.key);
  if ((analysis.retentionNotes?.length ?? 0) > 0) {
    const hasGatedLoginNotes = loginKeys.every((k) =>
      analysis.retentionNotes?.some(
        (n) => n.key === k && n.note.startsWith("Not scored —")
      )
    );
    if (!hasGatedLoginNotes) return true;
  }
  return false;
}

function needsRetentionNotes(analysis: JourneyAnalysis): boolean {
  if (analysis.blocked || !analysis.retention || !analysis.screenshots?.length) {
    return false;
  }
  if (hasStaleLoginAdvice(analysis)) return true;
  const ctx = retentionContext(analysis);
  const gated = applyRetentionGates(analysis.retention, ctx);
  if (!gated) return false;
  const scoredKeys = Object.entries(gated).filter(([, v]) => v !== null).map(([k]) => k);
  if (scoredKeys.length === 0) return true;
  const noteKeys = new Set((analysis.retentionNotes ?? []).map((n) => n.key));
  return scoredKeys.some((k) => !noteKeys.has(k));
}

export function jobsNeedingRetentionNotes(project: Project): RetentionBackfillJob[] {
  const jobs: RetentionBackfillJob[] = [];
  for (const brand of project.brands) {
    const analysis = brand.analyses[LOYALTY];
    if (analysis && needsRetentionNotes(analysis)) {
      jobs.push({ brandId: brand.id, brandName: brand.name });
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

async function extractNotesForAnalysis(
  analysis: JourneyAnalysis
): Promise<RetentionMechanicNote[]> {
  const urls = analysis.screenshots ?? [];
  const shots: string[] = [];
  for (const url of urls) {
    const b64 = await shotUrlToBase64(url);
    if (b64) shots.push(b64);
  }
  if (shots.length === 0 || !analysis.retention) return [];

  const ctx = retentionContext(analysis);
  const res = await fetch("/api/retention/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      retention: analysis.retention,
      loggedIn: ctx.loggedIn,
      fromSession: ctx.fromSession,
      screenshots: shots,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.error === "string" ? err.error : "Retention notes extract failed"
    );
  }
  const data = (await res.json()) as { retentionNotes: RetentionMechanicNote[] };
  return data.retentionNotes;
}

/** Generate per-mechanic evidence notes from saved loyalty screenshots. */
export async function backfillRetentionNotes(
  projectId: string,
  project: Project,
  onProgress?: (done: number, total: number, label: string) => void
): Promise<{ ok: number; failed: { brand: string; error: string }[] }> {
  const jobs = jobsNeedingRetentionNotes(project);
  const failed: { brand: string; error: string }[] = [];
  let ok = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]!;
    onProgress?.(i, jobs.length, job.brandName);
    const brand = project.brands.find((b) => b.id === job.brandId);
    const analysis = brand?.analyses[LOYALTY];
    if (!analysis) continue;

    try {
      const ctx = retentionContext(analysis);
      const gated =
        applyRetentionGates(analysis.retention, ctx) ?? analysis.retention;
      const retentionNotes = ctx.loggedIn
        ? await extractNotesForAnalysis(analysis)
        : fillGatedRetentionNotes(gated, ctx, []);
      saveAnalysis(projectId, job.brandId, { ...analysis, retentionNotes });
      ok += 1;
    } catch (e) {
      failed.push({
        brand: job.brandName,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  onProgress?.(jobs.length, jobs.length, "Done");
  return { ok, failed };
}
