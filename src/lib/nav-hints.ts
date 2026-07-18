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

/** Bare label of a host for brand matching (tombola.co.uk → tombola). */
function hostLabel(host: string): string {
  return host
    .replace(/^www\./, "")
    .split(".")[0]
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "") ?? "";
}

/** Strip common product suffixes so tombolaarcade ≈ tombola. */
function brandStem(label: string): string {
  return label.replace(
    /(bingo|casino|arcade|bet|bets|sports|sport|games|play|slots|vegas)$/i,
    ""
  );
}

/** True when dest is the same site or a plausible sister site of the brand
 * (tombola.co.uk → tombolaarcade.co.uk). Rejects cross-brand pollution
 * (foxybingo.com must NEVER remember tombolaarcade.co.uk). */
export function isRelatedDestination(
  brandUrl: string,
  destinationUrl: string
): boolean {
  try {
    const brandHost = new URL(brandUrl).hostname.replace(/^www\./, "");
    const destHost = new URL(destinationUrl).hostname.replace(/^www\./, "");
    if (brandHost === destHost) return true;
    // Subdomain of the brand (games.foxybingo.com).
    if (destHost.endsWith(`.${brandHost}`)) return true;
    const brand = hostLabel(brandHost);
    const dest = hostLabel(destHost);
    if (!brand || !dest) return false;
    if (dest === brand || dest.startsWith(brand) || brand.startsWith(dest)) {
      return true;
    }
    const stem = brandStem(brand);
    return stem.length >= 4 && dest.includes(stem);
  } catch {
    return false;
  }
}

/** Resolve a stored nav path against the brand URL. Absolute http(s)
 * sister-site paths are used as-is only when they belong to this brand. */
export function resolveNavUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) {
    if (!isRelatedDestination(baseUrl, path)) {
      throw new Error(
        `refusing cross-brand nav path ${path} for ${baseUrl}`
      );
    }
    return path;
  }
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
    const path = (data.path as string) ?? null;
    // Drop polluted absolute hints that point at another brand's site.
    if (path && /^https?:\/\//i.test(path) && !isRelatedDestination(url, path)) {
      await supabase()
        .from("ps_nav_hints")
        .delete()
        .eq("host", host)
        .eq("area", area);
      console.error(
        `[nav-hints] dropped cross-brand hint for ${host}/${area}: ${path}`
      );
      return null;
    }
    return { hint: data.hint as string, path };
  } catch {
    return null;
  }
}

/** Remember a route that navigated AND verified onto a real section.
 * Sister-site destinations keep their full origin only when they share
 * this brand's stem — never copy another operator's lobby URL. */
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
      if (!isRelatedDestination(url, destinationUrl)) {
        console.error(
          `[nav-hints] refused cross-brand save ${host} → ${destHost}`
        );
        return;
      }
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
