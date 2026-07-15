import * as Sentry from "@sentry/nextjs";

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

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
