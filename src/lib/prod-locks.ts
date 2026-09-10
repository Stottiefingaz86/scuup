import { NextResponse } from "next/server";

/** True only on the production Vercel deploy — not preview, not local. */
export function isProductionDeploy(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/** Client-safe twin. Vercel inlines NEXT_PUBLIC_VERCEL_ENV at build time. */
export function isProductionDeployPublic(): boolean {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
}

export const NEW_REPORTS_LOCKED_MESSAGE =
  "New reports are paused. Existing reports stay readable.";

export function rejectIfNewReportsLocked(): NextResponse | null {
  if (!isProductionDeploy()) return null;
  return NextResponse.json(
    { error: NEW_REPORTS_LOCKED_MESSAGE, code: "reports_locked" },
    { status: 403 },
  );
}
