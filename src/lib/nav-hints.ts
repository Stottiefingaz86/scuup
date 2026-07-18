import { supabase } from "./supabase-server";

/** Per-site navigation memory. Every successful walk teaches the agent
 * where a brand hides each area (Tombola's casino lives under "Arcade" in
 * the left menu, for example) — the next run on that host tries the
 * remembered route first instead of rediscovering it. This is how past
 * reports make the agents smarter. */

export interface NavHint {
  /** Human-readable description of the route that worked last time. */
  hint: string;
  /** URL path of the destination that verified ("/arcade"). */
  path: string | null;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
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

/** Remember a route that navigated AND verified. Best-effort — memory
 * must never sink a run. */
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
    const dest = new URL(destinationUrl);
    // Only a real section path is worth remembering.
    if (dest.pathname && dest.pathname !== "/") path = dest.pathname;
  } catch {
    // Keep the textual hint without a path.
  }
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
