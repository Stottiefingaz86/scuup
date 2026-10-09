import { NextResponse, type NextRequest } from "next/server";
import { scrapeTrustpilotFull } from "@/lib/grace/trustpilot";
import { coerceMonth, type GraceWindow } from "@/lib/grace/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Walks up to ~120 Trustpilot pages behind Cloudflare on a US proxy.
export const maxDuration = 300;

/**
 * Standalone Trustpilot pull for /grace. Body: { url, window, searchTerms?,
 * budgetMs? }. Pulls the last 12 months; `window` is the calendar month
 * the report will slice to (YYYY-MM).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = typeof body.url === "string" ? body.url : "";
    const window: GraceWindow = coerceMonth(typeof body.window === "string" ? body.window : null);
    const searchTerms = Array.isArray(body.searchTerms)
      ? body.searchTerms.filter((t: unknown): t is string => typeof t === "string")
      : [];
    const budgetMs =
      typeof body.budgetMs === "number"
        ? Math.min(250_000, Math.max(30_000, body.budgetMs))
        : 250_000;
    if (!url) {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }
    const scrape = await scrapeTrustpilotFull({
      input: url,
      window,
      searchTerms,
      budgetMs,
    });
    return NextResponse.json({ scrape });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Trustpilot scrape failed";
    console.error("[grace/scrape] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
