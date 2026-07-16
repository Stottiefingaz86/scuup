"use client";

import Link from "next/link";
import { Lock, ShieldCheck } from "lucide-react";
import { useAboutUs } from "@/components/landing/landing-about";
import { LegalNavButton } from "@/components/landing/landing-legal-dialog";
import type { LegalDocument } from "@/components/landing/legal-content";
import {
  openIntercomHelpCentre,
  openIntercomLiveChat,
} from "@/lib/intercom";
import { cn } from "@/lib/utils";

const RESOURCE_LINKS = [
  { label: "What we score", href: "#pillars" },
  { label: "How it works", href: "#how" },
  { label: "Pricing", href: "#pricing" },
];

const SUPPORT_LINKS = [
  { label: "Contact", href: "#contact" },
  { label: "FAQ", href: "#faq" },
];

const SUPPORT_INTERCOM = [
  { label: "Help Centre", action: openIntercomHelpCentre },
  { label: "Live chat", action: openIntercomLiveChat },
] as const;

const LEGAL_LINKS: { label: string; doc: LegalDocument }[] = [
  { label: "Privacy Policy", doc: "privacy" },
  { label: "Terms of Service", doc: "terms" },
  { label: "Cookie Policy", doc: "cookies" },
];

export function LandingFooter() {
  const { openAbout } = useAboutUs();
  const year = new Date().getFullYear();

  return (
    <footer className="px-4 pb-6 pt-4 sm:px-6">
      <div className="landing-footer-panel landing-bg-grain relative isolate mx-auto w-full max-w-7xl overflow-hidden rounded-3xl border border-border/80">
        <div aria-hidden className="landing-grain-texture absolute z-[1] opacity-[0.05]" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_0%_100%,oklch(0.77_0.15_163/0.12),transparent_60%)]"
        />
        <div
          aria-hidden
          className="landing-bg-dots absolute inset-0 opacity-30"
        />

        <div className="relative z-[2] px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
            <div className="max-w-md shrink-0">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Player CX intelligence for iGaming operators. Benchmark journeys,
                retention, voice of customer, and design in one score.
              </p>
              <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
                Compliant market research. No real money moves.
              </p>
            </div>

            <div className="flex flex-wrap gap-x-12 gap-y-8 sm:gap-x-16">
              <div className="min-w-[8.5rem]">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Product
                </p>
                <nav className="mt-3 flex flex-col items-start gap-2 text-sm">
                  {RESOURCE_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  ))}
                  <button
                    type="button"
                    onClick={openAbout}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    About
                  </button>
                </nav>
              </div>
              <div className="min-w-[8.5rem]">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Support
                </p>
                <nav className="mt-3 flex flex-col items-start gap-2 text-sm">
                  {SUPPORT_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  ))}
                  {SUPPORT_INTERCOM.map(({ label, action }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={action}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              </div>
              <div className="min-w-[8.5rem]">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Legal
                </p>
                <nav className="mt-3 flex flex-col items-start gap-2 text-sm">
                  {LEGAL_LINKS.map((link) => (
                    <LegalNavButton
                      key={link.doc}
                      doc={link.doc}
                      className="text-muted-foreground"
                    >
                      {link.label}
                    </LegalNavButton>
                  ))}
                </nav>
              </div>
            </div>
          </div>

          <p className="mt-10 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground/70">
            <span>© {year} Scuup. All rights reserved.</span>
            <Link
              href="/admin"
              className="flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Lock className="size-3" />
              Admin
            </Link>
          </p>
        </div>

        <button
          type="button"
          onClick={openAbout}
          aria-label="About Scuup"
          className={cn(
            "group relative z-[2] block w-full min-w-0 border-t border-border/50 text-left",
            "px-6 pb-6 pt-5 transition-colors hover:bg-brand/[0.03] sm:px-10 sm:pb-8 sm:pt-6",
          )}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-brand/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- brand SVG wordmark */}
          <img
            src="/logo.svg"
            alt=""
            width={121}
            height={41}
            className="relative h-[clamp(2.75rem,12vw,6.5rem)] w-auto max-w-full opacity-90 transition-opacity group-hover:opacity-100"
          />
        </button>
      </div>
    </footer>
  );
}
