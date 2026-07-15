import { supabase } from "./supabase-server";
import type { Plan } from "./plan";

/**
 * Daily caps on the routes that spend real money (Browserbase sessions +
 * OpenAI vision calls). Generous enough that a legitimate user never sees
 * them; tight enough that a bug loop or abusive signup can't burn the
 * budget. Admins bypass entirely.
 */

export type RunKind = "analyze" | "voc" | "design" | "capture";

const DAILY_LIMITS: Record<RunKind, Record<Plan, number>> = {
  // One full audit is ~9 journeys x 5 brands = 45 runs; retries need slack.
  analyze: { free: 25, pro: 150, pro_plus: 400 },
  voc: { free: 5, pro: 25, pro_plus: 60 },
  design: { free: 5, pro: 25, pro_plus: 60 },
  capture: { free: 5, pro: 30, pro_plus: 60 },
};

export class RunLimitError extends Error {
  constructor(kind: RunKind) {
    super(
      kind === "analyze"
        ? "You've hit today's analysis limit. It resets at midnight UTC. If you're mid-audit, contact support and we'll raise it."
        : "You've hit today's usage limit for this feature. It resets at midnight UTC."
    );
    this.name = "RunLimitError";
  }
}

/** Throws RunLimitError when the user is over today's cap, otherwise
 * records this run. Admins skip the cap but still get logged so mission
 * control charts reflect real activity. Fails open on infrastructure
 * errors — a broken limiter must never block paying customers. */
export async function enforceRunLimit(
  userId: string,
  kind: RunKind,
  plan: Plan,
  isAdmin = false
): Promise<void> {
  try {
    if (!isAdmin) {
      const since = new Date();
      since.setUTCHours(0, 0, 0, 0);

      const { count, error } = await supabase()
        .from("ps_run_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("kind", kind)
        .gte("created_at", since.toISOString());

      if (!error && (count ?? 0) >= DAILY_LIMITS[kind][plan]) {
        throw new RunLimitError(kind);
      }
    }

    await supabase()
      .from("ps_run_log")
      .insert({ user_id: userId, kind });
  } catch (e) {
    if (e instanceof RunLimitError) throw e;
    console.error("[run-limits] check failed, allowing run:", e);
  }
}
