"use client";

import { Heart, Printer, TriangleAlert, X } from "lucide-react";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import {
  buildResearchReportBrief,
  projectForReport,
} from "@/lib/research/report-brief";
import type { ResearchProject } from "@/lib/research/types";
import { cn } from "@/lib/utils";

function SectionKicker({ n, label }: { n: string; label: string }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--rs-accent)]">
      {n} · {label}
    </p>
  );
}

function MiniShot({
  src,
  label,
}: {
  src: string;
  label: string;
}) {
  return (
    <ScreenshotLightbox
      src={src}
      alt={label}
      caption={label}
      frame="phone"
      className="h-16 w-12 shrink-0 rounded-lg border border-[var(--rs-border)]"
    />
  );
}

function BiteCard({
  polarity,
  brandName,
  own,
  title,
  body,
  stage,
  shot,
}: {
  polarity: "love" | "hate";
  brandName: string;
  own: boolean;
  title: string;
  body: string;
  stage: string;
  shot: { src: string; label: string } | null;
}) {
  const love = polarity === "love";
  return (
    <article
      className={cn(
        "flex gap-3 rounded-2xl border p-3.5",
        love
          ? "border-emerald-500/20 bg-emerald-500/[0.05]"
          : "border-red-500/20 bg-red-500/[0.04]",
      )}
    >
      {shot ? <MiniShot src={shot.src} label={shot.label} /> : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
          {love ? (
            <Heart className="size-3 fill-emerald-400 text-emerald-400" />
          ) : (
            <X className="size-3 text-red-300" />
          )}
          <span className={love ? "text-emerald-300" : "text-red-300"}>
            {own ? `${brandName} (you)` : brandName}
          </span>
          <span className="text-[var(--rs-muted)]">· {stage}</span>
        </div>
        <h4 className="mt-1 font-heading text-[15px] font-medium leading-snug">
          {title}
        </h4>
        <p className="mt-1 text-sm leading-relaxed text-[var(--rs-muted)]">
          {body}
        </p>
      </div>
    </article>
  );
}

export function ResearchReportView({ project: raw }: { project: ResearchProject }) {
  const project = projectForReport(raw);
  const brief = buildResearchReportBrief(project);
  const own = project.brands.find((b) => b.role === "own_brand");

  return (
    <article className="rs-report mx-auto flex w-full max-w-3xl flex-col gap-12 pb-16 print:max-w-none">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <p className="text-xs text-[var(--rs-muted)]">
          From the walks and inbox — not workshop examples.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--rs-border)] px-3 py-1.5 text-xs text-[var(--rs-fg)] hover:bg-[var(--rs-card)]"
        >
          <Printer className="size-3.5 opacity-70" />
          Print / PDF
        </button>
      </div>

      <header className="flex flex-col gap-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--rs-muted)]">
          Scuup Research · {project.device} · {project.market}
        </p>
        <h2 className="font-heading text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          {brief.headline}
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--rs-muted)]">
          {brief.lede}
        </p>
        <p className="text-xs text-[var(--rs-muted)]">
          {own ? `${brief.coverage.find((c) => c.own)?.brandName ?? own.name} vs ` : ""}
          {project.brands.filter((b) => b.role === "competitor").length}{" "}
          competitor
          {project.brands.filter((b) => b.role === "competitor").length === 1
            ? ""
            : "s"}
          {" · "}
          {project.name}
        </p>
      </header>

      {brief.coverage.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {brief.coverage.map((c) => (
            <li
              key={c.brandName}
              className="rounded-xl border border-[var(--rs-border)] px-3 py-2.5"
            >
              <p className="text-[11px] uppercase tracking-wide text-[var(--rs-muted)]">
                {c.own ? `${c.brandName} (you)` : c.brandName} ·{" "}
                {c.status === "complete"
                  ? "Finished"
                  : c.status === "logged_out"
                    ? "Logged out"
                    : c.status === "paused"
                      ? "Paused"
                      : "Blocked"}
              </p>
              <p className="mt-1 text-sm leading-snug text-[var(--rs-fg)]">
                {c.note}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {brief.empty ? (
        <section className="rounded-2xl border border-dashed border-[var(--rs-border)] px-5 py-8 text-center">
          <p className="font-heading text-lg">Nothing to present yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--rs-muted)]">
            Finish a walk — signup, deposit, first bet — and pull Voice of
            Player. This page turns that into likes, dislikes, and the gap.
          </p>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {brief.metrics.map((m) => (
          <div
            key={m.label}
            className={cn(
              "rounded-2xl border px-4 py-4",
              m.caution
                ? "border-amber-500/30 bg-amber-500/[0.06]"
                : "border-[var(--rs-border)] bg-[var(--rs-card)]",
            )}
          >
            <p className="text-[11px] uppercase tracking-wide text-[var(--rs-muted)]">
              {m.label}
            </p>
            <p className="mt-2 font-heading text-xl font-medium leading-snug">
              {m.value}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--rs-muted)]">
              {m.hint}
            </p>
          </div>
        ))}
      </section>

      {brief.caveats.length ? (
        <section className="flex flex-col gap-3">
          <SectionKicker n="01" label="Read the clock honestly" />
          {brief.caveats.map((c) => (
            <div
              key={`${c.brandName}:${c.title}`}
              className="flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3.5"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />
              <div>
                <p className="text-sm font-medium">
                  {c.brandName} · {c.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--rs-muted)]">
                  {c.body}
                </p>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {brief.loves.length || brief.hates.length ? (
        <section className="flex flex-col gap-4">
          <SectionKicker
            n={brief.caveats.length ? "02" : "01"}
            label="Loved / didn’t"
          />
          <h3 className="font-heading text-2xl font-medium tracking-tight">
            What the walk recorded
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-300">
                Love
              </p>
              {brief.loves.length ? (
                brief.loves.map((b) => (
                  <BiteCard key={`${b.brandId}:${b.title}`} {...b} />
                ))
              ) : (
                <p className="text-sm text-[var(--rs-muted)]">
                  No strong likes recorded yet.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-red-300">
                Didn’t like
              </p>
              {brief.hates.length ? (
                brief.hates.map((b) => (
                  <BiteCard key={`${b.brandId}:${b.title}`} {...b} />
                ))
              ) : (
                <p className="text-sm text-[var(--rs-muted)]">
                  No sharp dislikes recorded yet.
                </p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {brief.gaps.length ? (
        <section className="flex flex-col gap-4">
          <SectionKicker n="03" label="The gap" />
          <h3 className="font-heading text-2xl font-medium tracking-tight">
            Features they have. You don’t.
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {brief.gaps.map((g) => (
              <li
                key={g.feature}
                className="flex gap-3 rounded-2xl border border-[var(--rs-border)] bg-[var(--rs-card)] p-3.5"
              >
                {g.shot ? <MiniShot src={g.shot.src} label={g.feature} /> : null}
                <div className="min-w-0">
                  <p className="font-heading text-[15px] font-medium">
                    {g.feature}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--rs-muted)]">
                    {g.note}
                  </p>
                  <p className="mt-2 text-[11px] uppercase tracking-wide text-[var(--rs-accent)]">
                    Seen at {g.whoHas.join(" · ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {brief.asks.length ? (
        <section className="flex flex-col gap-4">
          <SectionKicker n="04" label="Trustpilot — not the walk" />
          <h3 className="font-heading text-2xl font-medium tracking-tight">
            What players ask for
          </h3>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--rs-muted)]">
            {brief.commonDenominator}
          </p>
          <ul className="flex flex-col gap-2">
            {brief.asks.map((a) => (
              <li
                key={a.theme}
                className="flex flex-col gap-1 rounded-2xl border border-[var(--rs-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium">{a.theme}</p>
                  <p className="mt-0.5 text-xs text-[var(--rs-muted)]">
                    {a.insight}
                  </p>
                </div>
                <p className="shrink-0 text-[11px] uppercase tracking-wide text-[var(--rs-muted)]">
                  {a.brands.length} brand{a.brands.length === 1 ? "" : "s"} ·{" "}
                  {a.mentions} mention{a.mentions === 1 ? "" : "s"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {brief.heroes.length ? (
        <section className="flex flex-col gap-4">
          <SectionKicker n="05" label="One frame each" />
          <h3 className="font-heading text-2xl font-medium tracking-tight">
            Evidence, not a gallery
          </h3>
          <p className="text-sm text-[var(--rs-muted)]">
            One shot per brand. Tap to open. The rest lives on Journeys.
          </p>
          <ul className="flex flex-wrap gap-3">
            {brief.heroes.map((h) => (
              <li key={h.brandId} className="flex w-[4.75rem] flex-col gap-1.5">
                <ScreenshotLightbox
                  src={h.src}
                  alt={h.label}
                  caption={`${h.brandName} — ${h.label}`}
                  frame="phone"
                  className="h-24 w-[4.75rem] rounded-xl border border-[var(--rs-border)]"
                />
                <p className="truncate text-[11px] font-medium">
                  {h.own ? `${h.brandName} (you)` : h.brandName}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {brief.reveal ? (
        <section className="flex flex-col gap-8 border-t border-[var(--rs-border)] pt-12">
          <SectionKicker n="06" label={brief.reveal.kicker} />
          <h3 className="font-heading text-4xl font-medium tracking-tight text-balance sm:text-5xl">
            {brief.reveal.headline}
          </h3>
          <p className="max-w-2xl text-lg leading-relaxed text-[var(--rs-fg)]">
            {brief.reveal.lede}
          </p>
          <ol className="flex flex-col gap-5">
            {brief.reveal.moves.map((m) => (
              <li
                key={m.n}
                className="rounded-2xl border border-[var(--rs-border)] bg-[var(--rs-card)] px-6 py-6"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--rs-accent)]">
                  {m.n}
                </p>
                <h4 className="mt-2 font-heading text-2xl font-medium tracking-tight">
                  {m.title}
                </h4>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--rs-muted)]">
                  {m.body}
                </p>
              </li>
            ))}
          </ol>
          <p className="max-w-2xl font-heading text-xl font-medium leading-snug tracking-tight">
            {brief.reveal.closer}
          </p>
        </section>
      ) : brief.nextMoves.length ? (
        <section className="flex flex-col gap-4">
          <SectionKicker n="06" label="Do this next" />
          <h3 className="font-heading text-2xl font-medium tracking-tight">
            Three moves
          </h3>
          <ol className="flex flex-col gap-2">
            {brief.nextMoves.map((move, i) => (
              <li
                key={move}
                className="flex gap-3 rounded-2xl border border-[var(--rs-border)] px-4 py-3"
              >
                <span className="font-heading text-sm text-[var(--rs-accent)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-sm leading-relaxed">{move}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </article>
  );
}
