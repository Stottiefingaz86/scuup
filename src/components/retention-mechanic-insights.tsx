"use client";

import { useMemo, useState } from "react";
import { ArrowDown, Lightbulb, LoaderCircle, TrendingDown } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScoreChip } from "@/components/score-chip";
import { buildMechanicInsights } from "@/lib/retention-insights";
import { tierTextClass } from "@/lib/score";
import { cn } from "@/lib/utils";
import type { Brand, JourneyAnalysis } from "@/lib/types";

export function RetentionMechanicInsights({
  ownBrand,
  competitors,
  loyaltyOf,
  mechanicScore,
  loadingLabel,
}: {
  ownBrand: Brand;
  competitors: Brand[];
  loyaltyOf: (brand: Brand) => JourneyAnalysis | null;
  mechanicScore: (analysis: JourneyAnalysis | null, key: string) => number | null;
  loadingLabel?: string;
}) {
  const insights = useMemo(
    () => buildMechanicInsights(ownBrand, competitors, loyaltyOf),
    [ownBrand, competitors, loyaltyOf]
  );
  const [expanded, setExpanded] = useState<string | null>(
    insights.find((i) => i.gap !== null && i.gap < 0)?.key ??
      insights[0]?.key ??
      null
  );

  const biggestGaps = insights.filter(
    (i) => i.canAdvise && i.gap !== null && i.gap < -5
  );
  const ownAnalysis = loyaltyOf(ownBrand);
  const ownLoggedIn = ownAnalysis?.retentionContext?.loggedIn ?? false;

  if (!ownAnalysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Why these scores</CardTitle>
          <CardDescription>
            Run the loyalty agent on your brand to get evidence-backed
            per-mechanic notes and competitor gaps.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="size-4 text-brand" />
          Why these scores — and where to improve
        </CardTitle>
        <CardDescription>
          {loadingLabel ? (
            <span className="flex items-center gap-2">
              <LoaderCircle className="size-3.5 animate-spin" />
              {loadingLabel}
            </span>
          ) : biggestGaps.length > 0 ? (
            `${ownBrand.name} trails competitors on ${biggestGaps.length} mechanic${biggestGaps.length === 1 ? "" : "s"}. Each row cites screenshot evidence and a concrete next step.`
          ) : !ownLoggedIn ? (
            "Several mechanics need a logged-in session before we score or recommend changes — progress meters and personal tier status are often hidden until sign-in."
          ) : (
            "Per-mechanic evidence and actions from your loyalty visit."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!ownLoggedIn ? (
          <p className="rounded-lg border border-score-mid/30 bg-score-mid/[0.06] px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            This loyalty visit was logged out. We won&apos;t suggest product
            changes for progress, personalisation, or account integration until
            you Launch, sign in, and capture the rewards hub — otherwise advice
            like &ldquo;add a progress meter&rdquo; can be wrong when the
            feature already exists behind login.
          </p>
        ) : null}
        {insights.map((insight) => {
          const open = expanded === insight.key;
          const behind =
            insight.canAdvise &&
            insight.gap !== null &&
            insight.gap < 0 &&
            insight.ownScore !== null;
          return (
            <div
              key={insight.key}
              className={cn(
                "rounded-xl border transition-colors",
                behind && "border-score-weak/30 bg-score-weak/[0.03]",
                open && "border-border bg-card"
              )}
            >
              <button
                type="button"
                className="flex w-full items-start gap-3 p-4 text-left"
                onClick={() =>
                  setExpanded(open ? null : insight.key)
                }
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-medium">{insight.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {insight.requires === "login"
                      ? "Needs login to score"
                      : insight.requires === "tracked_play"
                        ? "Needs tracked play"
                        : "From loyalty visit"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {insight.ownScore !== null ? (
                    <ScoreChip score={insight.ownScore} />
                  ) : (
                    <ScoreChip score={null} />
                  )}
                  {insight.bestCompetitor && insight.canAdvise ? (
                    <>
                      <span className="text-xs text-muted-foreground">vs</span>
                      <span className="text-xs text-muted-foreground">
                        {insight.bestCompetitor.name}{" "}
                        <span className="font-medium tabular-nums text-foreground">
                          {insight.bestCompetitor.score}
                        </span>
                      </span>
                    </>
                  ) : null}
                  {behind ? (
                    <span
                      className={cn(
                        "flex items-center gap-0.5 text-xs font-medium tabular-nums",
                        tierTextClass(insight.ownScore!)
                      )}
                    >
                      <TrendingDown className="size-3" />
                      {insight.gap}
                    </span>
                  ) : null}
                </div>
              </button>
              {open ? (
                <div className="flex flex-col gap-4 border-t px-4 pb-4 pt-3">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    {insight.screenshotUrl ? (
                      <span className="block aspect-[8/5] w-full shrink-0 overflow-hidden rounded-md border sm:w-40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={insight.screenshotUrl}
                          alt="Evidence for this mechanic"
                          className="h-full w-full object-cover object-top"
                        />
                      </span>
                    ) : null}
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <div>
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Evidence
                        </span>
                        <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                          {insight.note}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "rounded-lg border p-3",
                          insight.canAdvise
                            ? "border-brand/20 bg-brand/[0.04]"
                            : "border-border bg-muted/30"
                        )}
                      >
                        <span
                          className={cn(
                            "flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider",
                            insight.canAdvise ? "text-brand" : "text-muted-foreground"
                          )}
                        >
                          <ArrowDown className="size-3" />
                          {insight.canAdvise
                            ? "What to do better"
                            : "Next step — sign in first"}
                        </span>
                        <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                          {insight.improve}
                        </p>
                        {insight.bestCompetitor && behind ? (
                          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                            {insight.bestCompetitor.name} leads here at{" "}
                            {insight.bestCompetitor.score}
                            {insight.competitorNote
                              ? ` — ${insight.competitorNote}`
                              : " — study their loyalty hub in the deep dive above."}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {competitors.map((c) => {
                    const score = mechanicScore(loyaltyOf(c), insight.key);
                    if (score === null) return null;
                    return (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <BrandMark brand={c} className="size-3.5" />
                        {c.name}
                        <ScoreChip score={score} muted className="ms-auto" />
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
