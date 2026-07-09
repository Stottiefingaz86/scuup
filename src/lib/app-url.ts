import type { NextRequest } from "next/server";

/** Production deployment — auth emails must never use localhost. */
export const PRODUCTION_APP_ORIGIN = "https://scuup.vercel.app";

function normalizeOrigin(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/\/$/, "");
  return trimmed || undefined;
}

function isLocalhost(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Canonical public app URL for auth email links (never localhost in production).
 * Uses the production alias, never per-deployment VERCEL_URL hosts, which sit
 * behind Vercel deployment protection and break redirects. */
export function appOriginFromEnv(): string | undefined {
  const explicit = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (explicit) return explicit;

  const productionAlias = normalizeOrigin(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined
  );
  if (productionAlias) return productionAlias;

  if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") {
    return PRODUCTION_APP_ORIGIN;
  }

  return undefined;
}

/** Origin used in auth redirect links — production never falls back to localhost. */
export function authEmailOrigin(): string {
  const env = appOriginFromEnv();
  if (env && !isLocalhost(env)) return env;
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    return PRODUCTION_APP_ORIGIN;
  }
  return env ?? "http://localhost:3000";
}

export function appOriginFromRequest(request: NextRequest | Request): string {
  return authEmailOrigin();
}

/** Client components — prefer env so emails match production even behind previews. */
export function appOriginClient(): string {
  return authEmailOrigin();
}

export function authCallbackUrl(origin: string, next?: string): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("verified", "1");
  if (next) url.searchParams.set("next", next);
  return url.toString();
}
