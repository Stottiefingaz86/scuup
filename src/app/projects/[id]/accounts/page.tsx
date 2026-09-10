"use client";

import { useParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BrandTestAccountPanel } from "@/components/brand-test-account-panel";
import { ProjectShell } from "@/components/project-shell";
import { LOGIN_AGENT_JOURNEYS } from "@/lib/constants";
import { projectAreas } from "@/lib/coverage";
import type { Project } from "@/lib/types";

function AccountsContent({ project }: { project: Project }) {
  const areas = projectAreas(project);
  const loginJourneys = LOGIN_AGENT_JOURNEYS.filter((j) => areas.includes(j));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-brand" />
            Test accounts
          </CardTitle>
          <CardDescription>
            Save login details per brand so the agent can walk logged-in
            journeys — first deposit, withdraw and my account. Use{" "}
            <strong>Log in &amp; save session</strong> when a site needs captcha
            or 2FA; then re-run the journeys from here or the journey map.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loginJourneys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This project has no logged-in journeys selected. Add deposit,
              withdraw or my account when creating a project to use test
              accounts.
            </p>
          ) : (
            <p className="mb-4 text-xs text-muted-foreground">
              Logged-in journeys in scope:{" "}
              {loginJourneys
                .map((j) =>
                  j === "deposit"
                    ? "First time deposit"
                    : j.replace("_", " ")
                )
                .join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {project.brands.map((brand) => (
          <BrandTestAccountPanel key={brand.id} project={project} brand={brand} />
        ))}
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const params = useParams<{ id: string }>();
  return (
    <ProjectShell projectId={params.id}>
      {(project) => <AccountsContent project={project} />}
    </ProjectShell>
  );
}
