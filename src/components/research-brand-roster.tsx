"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  addResearchCompetitor,
  removeResearchCompetitor,
} from "@/lib/research/store";
import type { ResearchBrand, ResearchProject } from "@/lib/research/types";
import { cn } from "@/lib/utils";

export function ResearchBrandRoster({
  project,
  activeBrandId,
  onSelect,
}: {
  project: ResearchProject;
  activeBrandId?: string;
  onSelect?: (brandId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submitAdd() {
    const result = addResearchCompetitor(project, url);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setUrl("");
    setError(null);
    setAdding(false);
    onSelect?.(result.id);
  }

  function removeBrand(brand: ResearchBrand) {
    if (brand.role === "own_brand") return;
    if (
      !confirm(
        `Are you sure you want to remove ${brand.name} from this report? Its runs, emails, and teardown numbers will be deleted.`,
      )
    ) {
      return;
    }
    const wasActive = brand.id === activeBrandId;
    removeResearchCompetitor(project, brand.id);
    if (wasActive) {
      const next = project.brands.find((b) => b.id !== brand.id);
      if (next) onSelect?.(next.id);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {project.brands.map((b) => {
          const active = b.id === activeBrandId;
          return (
            <span
              key={b.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border py-1 pl-2 pr-1 text-sm",
                active
                  ? "border-[var(--rs-accent)] bg-[var(--rs-accent)]/10 text-[var(--rs-fg)]"
                  : "border-[var(--rs-border)] text-[var(--rs-muted)]",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect?.(b.id)}
                className="inline-flex cursor-pointer items-center gap-1.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    b.favicon ||
                    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(b.url)}&sz=64`
                  }
                  alt=""
                  className="size-4 rounded"
                />
                <span className={active ? "text-[var(--rs-fg)]" : ""}>
                  {b.name}
                </span>
                {b.role === "own_brand" ? (
                  <span className="text-[10px] text-[var(--rs-muted)]">
                    you
                  </span>
                ) : null}
              </button>
              {b.role === "competitor" ? (
                <button
                  type="button"
                  aria-label={`Remove ${b.name}`}
                  title={`Remove ${b.name}`}
                  onClick={() => removeBrand(b)}
                  className="cursor-pointer rounded-full p-0.5 text-[var(--rs-muted)] hover:bg-red-500/15 hover:text-red-300"
                >
                  <X className="size-3" strokeWidth={2} />
                </button>
              ) : null}
            </span>
          );
        })}
        {adding ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              submitAdd();
            }}
          >
            <input
              autoFocus
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="stake.com"
              className="h-8 w-44 rounded-full border border-[var(--rs-border)] bg-[var(--rs-bg)] px-3 text-sm text-[var(--rs-fg)] outline-none placeholder:text-[var(--rs-muted)] focus:border-[var(--rs-accent)]"
            />
            <button
              type="submit"
              className="h-8 cursor-pointer rounded-full bg-[var(--rs-accent)] px-3 text-xs font-medium text-[var(--rs-bg)]"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setUrl("");
                setError(null);
              }}
              className="h-8 cursor-pointer rounded-full border border-[var(--rs-border)] px-2.5 text-xs text-[var(--rs-muted)]"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            aria-label="Add competitor"
            title="Add a competitor"
            onClick={() => setAdding(true)}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-dashed border-[var(--rs-border)] text-[var(--rs-muted)] hover:border-[var(--rs-accent)] hover:text-[var(--rs-fg)]"
          >
            <Plus className="size-3.5" strokeWidth={2} />
          </button>
        )}
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
