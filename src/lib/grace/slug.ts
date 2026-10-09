/** Accepts a brand URL, a bare domain, or a trustpilot.com/review/... link
 * and returns the Trustpilot profile slug (e.g. "betonline.ag"). Client-safe. */
export function trustpilotSlugFromInput(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error("Enter a brand URL or a Trustpilot link.");
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withProto);
  } catch {
    throw new Error(`"${raw}" is not a URL.`);
  }
  const host = url.hostname.toLowerCase();
  if (/(^|\.)trustpilot\.com$/.test(host)) {
    const m = url.pathname.match(/\/review\/([^/?#]+)/i);
    if (!m?.[1]) throw new Error("That Trustpilot link has no /review/<domain> part.");
    return decodeURIComponent(m[1]).toLowerCase();
  }
  return host.replace(/^www\./, "");
}
