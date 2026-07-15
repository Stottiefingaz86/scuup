import type { Metadata } from "next";
import {
  LEGAL_UPDATED,
  TermsOfServiceContent,
} from "@/components/landing/legal-content";
import { LegalPage } from "@/components/landing/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service | Scuup",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated={LEGAL_UPDATED}>
      <TermsOfServiceContent />
    </LegalPage>
  );
}
