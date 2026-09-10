"use client";

import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Mail,
  Plus,
  Route,
  Timer,
} from "lucide-react";
import {
  brandHasCompletedSignup,
  useResearchProjects,
} from "@/lib/research/store";

const WHAT_WE_DO = [
  {
    icon: Timer,
    title: "Timed onboarding",
    body: "Stopwatch landing through signup, deposit, and first casino bet. Fields, clicks, waits, and friction.",
  },
  {
    icon: Route,
    title: "Competitor side-by-side",
    body: "Same journey on your brand and rivals, so gaps are measured.",
  },
  {
    icon: Mail,
    title: "Inbox evidence",
    body: "Verify, welcome, and deposit emails as the player sees them.",
  },
  {
    icon: Clock,
    title: "Return paths",
    body: "Login and resume-play maps for reactivation friction.",
  },
];

function latestRunStatus(
  project: ReturnType<typeof useResearchProjects>[number]
): string {
  const signed = project.brands.filter((b) =>
    brandHasCompletedSignup(project, b.id)
  ).length;
  const running = project.runs.some((r) => r.status === "running");
  if (running) return "Agent running";
  if (signed === 0) return "Not started";
  if (signed < project.brands.length)
    return `${signed}/${project.brands.length} signed up`;
  const complete = project.runs.filter((r) => r.status === "complete").length;
  if (complete > 0) return `${complete} journey${complete === 1 ? "" : "s"} done`;
  return `${signed} accounts ready`;
}

export default function ResearchLandingPage() {
  const projects = useResearchProjects();
  const sorted = [...projects].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10 lg:py-12">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--rs-accent)]">
            Internal · Product team
          </p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Research
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[var(--rs-muted)] sm:text-[13px]">
            Timed player journeys for activation work. See where signup and
            deposit stall on us and on competitors, plus what lands in the inbox
            in the first two weeks.
          </p>
        </div>
        <Link
          href="/research/projects/new"
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg bg-[var(--rs-accent)] px-4 py-2.5 text-sm font-medium text-[var(--rs-bg)] lg:self-auto"
        >
          <Plus className="size-4" />
          Start new research
        </Link>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-heading text-base font-medium tracking-tight">
            Projects
          </h2>
          {sorted.length > 0 ? (
            <Link
              href="/research/projects"
              className="text-[11px] text-[var(--rs-muted)] hover:text-[var(--rs-fg)]"
            >
              View all
            </Link>
          ) : null}
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--rs-border)] bg-[var(--rs-card)]/40 px-6 py-9 text-center">
            <p className="text-sm text-[var(--rs-fg)]">No projects yet</p>
            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-[var(--rs-muted)]">
              Add your brand and competitors, then run a capture. Signup
              screenshots, deposit pauses, and inbox evidence show up in one
              place.
            </p>
            <Link
              href="/research/projects/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--rs-accent)] px-4 py-2.5 text-sm font-medium text-[var(--rs-bg)]"
            >
              Start new research
              <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {sorted.slice(0, 6).map((p) => {
              const status = latestRunStatus(p);
              const own = p.brands.find((b) => b.role === "own_brand");
              return (
                <li key={p.id}>
                  <Link
                    href={`/research/projects/${p.id}`}
                    className="flex h-full flex-col gap-3 rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] p-4 transition-colors hover:border-[var(--rs-accent)]/45"
                  >
                    <div className="flex items-start gap-3">
                      {own?.favicon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={own.favicon}
                          alt=""
                          className="size-9 shrink-0 rounded-lg border border-[var(--rs-border)] bg-[var(--rs-bg)] object-contain p-1"
                        />
                      ) : (
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--rs-border)] bg-[var(--rs-bg)] text-xs font-medium text-[var(--rs-muted)]">
                          {p.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--rs-fg)]">
                          {p.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--rs-muted)]">
                          {p.brands.length} brand
                          {p.brands.length === 1 ? "" : "s"}
                          {p.device ? ` · ${p.device}` : ""}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 size-4 shrink-0 text-[var(--rs-muted)]" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--rs-muted)]">
                      <span className="rounded-full border border-[var(--rs-border)] px-2 py-0.5">
                        {status}
                      </span>
                      <span>
                        {p.emails.length} email
                        {p.emails.length === 1 ? "" : "s"}
                      </span>
                      <span className="ms-auto">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading text-base font-medium tracking-tight">
            What we capture
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--rs-muted)]">
            Activation and retention calls need evidence from the live path:
            time, clicks, and messages.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {WHAT_WE_DO.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex flex-col gap-1.5 rounded-xl border border-[var(--rs-border)] bg-[var(--rs-card)] p-4"
            >
              <Icon
                className="size-3.5 text-[var(--rs-accent)]"
                strokeWidth={1.75}
              />
              <h3 className="text-sm font-medium text-[var(--rs-fg)]">
                {title}
              </h3>
              <p className="text-xs leading-relaxed text-[var(--rs-muted)]">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
