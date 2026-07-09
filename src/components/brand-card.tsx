import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";
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
import { ScoreBar } from "@/components/score-bar";
import { ScoreGauge } from "@/components/score-gauge";
import { LANDING } from "@/lib/constants";
import { areaScore, overallScore, type Brand } from "@/lib/types";

export function BrandCard({
  brand,
  projectId,
  rank,
}: {
  brand: Brand;
  projectId: string;
  rank?: number;
}) {
  const own = brand.role === "own_brand";
  const overall = overallScore(brand);
  const landing = brand.analyses[LANDING];
  const analysedAreas = Object.values(brand.analyses).filter(
    (a) => !a.blocked
  ).length;

  return (
    <Card
      className={cn(
        "group/score relative flex flex-col overflow-hidden",
        own && "ring-1 ring-brand/40"
      )}
    >
      {own ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 h-36 w-4/5 -translate-x-1/2 rounded-full bg-brand/15 blur-3xl"
        />
      ) : null}
      <CardHeader>
        <div className="flex items-center gap-3">
          <BrandMark brand={brand} className="size-10 text-base" />
          <div className="flex min-w-0 flex-col">
            <CardTitle className="truncate font-heading">{brand.name}</CardTitle>
            <span className="truncate text-xs text-muted-foreground">
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
      <CardContent className="flex flex-1 flex-col gap-5">
        {overall !== null ? (
          <ScoreGauge
            score={overall}
            size={150}
            caption="Player CX Score"
            muted={!own}
            className="mx-auto"
          />
        ) : (
          <div className="mx-auto flex h-[100px] flex-col items-center justify-center gap-1.5">
            <span className="font-heading text-3xl font-semibold text-muted-foreground/40">
              N/A
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              No successful analysis yet
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t pt-4">
          {areaScore(brand, LANDING) !== null ? (
            <ScoreBar
              label="First Impression"
              score={areaScore(brand, LANDING)!}
              muted={!own}
            />
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldAlert className="size-3.5 shrink-0 text-score-mid" />
              First impression{" "}
              {landing?.blocked ? "blocked by a bot wall" : "not analysed"}
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            {analysedAreas} area{analysedAreas === 1 ? "" : "s"} scored so far
            — deeper journeys fill in from live sessions.
          </span>
        </div>

        {landing?.summary ? (
          <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
            <p className="line-clamp-4 text-xs leading-snug text-muted-foreground">
              {landing.summary}
            </p>
          </div>
        ) : null}
      </CardContent>
      <CardFooter>
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
