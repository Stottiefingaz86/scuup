import type { Metadata } from "next";
import {
  LEGAL_UPDATED,
  PrivacyPolicyContent,
} from "@/components/landing/legal-content";
import { LegalPage } from "@/components/landing/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Scuup",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={LEGAL_UPDATED}>
      <PrivacyPolicyContent />
    </LegalPage>
  );
}
