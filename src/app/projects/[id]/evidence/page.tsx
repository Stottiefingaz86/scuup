"use client";

import { useParams } from "next/navigation";
import { Camera, ExternalLink, Radio } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/brand-mark";
import { ProjectShell } from "@/components/project-shell";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { ANALYSIS_AREA_LABELS } from "@/lib/constants";
import type { Project } from "@/lib/types";

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
              No evidence yet — it appears when an analysis completes or a
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
                            alt={`${brand.name} — ${ANALYSIS_AREA_LABELS[analysis.area] ?? analysis.area} screenshot ${i + 1}`}
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
            Recorded sessions
          </CardTitle>
          <CardDescription>
            Live capture sessions saved from the recording window.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {project.sessions.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No recorded sessions yet — launch any brand from a Launch
              button to start one.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {project.sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border p-4"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">{s.brandName}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.date).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      · {Math.round(s.durationSec / 60)} min ·{" "}
                      {s.events.length} events
                    </span>
                  </div>
                </div>
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
