"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import {
  deleteResearchProject,
  useResearchProjects,
} from "@/lib/research/store";

export default function ResearchProjectsPage() {
  const projects = useResearchProjects();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Projects</h1>
          <p className="mt-1 text-sm text-[var(--rs-muted)]">
            Timed journey teardowns and competitor benchmarks.
          </p>
        </div>
        <Link
          href="/research/projects/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--rs-accent)] px-3 py-2 text-sm font-medium text-[var(--rs-bg)]"
        >
          <Plus className="size-4" />
          New project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--rs-border)] p-8 text-center text-sm text-[var(--rs-muted)]">
          No research projects yet. Create one with your brand and competitors.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((p) => (
            <li
              key={p.id}
              className="flex items-stretch gap-2 rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)]"
            >
              <Link
                href={`/research/projects/${p.id}`}
                className="flex min-w-0 flex-1 items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.02]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-[var(--rs-muted)]">
                    {p.brands.length} brand{p.brands.length === 1 ? "" : "s"} ·{" "}
                    {p.runs.length} run
                    {p.runs.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="ml-3 shrink-0 text-xs text-[var(--rs-muted)]">
                  {new Date(p.createdAt).toLocaleDateString()}
                </span>
              </Link>
              <button
                type="button"
                aria-label={`Delete ${p.name}`}
                onClick={() => {
                  if (
                    !confirm(
                      `Delete “${p.name}”? This removes all runs and emails for this project.`
                    )
                  ) {
                    return;
                  }
                  deleteResearchProject(p.id);
                }}
                className="cursor-pointer shrink-0 px-4 text-xs text-[var(--rs-muted)] hover:text-red-300"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
