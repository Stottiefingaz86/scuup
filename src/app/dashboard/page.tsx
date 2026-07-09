"use client";

import Link from "next/link";
import { ArrowRight, Plus, Telescope } from "lucide-react";
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
import { useProjects } from "@/lib/project-store";
import { JOURNEY_LABELS } from "@/lib/constants";
import type { Project } from "@/lib/types";

function statusBadge(status: Project["status"]) {
  if (status === "complete") return <Badge>Complete</Badge>;
  if (status === "analyzing") return <Badge variant="secondary">Analyzing</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

export default function DashboardPage() {
  const projects = useProjects();

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Telescope className="size-6 text-primary" />
            <span className="text-lg font-semibold tracking-tight">
              PlayerScope AI
            </span>
          </Link>
          <div className="ms-auto">
            <Button nativeButton={false} render={<Link href="/projects/new" />}>
              <Plus data-icon="inline-start" />
              New project
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
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
                <Telescope className="size-8 text-muted-foreground/50" />
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
