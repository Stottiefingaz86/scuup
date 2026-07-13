import { NextResponse, type NextRequest } from "next/server";
import { buildShowcaseEntries } from "@/lib/showcase-db";
import { matchesSort, type ShowcaseSort } from "@/lib/showcase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SORTS: ShowcaseSort[] = [
  "score",
  "trending_up",
  "trending_down",
  "big_movers",
];

/** Public brand showcase for the landing page carousel. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const market = searchParams.get("market") ?? undefined;
    const month = searchParams.get("month") ?? undefined;
    const sortParam = searchParams.get("sort") ?? "score";
    const sort: ShowcaseSort = SORTS.includes(sortParam as ShowcaseSort)
      ? (sortParam as ShowcaseSort)
      : "score";

    const { entries, markets, months } = await buildShowcaseEntries({
      market: market || undefined,
      month: month || undefined,
    });

    const filtered =
      sort === "score"
        ? entries
        : entries.filter((e) => matchesSort(e, sort));

    if (sort === "big_movers" || sort === "trending_up" || sort === "trending_down") {
      filtered.sort(
        (a, b) => Math.abs(b.scoreDelta ?? 0) - Math.abs(a.scoreDelta ?? 0)
      );
    }

    return NextResponse.json({ entries: filtered, markets, months, sort });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to load showcase";
    console.error("[showcase]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
