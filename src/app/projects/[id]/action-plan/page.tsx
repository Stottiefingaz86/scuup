"use client";

import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Zap } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ProjectShell } from "@/components/project-shell";
import { ANALYSIS_AREA_LABELS } from "@/lib/constants";
import { toObservation, type Project } from "@/lib/types";

function ActionPlanContent({ project }: { project: Project }) {
  const ownBrand = project.brands.find((b) => b.role === "own_brand")!;
  const competitors = project.brands.filter((b) => b.role === "competitor");

  // Real actions: what the analyst observed on your own site (fix these),
  // plus what it observed working on competitor sites (learn from these).
  const ownActions = Object.values(ownBrand.analyses)
    .filter((a) => !a.blocked)
    .flatMap((a) =>
      a.observations.map((o) => ({
        area: a.area,
        observation: toObservation(o).text,
      }))
    );
  const competitorSignals = competitors.flatMap((brand) =>
    Object.values(brand.analyses)
      .filter((a) => !a.blocked)
      .flatMap((a) =>
        a.observations.map((o) => ({
          brand,
          area: a.area,
          observation: toObservation(o).text,
        }))
      )
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-4 text-brand" />
            Action plan
          </CardTitle>
          <CardDescription>
            Built from what the analyst actually saw — your issues to fix and
            competitor patterns worth stealing. It sharpens with every
            analysis and recorded session.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              On your site — observed issues & wins
            </CardTitle>
            <CardDescription>
              From analyses of {ownBrand.name}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ownActions.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Nothing yet — your site hasn&apos;t had a successful analysis.
                Resolve the block from the Overview coverage card to populate
                this.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {ownActions.map((action, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-xl border p-4"
                  >
                    <Badge variant="outline" className="mt-0.5 shrink-0">
                      {ANALYSIS_AREA_LABELS[action.area] ?? action.area}
                    </Badge>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {action.observation}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              On competitor sites — patterns to learn from
            </CardTitle>
            <CardDescription>
              What&apos;s working (or failing) for the brands taking your
              players.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {competitorSignals.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                No competitor analyses yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {competitorSignals.map((signal, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-xl border p-4"
                  >
                    <BrandMark brand={signal.brand} className="mt-0.5 size-5" />
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
                        {signal.brand.name} ·{" "}
                        {ANALYSIS_AREA_LABELS[signal.area] ?? signal.area}
                      </span>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {signal.observation}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ActionPlanPage() {
  const params = useParams<{ id: string }>();
  return (
    <ProjectShell projectId={params.id}>
      {(project) => <ActionPlanContent project={project} />}
    </ProjectShell>
  );
}
