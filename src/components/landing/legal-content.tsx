import type { ComponentType } from "react";

export const LEGAL_UPDATED = "14 July 2026";

type LegalContentProps = {
  /** Close any overlay before navigating to the contact section. */
  onContactClick?: () => void;
};

function ContactLink({ onContactClick }: { onContactClick?: () => void }) {
  if (onContactClick) {
    return (
      <button
        type="button"
        onClick={onContactClick}
        className="text-foreground underline-offset-4 hover:underline"
      >
        scuup.app
      </button>
    );
  }
  return (
    <a
      href="/#contact"
      className="text-foreground underline-offset-4 hover:underline"
    >
      scuup.app
    </a>
  );
}

export function PrivacyPolicyContent({ onContactClick }: LegalContentProps) {
  return (
    <>
      <p>
        Scuup (&quot;we&quot;, &quot;us&quot;) provides competitor customer
        experience intelligence for iGaming operators. This policy explains how
        we handle personal data when you use scuup.app and related services.
      </p>

      <h2>Data we collect</h2>
      <ul>
        <li>
          Account details you provide: name, email, company, and authentication
          credentials managed by our auth provider.
        </li>
        <li>
          Usage data: pages visited, features used, audit configurations, and
          technical logs needed to operate and secure the service.
        </li>
        <li>
          Contact form submissions: name, email, company, and message content.
        </li>
        <li>
          Payment and billing data when you subscribe, processed by our payment
          provider (we do not store full card numbers).
        </li>
      </ul>

      <h2>How we use data</h2>
      <ul>
        <li>Provide, maintain, and improve the Scuup platform.</li>
        <li>Run audits you request and deliver reports to your team.</li>
        <li>Respond to support and sales enquiries.</li>
        <li>Send service emails such as verification, invites, and security notices.</li>
        <li>Meet legal obligations and prevent abuse or fraud.</li>
      </ul>

      <h2>Legal bases (EEA/UK)</h2>
      <p>
        Where applicable, we rely on contract performance, legitimate interests
        (operating and improving the service), consent (marketing where required),
        and legal obligation.
      </p>

      <h2>Sharing</h2>
      <p>
        We use subprocessors for hosting, authentication, email delivery, analytics,
        and automation. We do not sell personal data. We may disclose data if required
        by law or to protect rights, safety, and security.
      </p>

      <h2>Retention</h2>
      <p>
        We keep account and audit data while your account is active and for a
        reasonable period afterward for backups, disputes, and legal compliance.
        Contact enquiries are retained as long as needed to respond and follow up.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on your location, you may have rights to access, correct, delete,
        restrict, or export your data, and to object to certain processing. Contact
        us through the form on our website to exercise these rights.
      </p>

      <h2>International transfers</h2>
      <p>
        Data may be processed in countries outside your own. Where required, we use
        appropriate safeguards such as standard contractual clauses.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy questions, use the contact form at{" "}
        <ContactLink onContactClick={onContactClick} />.
      </p>
    </>
  );
}

export function TermsOfServiceContent({ onContactClick }: LegalContentProps) {
  return (
    <>
      <p>
        These terms govern access to Scuup. By creating an account or using the
        service, you agree to them. If you use Scuup on behalf of a company, you
        confirm you have authority to bind that company.
      </p>

      <h2>The service</h2>
      <p>
        Scuup provides automated and assisted competitive research on public and
        authenticated player journeys. Scores and reports are directional
        intelligence based on evidence captured at a point in time. They are not
        guarantees of future performance or legal compliance of any operator site.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Provide accurate account information and keep credentials secure.</li>
        <li>
          Only submit URLs and credentials you are authorised to test, and comply
          with applicable laws in your market.
        </li>
        <li>
          Do not misuse the platform: no scraping beyond permitted use, no attempts
          to bypass security, and no reselling of raw outputs without permission.
        </li>
        <li>
          Ensure invitees you add to reports are allowed to receive shared data.
        </li>
      </ul>

      <h2>Plans and payment</h2>
      <p>
        Paid plans, limits, and pricing are shown at checkout or on the pricing
        page. Subscriptions renew according to the billing cycle you select until
        cancelled. Refunds are handled as stated at purchase or required by law.
      </p>

      <h2>Intellectual property</h2>
      <p>
        We own the Scuup platform, methodology, and branding. You own your account
        data and receive a licence to use reports generated for your audits. Public
        showcase data may be derived from anonymised or aggregated benchmarks we
        publish.
      </p>

      <h2>Disclaimer</h2>
      <p>
        The service is provided &quot;as is&quot; to the fullest extent permitted by
        law. We disclaim warranties of merchantability, fitness for a particular
        purpose, and non-infringement. Our liability is limited to the fees you paid
        in the twelve months before the claim, except where law prohibits such
        limits.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using Scuup at any time. We may suspend or terminate access for
        breach, risk, or non-payment. On termination, your right to use the service
        ends; export provisions in your plan apply where available.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. Material changes will be notified via the product
        or email. Continued use after the effective date constitutes acceptance.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: use the contact form at{" "}
        <ContactLink onContactClick={onContactClick} />.
      </p>
    </>
  );
}

export function CookiePolicyContent({ onContactClick }: LegalContentProps) {
  return (
    <>
      <p>
        This policy explains how Scuup uses cookies and similar technologies on
        scuup.app.
      </p>

      <h2>What are cookies?</h2>
      <p>
        Cookies are small text files stored on your device. They help websites
        remember preferences, keep you signed in, and understand how the service is
        used.
      </p>

      <h2>Cookies we use</h2>
      <ul>
        <li>
          <strong className="text-foreground">Essential</strong>, authentication
          session cookies so you can log in securely and stay signed in.
        </li>
        <li>
          <strong className="text-foreground">Preference</strong>, storing choices
          such as cookie consent and UI settings.
        </li>
        <li>
          <strong className="text-foreground">Analytics (if enabled)</strong>,
          aggregated usage to improve performance and features. We do not use
          cookies for third-party advertising.
        </li>
      </ul>

      <h2>Local storage</h2>
      <p>
        We may use browser local storage for the same purposes as essential and
        preference cookies, including remembering that you accepted this notice.
      </p>

      <h2>Managing cookies</h2>
      <p>
        You can block or delete cookies in your browser settings. Blocking essential
        cookies may prevent you from signing in or using core features.
      </p>

      <h2>Updates</h2>
      <p>
        We may update this policy when our use of cookies changes. The date at the
        top shows when it was last revised.
      </p>

      <h2>Contact</h2>
      <p>
        Cookie questions: use the contact form at{" "}
        <ContactLink onContactClick={onContactClick} />.
      </p>
    </>
  );
}

export type LegalDocument = "privacy" | "terms" | "cookies";

export const LEGAL_DOCUMENTS: Record<
  LegalDocument,
  { title: string; Content: ComponentType<LegalContentProps> }
> = {
  privacy: { title: "Privacy Policy", Content: PrivacyPolicyContent },
  terms: { title: "Terms of Service", Content: TermsOfServiceContent },
  cookies: { title: "Cookie Policy", Content: CookiePolicyContent },
};
