import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // playwright-core ships browsers.json that Turbopack's file tracer drops
  // from the serverless bundle — externalise so the full package loads at
  // runtime (required for Browserbase CDP connections on Vercel).
  serverExternalPackages: ["playwright-core", "@browserbasehq/stagehand"],
};

export default nextConfig;
