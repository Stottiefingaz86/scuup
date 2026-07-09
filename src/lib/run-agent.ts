"use client";

import { useSyncExternalStore } from "react";
import { getProject, saveAnalysis } from "./project-store";
import type { Brand, JourneyAnalysis } from "./types";

/** In-flight agent runs, shared across every component so the same
 * brand+area can't be launched twice and every button reflects progress. */
const inflight = new Map<string, Promise<JourneyAnalysis>>();
let runningKeys: string[] = [];
const listeners = new Set<() => void>();

function emit() {
  runningKeys = [...inflight.keys()];
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function agentKey(brandId: string, area: string): string {
  return `${brandId}:${area}`;
}

/** Turn raw infrastructure errors into something a user can act on. */
export function friendlyAgentError(err: Error): string {
  const m = err.message;
  if (/429|concurrent|rate.?limit/i.test(m)) {
    return "Too many browser sessions at once — your Browserbase plan limits concurrent sessions. Wait for the running agents to finish and retry.";
  }
  if (/timeout|timed out/i.test(m)) {
    return "The run timed out — the site was slow or the agent got stuck. Retry, or launch the site manually if it keeps happening.";
  }
  if (/proxy|geo/i.test(m)) {
    return "The site appears to geo-block the agent's location. Set BROWSERBASE_PROXY_COUNTRY to route through the right market.";
  }
  return m;
}

/** Keys of currently running agent analyses (`brandId:area`). */
export function useRunningAgents(): string[] {
  return useSyncExternalStore(
    subscribe,
    () => runningKeys,
    () => []
  );
}

/** Run the journey agent for one brand+area and persist the result. */
export function runAgent(
  projectId: string,
  brand: Pick<Brand, "id" | "url">,
  area: string
): Promise<JourneyAnalysis> {
  const key = agentKey(brand.id, area);
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: brand.url,
        journey: area,
        brandId: brand.id,
        market: getProject(projectId)?.market ?? "",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? `analysis failed (${res.status})`);
    }
    const analysis = data as JourneyAnalysis;
    saveAnalysis(projectId, brand.id, analysis);
    return analysis;
  })();

  inflight.set(key, promise);
  emit();
  promise
    .catch(() => {})
    .finally(() => {
      inflight.delete(key);
      emit();
    });
  return promise;
}

/** Run many agent analyses with limited concurrency (remote browser +
 * model calls per run — don't stampede the session pool). Returns failures
 * so callers can tell the user exactly what didn't run and why. */
export async function runAgentBatch(
  projectId: string,
  jobs: { brand: Pick<Brand, "id" | "url" | "name">; area: string }[],
  concurrency = 2
): Promise<{ brand: string; area: string; error: string }[]> {
  const queue = [...jobs];
  const failures: { brand: string; area: string; error: string }[] = [];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (;;) {
        const job = queue.shift();
        if (!job) return;
        try {
          await runAgent(projectId, job.brand, job.area);
        } catch (e) {
          failures.push({
            brand: job.brand.name,
            area: job.area,
            error: friendlyAgentError(
              e instanceof Error ? e : new Error(String(e))
            ),
          });
        }
      }
    })
  );
  return failures;
}
