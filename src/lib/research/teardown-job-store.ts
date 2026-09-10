import "server-only";

import { supabase } from "@/lib/supabase-server";
import type { ResearchTeardownJob } from "./teardown-runtime";

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Write the live job so a poll on another Vercel isolate can still see it. */
export async function persistTeardownJob(
  job: ResearchTeardownJob,
): Promise<void> {
  try {
    const { error } = await supabase().from("research_teardown_jobs").upsert({
      id: job.id,
      payload: job,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[research/teardown] persist failed:", error.message);
    }
  } catch (e) {
    console.error(
      "[research/teardown] persist failed:",
      e instanceof Error ? e.message : e,
    );
  }
}

export function queuePersistTeardownJob(job: ResearchTeardownJob): void {
  const prev = timers.get(job.id);
  if (prev) clearTimeout(prev);
  timers.set(
    job.id,
    setTimeout(() => {
      timers.delete(job.id);
      void persistTeardownJob(job);
    }, 400),
  );
}

export async function loadTeardownJob(
  id: string,
): Promise<ResearchTeardownJob | null> {
  try {
    const { data, error } = await supabase()
      .from("research_teardown_jobs")
      .select("payload")
      .eq("id", id)
      .maybeSingle();
    if (error || !data?.payload) return null;
    return data.payload as ResearchTeardownJob;
  } catch {
    return null;
  }
}
