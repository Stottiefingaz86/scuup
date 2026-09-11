"use client";

import { walkInsightsForBrand, type WalkInsight } from "@/lib/research/walk-insights";
import type { ResearchProject } from "@/lib/research/types";
import { cn } from "@/lib/utils";

function toneClass(tone: WalkInsight["tone"]) {
  if (tone === "pain") return "border-amber-500/35 bg-amber-500/5";
  if (tone === "compare") return "border-[var(--rs-border)] bg-[var(--rs-card)]";
  return "border-[var(--rs-border)] bg-[var(--rs-card)]";
}

function toneLabel(tone: WalkInsight["tone"]) {
  if (tone === "pain") return "Pain";
  if (tone === "compare") return "Compare";
  return "Note";
}

/** Compact walk-grounded comparisons under After signup / After deposit. */
export function WalkInsightsCard({
  project,
  brandId,
}: {
  project: ResearchProject;
  brandId: string;
}) {
  const items = walkInsightsForBrand(project, brandId);
  if (items.length === 0) return null;
  const brand = project.brands.find((b) => b.id === brandId);
  return (
    <section className="rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] p-4">
      <div>
        <h3 className="text-sm font-medium">Walk insights</h3>
        <p className="mt-0.5 text-[11px] text-[var(--rs-muted)]">
          What this walk shows next to the other brands on the roster
          {brand ? ` · ${brand.name}` : ""}.
        </p>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.title}
            className={cn(
              "rounded-lg border px-3 py-2.5",
              toneClass(item.tone),
            )}
          >
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs font-medium text-[var(--rs-fg)]">
              <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--rs-muted)]">
                {toneLabel(item.tone)}
              </span>
              {item.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--rs-muted)]">
              {item.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
