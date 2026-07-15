import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import {
  POSTHOG_HOST,
  POSTHOG_KEY,
  SENTRY_DSN,
} from "./lib/observability";

Sentry.init({
  dsn: SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // 10% of all sessions recorded, 100% of sessions that hit an error.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
  integrations: [Sentry.replayIntegration()],
});

posthog.init(POSTHOG_KEY, {
  api_host: POSTHOG_HOST,
  defaults: "2025-05-24",
  capture_exceptions: false, // Sentry owns errors.
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
