"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const AboutUsContext = createContext<{ openAbout: () => void } | null>(null);

export function useAboutUs() {
  const ctx = useContext(AboutUsContext);
  if (!ctx) {
    throw new Error("useAboutUs must be used within AboutUsProvider");
  }
  return ctx;
}

const FOUNDER = {
  name: "Christopher Hunt",
  title: "Founder",
  photo: "/about-me.png",
  portfolioUrl: "https://www.linkedin.com/in/christopher-hunt-a4193646/",
} as const;

function AboutUsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        overlayClassName="bg-black/70 backdrop-blur-sm"
        className="max-h-[min(92vh,900px)] w-[min(96vw,42rem)] gap-0 overflow-y-auto border-border/80 bg-background p-0 sm:max-w-none"
      >
        <div className="landing-hero-glow landing-bg-dots relative overflow-hidden px-6 pb-8 pt-10 sm:px-10 sm:pt-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-16 size-64 rounded-full bg-brand/10 blur-3xl"
          />
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brand">
            About us
          </p>
          <DialogTitle className="mt-3 max-w-xl font-heading text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            Built by operators, for operators
          </DialogTitle>
          <DialogDescription className="mt-3 max-w-xl text-base leading-relaxed">
            Scuup is player CX intelligence for iGaming: benchmark journeys,
            retention, voice of customer, and design against the brands you
            compete with, with evidence behind every score.
          </DialogDescription>
        </div>

        <div className="border-t border-border/80 px-6 py-10 sm:px-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brand">
            Our story
          </p>
          <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              We started Scuup because product and growth teams in iGaming
              were stuck between slow agency audits and tools that don&apos;t
              understand how players actually move through a site: sign-up,
              cashier, loyalty, support.
            </p>
            <p>
              We wanted a repeatable way to see where you stand vs the set,
              with screenshots and scores a sceptical board can trust, delivered
              in hours instead of months.
            </p>
          </div>
        </div>

        <div className="border-t border-border/80 bg-card/30 px-6 py-10 sm:px-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brand">
            Founder
          </p>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Built by an iGaming product designer who has shipped in regulated
            markets and knows what a sceptical board actually wants to see.
          </p>
          <a
            href={FOUNDER.portfolioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-8 flex max-w-md flex-col gap-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local founder photo */}
            <img
              src={FOUNDER.photo}
              alt={FOUNDER.name}
              width={640}
              height={400}
              className="aspect-[16/10] w-full rounded-xl object-cover object-center ring-1 ring-border/60 transition-opacity group-hover:opacity-90"
            />
            <span className="flex flex-col gap-0.5">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground transition-colors group-hover:text-brand">
                {FOUNDER.name}
                <ArrowUpRight className="size-3.5 text-muted-foreground transition-colors group-hover:text-brand" />
              </span>
              <span className="text-sm text-muted-foreground">
                {FOUNDER.title}
              </span>
            </span>
          </a>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-border/80 px-6 py-8 sm:flex-row sm:items-center sm:px-10">
          <p className="max-w-md text-sm text-muted-foreground">
            Compliant market research. Scuup pauses at CAPTCHAs, KYC and payment
            confirmation. No real money moves.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a href="#contact" onClick={() => onOpenChange(false)} />
              }
            >
              Contact us
            </Button>
            <Button
              className="glow-primary"
              nativeButton={false}
              render={<Link href="/projects/new" />}
            >
              Run your free audit
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AboutUsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <AboutUsContext.Provider value={{ openAbout: () => setOpen(true) }}>
      {children}
      <AboutUsDialog open={open} onOpenChange={setOpen} />
    </AboutUsContext.Provider>
  );
}

export function AboutNavButton({ className }: { className?: string }) {
  const { openAbout } = useAboutUs();

  return (
    <button
      type="button"
      onClick={openAbout}
      className={cn("transition-colors hover:text-foreground", className)}
    >
      About
    </button>
  );
}
