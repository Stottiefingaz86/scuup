"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ActionPlanView } from "@/components/action-plan-view";
import { ProjectShell } from "@/components/project-shell";
import { generateActionPlan } from "@/lib/project-store";
import type { Project } from "@/lib/types";

/** True when any analysis is newer than the plan, time for a refresh. */
function planIsStale(project: Project): boolean {
  const plan = project.actionPlan;
  if (!plan) return false;
  return project.brands.some((b) =>
    Object.values(b.analyses).some(
      (a) => !a.blocked && a.analysedAt > plan.generatedAt
    )
  );
}

function ActionPlanContent({ project }: { project: Project }) {
  const [building, setBuilding] = useState(false);
  const autoTriggered = useRef(false);

  const analysedCount = project.brands.reduce(
    (n, b) => n + Object.values(b.analyses).filter((a) => !a.blocked).length,
    0
  );
  const plan = project.actionPlan;
  const stale = planIsStale(project);

  const build = async () => {
    setBuilding(true);
    try {
      await generateActionPlan(project.id);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to build the action plan."
      );
    } finally {
      setBuilding(false);
    }
  };

  // First visit with analyses but no plan yet: build it automatically.
  useEffect(() => {
    if (!plan && analysedCount > 0 && !autoTriggered.current) {
      autoTriggered.current = true;
      void build();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, analysedCount]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <CardTitle className="flex items-center gap-2">
                <Zap className="size-4 text-brand" />
                Action plan
              </CardTitle>
              <CardDescription>
                Synthesised from {analysedCount} real analysed visit
                {analysedCount === 1 ? "" : "s"} across your set, every action
                cites the finding that justifies it.
                {plan ? (
                  <>
                    {" "}
                    Last built{" "}
                    {new Date(plan.generatedAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    {stale
                      ? ", new analyses have landed since, refresh to fold them in."
                      : "."}
                  </>
                ) : null}
              </CardDescription>
            </div>
            {plan ? (
              <Button
                size="sm"
                variant={stale ? "default" : "outline"}
                disabled={building}
                onClick={build}
              >
                {building ? (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                {building ? "Rebuilding…" : "Refresh plan"}
              </Button>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      {plan ? (
        <ActionPlanView plan={plan} />
      ) : building ? (
        <Card>
          <CardHeader className="items-center py-14 text-center">
            <LoaderCircle className="mx-auto size-6 animate-spin text-brand" />
            <CardTitle className="text-base">
              Building your action plan
            </CardTitle>
            <CardDescription>
              The strategist is weighing every finding across{" "}
              {project.brands.length} brands, prioritising by impact and
              effort. Takes about half a minute.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader className="items-center py-14 text-center">
            <CardTitle className="text-base">No plan yet</CardTitle>
            <CardDescription>
              {analysedCount === 0
                ? "The plan is built from real analyses, run the agent on at least one area first."
                : "Something went wrong building the plan automatically."}
            </CardDescription>
            {analysedCount > 0 ? (
              <Button size="sm" className="mt-2" onClick={build}>
                <Zap data-icon="inline-start" />
                Build action plan
              </Button>
            ) : null}
          </CardHeader>
        </Card>
      )}
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
