"use client";

import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { cn } from "@/lib/utils";

const FAQ_ITEMS = [
  {
    id: "unscored",
    question: "What if you can't score a section?",
    answer:
      "We show it as N/A, never guessed. A journey might be geo-blocked, stuck behind CAPTCHA or KYC, or simply not run yet. Your Player CX Score is the average of the pillars we did capture (journeys, retention, voice of customer, design), so missing data doesn't drag the number down with a fake zero. Every gap is listed in your coverage report with a clear reason and what to do next, run the agent again, take over manually, or record a live session.",
  },
  {
    id: "trending",
    question: "Do you show trending?",
    answer:
      "Yes. When a brand has been audited in the same market for two consecutive months, we show the month-over-month change on its Player CX Score, trending up, down, or flat. Filter the public showcase by biggest movers or direction. Brands audited for the first time show as \"New this month\" until there's a prior snapshot to compare against. Trending reflects real re-audits, not estimates.",
  },
  {
    id: "trust",
    question: "How can I trust the score?",
    answer:
      "Every point ties back to evidence, screenshots from real browser sessions, the same named heuristics on every site, and pillar breakdowns you can drill into. We score on iGaming-specific patterns (offer clarity, cashier trust, reward cadence), not generic UX theatre. You can open any heuristic and see exactly which UI earned it. The methodology is consistent; the read is yours to challenge with the proof in front of you.",
  },
  {
    id: "perfect",
    question: "Are you always right?",
    answer:
      "No, and we won't pretend otherwise. Scuup is high-level competitive intelligence: where you likely win or lose vs the set, and which fixes matter most. A promo layout might score differently depending on timing, and automated sessions can't replicate every logged-in edge case. Treat scores as a structured starting point for product decisions, not a court verdict. When we're uncertain, we say so in the analyst notes rather than inventing precision.",
  },
  {
    id: "overall",
    question: "How is the overall Player CX Score calculated?",
    answer:
      "Four pillars, journey average, retention (loyalty & rewards), voice of customer (Trustpilot rescaled to 100), and design review, are averaged together. Only pillars with actual evidence count; nothing is back-filled. If only journeys and design ran, the overall is the mean of those two. Each pillar shows its source (e.g. \"avg of 4 scored journeys\") so the rollup is never a black box.",
  },
  {
    id: "vs-agency",
    question: "How is this different from an agency audit?",
    answer:
      "Same intent, understand where you stand, but Scuup runs the same heuristics across your whole competitive set in hours, not weeks. Agency reports are deep but slow, expensive, and shaped by whoever wrote them. We trade some nuance for speed, comparability, and repeatability. Many teams use Scuup to benchmark monthly and commission human research only where the gaps are highest-stakes.",
  },
] as const;

function FaqItem({
  item,
  open,
  onToggle,
}: {
  item: (typeof FAQ_ITEMS)[number];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        id={`faq-${item.id}-trigger`}
        aria-expanded={open}
        aria-controls={`faq-${item.id}-panel`}
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 py-5 text-left transition-colors hover:text-foreground"
      >
        <span className="font-medium leading-snug">{item.question}</span>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      <div
        id={`faq-${item.id}-panel`}
        role="region"
        aria-labelledby={`faq-${item.id}-trigger`}
        hidden={!open}
        className={cn(
          "overflow-hidden pb-5 text-sm leading-relaxed text-muted-foreground",
          !open && "hidden"
        )}
      >
        {item.answer}
      </div>
    </div>
  );
}

export function LandingFaq() {
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0].id);

  return (
    <section id="faq" className="border-t border-border bg-card/40 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-16">
          <LandingReveal className="max-w-md">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brand">
              FAQ
            </p>
            <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Straight answers on scores & trust
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Benchmarking only works if you know what the numbers mean, and
              where they stop. We&apos;d rather be clear than overconfident.
            </p>
            <div className="mt-8 flex items-start gap-3 rounded-lg border border-border bg-background/60 p-4">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                Scuup is directional intelligence backed by evidence, useful
                for prioritising product work, not replacing your judgment.
              </p>
            </div>
          </LandingReveal>

          <LandingReveal delay={120}>
            <div className="rounded-xl border border-border bg-background px-5 sm:px-6">
              {FAQ_ITEMS.map((item) => (
                <FaqItem
                  key={item.id}
                  item={item}
                  open={openId === item.id}
                  onToggle={() =>
                    setOpenId((prev) => (prev === item.id ? null : item.id))
                  }
                />
              ))}
            </div>
          </LandingReveal>
        </div>
      </div>
    </section>
  );
}
