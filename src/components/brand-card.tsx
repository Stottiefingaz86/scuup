import Link from "next/link";
import {
  ArrowRight,
  MessagesSquare,
  Minus,
  Palette,
  Repeat,
  Route,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";
import { ScoreGauge } from "@/components/score-gauge";
import {
  TIER_BG_GROUP_HOVER,
  TIER_TEXT_GROUP_HOVER,
  tierBgClass,
  tierOf,
  tierTextClass,
} from "@/lib/score";
import {
  overallScore,
  scorePillars,
  type Brand,
  type ScorePillar,
} from "@/lib/types";

const PILLAR_ICONS: Record<ScorePillar["key"], typeof Route> = {
  journeys: Route,
  retention: Repeat,
  voc: MessagesSquare,
  design: Palette,
};

/** One slim pillar row: icon + label, score, thin tier-coloured bar. */
export function PillarRow({ pillar, muted }: { pillar: ScorePillar; muted: boolean }) {
  const Icon = PILLAR_ICONS[pillar.key];
  const scored = pillar.score !== null;
  return (
    <div className="flex flex-col gap-1" title={pillar.detail}>
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5 shrink-0 text-muted-foreground/60" />
        <span className="truncate text-xs text-muted-foreground">
          {pillar.label}
        </span>
        <span
          className={cn(
            "ms-auto font-heading text-xs font-semibold tabular-nums transition-colors duration-200",
            !scored
              ? "font-normal text-muted-foreground/50"
              : muted
                ? cn(
                    "text-muted-foreground",
                    TIER_TEXT_GROUP_HOVER[tierOf(pillar.score!)]
                  )
                : tierTextClass(pillar.score!)
          )}
        >
          {scored ? pillar.score : "N/A"}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted/60">
        {scored ? (
          <div
            className={cn(
              "h-full rounded-full transition-colors duration-200",
              muted
                ? cn(
                    "bg-foreground/30",
                    TIER_BG_GROUP_HOVER[tierOf(pillar.score!)]
                  )
                : cn(tierBgClass(pillar.score!), "opacity-90")
            )}
            style={{ width: `${pillar.score}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Small signed movement chip: "+3 this cycle". Hidden until a second run
 * exists, so first reports don't show noise. */
function TrendBadge({ delta }: { delta: number | null | undefined }) {
  if (delta == null) return null;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  return (
    <span
      title="Average score movement vs the previous run of each area"
      className={cn(
        "mx-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums",
        delta > 0
          ? "border-score-strong/30 text-score-strong"
          : delta < 0
            ? "border-score-weak/30 text-score-weak"
            : "border-border text-muted-foreground"
      )}
    >
      <Icon className="size-3" />
      {delta > 0 ? `+${delta}` : delta === 0 ? "±0" : delta} this cycle
    </span>
  );
}

export function BrandCard({
  brand,
  projectId,
  rank,
  trendDelta,
}: {
  brand: Brand;
  projectId: string;
  rank?: number;
  /** Average score change vs the previous run, when history exists. */
  trendDelta?: number | null;
}) {
  const own = brand.role === "own_brand";
  const overall = overallScore(brand);
  const pillars = scorePillars(brand);
  const scoredPillars = pillars.filter((p) => p.score !== null);
  const pendingPillars = pillars.filter((p) => p.score === null);

  return (
    <Card
      className={cn(
        "group/score relative flex flex-col gap-4 overflow-hidden py-4",
        own && "ring-1 ring-brand/40"
      )}
    >
      {own ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 h-36 w-4/5 -translate-x-1/2 rounded-full bg-brand/15 blur-3xl"
        />
      ) : null}
      <CardHeader className="px-4">
        <div className="flex items-center gap-2.5">
          <BrandMark brand={brand} className="size-8 text-sm" />
          <div className="flex min-w-0 flex-col">
            <CardTitle className="truncate font-heading text-sm">
              {brand.name}
            </CardTitle>
            <span className="truncate text-[11px] text-muted-foreground">
              {brand.url.replace(/^https?:\/\//, "")}
            </span>
          </div>
          <div className="ms-auto shrink-0">
            {own ? (
              <Badge>You</Badge>
            ) : rank !== undefined ? (
              <Badge variant="outline" className="tabular-nums">
                #{rank}
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 px-4">
        {overall !== null ? (
          <div className="mx-auto flex flex-col items-center gap-1.5">
            <ScoreGauge
              score={overall}
              size={116}
              caption="Player CX Score"
              muted={!own}
            />
            <TrendBadge delta={trendDelta} />
          </div>
        ) : (
          <div className="mx-auto flex h-[80px] flex-col items-center justify-center gap-1">
            <span className="font-heading text-2xl font-semibold text-muted-foreground/40">
              N/A
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              No successful analysis yet
            </span>
          </div>
        )}

        {/* The score's recipe: overall = average of the scored pillars. */}
        <div className="flex flex-col gap-2.5 border-t pt-3.5">
          {pillars.map((p) => (
            <PillarRow key={p.key} pillar={p} muted={!own} />
          ))}
          <span className="text-[10px] leading-snug text-muted-foreground/70">
            {overall !== null
              ? pendingPillars.length > 0
                ? `Player CX Score = average of ${scoredPillars.length} scored pillar${scoredPillars.length === 1 ? "" : "s"}. ${pendingPillars.map((p) => p.label).join(", ")} pending.`
                : `Player CX Score = average of ${scoredPillars.length} scored pillar${scoredPillars.length === 1 ? "" : "s"}.`
              : "Scores appear as the agent completes its first visits."}
          </span>
        </div>
      </CardContent>
      <CardFooter className="px-4">
        <Button
          variant={own ? "default" : "secondary"}
          size="sm"
          className="w-full"
          nativeButton={false}
          render={<Link href={`/projects/${projectId}/journeys`} />}
        >
          View journeys
          <ArrowRight data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  );
}
