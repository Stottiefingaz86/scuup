import * as Sentry from "@sentry/nextjs";

/** Server-side error monitoring. Does nothing until SENTRY_DSN is set. */
export function register() {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Errors always; keep performance sampling low to stay in free tier.
    tracesSampleRate: 0.1,
  });
}

export const onRequestError = Sentry.captureRequestError;
