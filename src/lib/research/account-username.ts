/** Brand-issued login id from welcome / deposit mail. */
export function extractUsernameFromText(text: string): string | null {
  const m =
    /(?:your\s+)?(?:user(?:\s*name)?|login(?:\s*id)?|account(?:\s*(?:id|number|#))?)\s*(?:is\s*)?[:#]\s*([A-Za-z0-9._-]{3,24})/i.exec(
      text,
    );
  if (!m?.[1] || /device|account|user|number|login/i.test(m[1])) return null;
  return m[1];
}

export function extractUsernameFromEmails(
  emails: { subject?: string; body?: string; summary?: string }[],
): string | null {
  for (const e of emails) {
    const hit = extractUsernameFromText(
      `${e.subject ?? ""}\n${e.body ?? ""}\n${e.summary ?? ""}`,
    );
    if (hit) return hit;
  }
  return null;
}
