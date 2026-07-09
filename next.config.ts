import type { NextConfig } from "next";

const playwrightTrace = ["./node_modules/playwright-core/**/*"];

const nextConfig: NextConfig = {
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

export default nextConfig;
