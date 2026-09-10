import { DEFAULT_TEST_EMAIL } from "@/lib/constants";

/** True when the address is our shared IMAP inbox or a plus-alias of it. */
export function isResearchInboxAddress(email: string): boolean {
  const e = email.trim().toLowerCase();
  const base = DEFAULT_TEST_EMAIL.toLowerCase();
  if (e === base) return true;
  const [local, domain] = base.split("@");
  if (!local || !domain) return false;
  const m = e.match(/^([^+@]+)(?:\+[^@]*)?@(.+)$/);
  return Boolean(m && m[1] === local && m[2] === domain);
}

/**
 * Fresh signup address per brand that still lands in the same Gmail IMAP box.
 * Sites see a unique address; we keep reading OTP from scuup678@.
 */
export function researchSignupEmail(brandName: string): string {
  const [local, domain] = DEFAULT_TEST_EMAIL.split("@");
  if (!local || !domain) return DEFAULT_TEST_EMAIL;
  const slug =
    brandName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 10) || "brand";
  const tag = `${slug}${Date.now().toString(36).slice(-5)}${Math.random()
    .toString(36)
    .slice(2, 4)}`;
  return `${local}+rs${tag}@${domain}`.toLowerCase();
}

/**
 * Prefer a brand's saved account email (login after signup). Otherwise mint a
 * unique alias when the persona is our shared inbox. Custom non-inbox emails
 * are used as-is for one-off manual personas.
 */
export function resolveResearchSignupEmail(opts: {
  brandName: string;
  brandAccountEmail?: string | null;
  personaEmail?: string | null;
}): string {
  const saved = opts.brandAccountEmail?.trim().toLowerCase();
  if (saved) return saved;

  const persona = opts.personaEmail?.trim().toLowerCase();
  if (persona && !isResearchInboxAddress(persona)) return persona;

  return researchSignupEmail(opts.brandName);
}
