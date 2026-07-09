"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CircleAlert, Plus } from "lucide-react";
import { ScuupLogo } from "@/components/scuup-logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/user-menu";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { useProjects } from "@/lib/project-store";
import { JOURNEY_LABELS } from "@/lib/constants";
import type { Project } from "@/lib/types";

function statusBadge(status: Project["status"]) {
  if (status === "complete") return <Badge>Complete</Badge>;
  if (status === "analyzing") return <Badge variant="secondary">Analyzing</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

function AnalysisFailedBanner() {
  const params = useSearchParams();
  if (params.get("analysis_failed") !== "1") return null;
  return (
    <Alert variant="destructive" className="mb-6">
      <CircleAlert />
      <AlertTitle>Analysis didn&apos;t complete</AlertTitle>
      <AlertDescription>
        Every journey visit failed — usually a Browserbase session limit or
        connectivity issue. Fix the underlying problem, then open the project
        and run analysis again.
      </AlertDescription>
    </Alert>
  );
}

export default function DashboardPage() {
  const projects = useProjects();

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-6 py-4">
          <ScuupLogo href="/dashboard" />
          <div className="ms-auto flex items-center gap-3">
            <UserMenu />
            <Button nativeButton={false} render={<Link href="/projects/new" />}>
              <Plus data-icon="inline-start" />
              New project
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <Suspense fallback={null}>
          <VerifyEmailBanner />
        </Suspense>
        <Suspense fallback={null}>
          <AnalysisFailedBanner />
        </Suspense>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-1 text-muted-foreground">
          Your competitor audits and reports.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects === undefined ? (
            <>
              <Skeleton className="h-44" />
              <Skeleton className="h-44" />
              <Skeleton className="h-44" />
            </>
          ) : projects.length === 0 ? (
            <Card className="sm:col-span-2 lg:col-span-3">
              <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                <p className="font-heading text-2xl font-semibold tracking-tight text-muted-foreground/40">
                  Scuup
                </p>
                <p className="text-sm text-muted-foreground">
                  No audits yet. Create your first project — a real browser
                  will visit each brand and score what it sees.
                </p>
                <Button
                  nativeButton={false}
                  render={<Link href="/projects/new" />}
                >
                  <Plus data-icon="inline-start" />
                  New project
                </Button>
              </CardContent>
            </Card>
          ) : (
            projects.map((project) => (
              <Card key={project.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    {statusBadge(project.status)}
                  </div>
                  <CardDescription>
                    {project.market} · {project.brands.length} brands
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <div className="flex flex-wrap gap-1.5">
                    {project.journeys.slice(0, 4).map((j) => (
                      <Badge key={j} variant="outline">
                        {JOURNEY_LABELS[j]}
                      </Badge>
                    ))}
                    {project.journeys.length > 4 ? (
                      <Badge variant="outline">
                        +{project.journeys.length - 4} more
                      </Badge>
                    ) : null}
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full"
                    render={
                      <Link
                        href={
                          project.status === "analyzing"
                            ? `/projects/${project.id}/analyzing`
                            : `/projects/${project.id}/overview`
                        }
                      />
                    }
                  >
                    {project.status === "analyzing"
                      ? "View progress"
                      : "Open dashboard"}
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
