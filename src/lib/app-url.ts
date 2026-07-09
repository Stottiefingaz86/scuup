import type { NextRequest } from "next/server";

/** Canonical public app URL for auth email links (never localhost in production). */
export function appOriginFromEnv(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return undefined;
}

export function appOriginFromRequest(request: NextRequest | Request): string {
  const env = appOriginFromEnv();
  if (env) return env;
  return new URL(request.url).origin;
}

/** Client components — prefer env so emails match production even behind previews. */
export function appOriginClient(): string {
  const env = appOriginFromEnv();
  if (env) return env;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

export function authCallbackUrl(origin: string, next?: string): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("verified", "1");
  if (next) url.searchParams.set("next", next);
  return url.toString();
}
