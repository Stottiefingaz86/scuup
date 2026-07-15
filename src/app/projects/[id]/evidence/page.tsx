"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  Camera,
  Coins,
  ExternalLink,
  Gift,
  MonitorPlay,
  Radio,
  Route,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";
import { formatElapsed } from "@/components/live-capture-dialog";
import { ProjectShell } from "@/components/project-shell";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { ANALYSIS_AREA_LABELS } from "@/lib/constants";
import type { CaptureEvent, CaptureRecord, Project } from "@/lib/types";

const KIND_ICON: Record<CaptureEvent["kind"], typeof Coins> = {
  money: Coins,
  reward: Gift,
  screen: Route,
  info: MonitorPlay,
};

/** One recorded live session with its expandable event timeline,
 * deposits, bets, rewards and navigation, exactly as detected. */
function SessionCard({ session }: { session: CaptureRecord }) {
  const [open, setOpen] = useState(false);
  const moneyCount = session.events.filter((e) => e.kind === "money").length;
  const rewardCount = session.events.filter((e) => e.kind === "reward").length;

  return (
    <div className="rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full cursor-pointer p-4 text-left"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-sm font-medium">{session.brandName}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(session.date).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          <span className="ms-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatElapsed(session.durationSec)} recorded</span>
            <span className="flex items-center gap-1">
              <Coins className="size-3.5 text-primary" />
              {moneyCount}
            </span>
            <span className="flex items-center gap-1">
              <Gift className="size-3.5 text-brand" />
              {rewardCount}
            </span>
          </span>
        </div>
      </button>
      {open ? (
        <ol className="flex flex-col gap-2 border-t p-4 ps-6">
          {session.events.map((event, i) => {
            const Icon = KIND_ICON[event.kind];
            return (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-10 shrink-0 pt-0.5 text-end font-mono text-[11px] tabular-nums text-muted-foreground/60">
                  {formatElapsed(event.at)}
                </span>
                <Icon
                  className={cn(
                    "mt-0.5 size-3.5 shrink-0",
                    event.kind === "reward"
                      ? "text-brand"
                      : event.kind === "money"
                        ? "text-primary"
                        : "text-muted-foreground"
                  )}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm text-foreground/90">
                    {event.label}
                  </span>
                  {event.detail ? (
                    <span className="truncate text-xs text-muted-foreground/70">
                      {event.detail}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

function EvidenceContent({ project }: { project: Project }) {
  const items = project.brands.flatMap((brand) =>
    Object.values(brand.analyses).map((analysis) => ({ brand, analysis }))
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="size-4 text-brand" />
            Evidence library
          </CardTitle>
          <CardDescription>
            Every score traces back to a real visit. Analysis runs and
            recorded sessions land here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No evidence yet, it appears when an analysis completes or a
              live session is saved.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map(({ brand, analysis }) => (
                <div
                  key={`${brand.id}-${analysis.area}`}
                  className="flex items-start gap-3 rounded-xl border p-4"
                >
                  <BrandMark brand={brand} className="mt-0.5 size-6" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{brand.name}</span>
                      <Badge variant="outline">
                        {ANALYSIS_AREA_LABELS[analysis.area] ?? analysis.area}
                      </Badge>
                      {analysis.blocked ? (
                        <Badge variant="secondary">Blocked</Badge>
                      ) : (
                        <Badge variant="secondary" className="tabular-nums">
                          {analysis.score}/100
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(analysis.analysedAt).toLocaleString(
                          undefined,
                          { dateStyle: "medium", timeStyle: "short" }
                        )}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {analysis.blocked
                        ? analysis.blockReason
                        : analysis.summary}
                    </p>
                    <a
                      href={analysis.finalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex w-fit items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" />
                      {analysis.finalUrl}
                    </a>
                    {analysis.screenshots?.length ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {analysis.screenshots.map((src, i) => (
                          <ScreenshotLightbox
                            key={src}
                            src={src}
                            alt={`${brand.name}: ${ANALYSIS_AREA_LABELS[analysis.area] ?? analysis.area} screenshot ${i + 1}`}
                            className="h-20 w-32"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="size-4 text-brand" />
            Live sessions
          </CardTitle>
          <CardDescription>
            Every recorded capture session with its full event timeline,
            deposits, bets, rewards and navigation, exactly as detected.
            Click a session to expand it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {project.sessions.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No recorded sessions yet, launch any brand from a Take control
              button to start one.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {project.sessions.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function EvidencePage() {
  const params = useParams<{ id: string }>();
  return (
    <ProjectShell projectId={params.id}>
      {(project) => <EvidenceContent project={project} />}
    </ProjectShell>
  );
}
