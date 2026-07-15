import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

/** Browser-side error monitoring. Does nothing until the DSN is set. */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Session replays only on errors — visual repro without the quota cost.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.replayIntegration()],
  });
}

/** Product analytics. Does nothing until the PostHog key is set. */
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    defaults: "2025-05-24",
    capture_exceptions: false, // Sentry owns errors.
  });
}

export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse"
) {
  Sentry.captureRouterTransitionStart(url, navigationType);
}
