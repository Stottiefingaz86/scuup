import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN } from "./lib/observability";

Sentry.init({
  dsn: SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // Attach local variable values to server stack frames.
  includeLocalVariables: true,
  enableLogs: true,
});
