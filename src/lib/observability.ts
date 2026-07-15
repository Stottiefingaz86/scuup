/**
 * Monitoring/analytics endpoints. DSNs and publishable keys are public by
 * design (they only allow sending events, not reading data), so they ship
 * as defaults; env vars override per environment.
 */

export const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ??
  process.env.SENTRY_DSN ??
  "https://60f85342fcd531559424839d448b783a@o4511739959377920.ingest.de.sentry.io/4511739964817488";

export const POSTHOG_KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY ??
  "phc_ue8UPyBiBucHn8NyJbXhGNDwywc4SeeDvLyAVNiCg3uU";

export const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
