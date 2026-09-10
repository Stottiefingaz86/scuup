/** Host helpers for the Research product (research.scuup.io). */

export function isResearchHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.toLowerCase().split(":")[0] ?? "";
  return (
    h === "research.scuup.io" ||
    h === "research.localhost" ||
    h.startsWith("research.")
  );
}

/** Path prefix used inside this Next app for Research routes. */
export const RESEARCH_BASE = "/research";
