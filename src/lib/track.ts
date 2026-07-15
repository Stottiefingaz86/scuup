"use client";

import posthog from "posthog-js";

/**
 * Product analytics events, one vocabulary for the whole app so PostHog
 * insights don't fragment into near-duplicate event names.
 *
 * The funnel: signup_completed -> report_created -> agent_run_started
 * -> checkout_started -> plan_purchased (fired server-side by Stripe
 * webhook data in PostHog later; checkout_started is the client edge).
 */
export type AppEvent =
  | "signup_completed"
  | "logged_in"
  | "report_created"
  | "agent_run_started"
  | "agent_run_failed"
  | "checkout_started"
  | "billing_portal_opened"
  | "invite_sent";

export function track(
  event: AppEvent,
  properties?: Record<string, string | number | boolean | null>
): void {
  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics must never break the product.
  }
}
