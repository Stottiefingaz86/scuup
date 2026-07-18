import { supabase } from "./supabase-server";

/** Per-site navigation memory. Every successful walk teaches the agent
 * where a brand hides each area (Tombola's casino lives under "Arcade" in
 * the left menu, for example) — the next run on that host tries the
 * remembered route first instead of rediscovering it. This is how past
 * reports make the agents smarter. */

export interface NavHint {
  /** Human-readable description of the route that worked last time. */
  hint: string;
  /** Destination that verified — a same-site path ("/arcade") or an
   * absolute sister-site URL ("https://www.tombolaarcade.co.uk/arcade-games"). */
  path: string | null;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Resolve a stored nav path against the brand URL. Absolute http(s)
 * paths (sister sites) are used as-is. */
export function resolveNavUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, baseUrl).toString();
}

/** The route that worked on the last successful visit, if any. */
export async function getNavHint(
  url: string,
  area: string
): Promise<NavHint | null> {
  const host = hostOf(url);
  if (!host) return null;
  try {
    const { data } = await supabase()
      .from("ps_nav_hints")
      .select("hint, path")
      .eq("host", host)
      .eq("area", area)
      .maybeSingle();
    if (!data) return null;
    return { hint: data.hint as string, path: (data.path as string) ?? null };
  } catch {
    return null;
  }
}

/** Remember a route that navigated AND verified onto a real section.
 * Sister-site destinations keep their full origin (Tombola bingo →
 * tombolaarcade.co.uk). Text-only hints with no path are discarded. */
export async function saveNavHint(
  url: string,
  area: string,
  hint: string,
  destinationUrl: string
): Promise<void> {
  const host = hostOf(url);
  if (!host || !hint) return;
  let path: string | null = null;
  try {
    const start = new URL(url);
    const dest = new URL(destinationUrl);
    const startHost = start.hostname.replace(/^www\./, "");
    const destHost = dest.hostname.replace(/^www\./, "");
    if (destHost !== startHost) {
      // Sister / satellite product site — remember the full URL.
      path = `${dest.origin}${dest.pathname === "/" ? "/" : dest.pathname}`;
    } else if (dest.pathname && dest.pathname !== "/") {
      path = dest.pathname;
    }
  } catch {
    return;
  }
  if (!path) return;
  try {
    await supabase()
      .from("ps_nav_hints")
      .upsert(
        {
          host,
          area,
          hint: hint.slice(0, 500),
          path,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "host,area" }
      );
  } catch (e) {
    console.error(
      "[nav-hints] save failed:",
      e instanceof Error ? e.message : e
    );
  }
}
