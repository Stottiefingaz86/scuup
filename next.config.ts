import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const playwrightTrace = ["./node_modules/playwright-core/**/*"];

const productionAppUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined);

const nextConfig: NextConfig = {
  env: {
    ...(productionAppUrl ? { NEXT_PUBLIC_APP_URL: productionAppUrl } : {}),
  },
  // playwright-core ships browsers.json that Turbopack's file tracer drops
  // from the serverless bundle — externalise so the full package loads at
  // runtime, and explicitly include its assets in the trace.
  serverExternalPackages: ["playwright-core", "@browserbasehq/stagehand"],
  outputFileTracingIncludes: {
    "/api/analyze": playwrightTrace,
    "/api/capture/*": playwrightTrace,
    "/api/brands/*": playwrightTrace,
  },
};

export default withSentryConfig(nextConfig, {
  org: "scuup",
  project: "javascript-nextjs",
  // Source map upload runs only when SENTRY_AUTH_TOKEN is set (CI/Vercel).
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  // Proxy events through our own domain so ad-blockers don't eat them.
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
