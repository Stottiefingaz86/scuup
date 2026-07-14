import type { Metadata } from "next";
import {
  CookiePolicyContent,
  LEGAL_UPDATED,
} from "@/components/landing/legal-content";
import { LegalPage } from "@/components/landing/legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy — Scuup",
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" updated={LEGAL_UPDATED}>
      <CookiePolicyContent />
    </LegalPage>
  );
}
