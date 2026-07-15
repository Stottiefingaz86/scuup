"use client";

import { useParams } from "next/navigation";
import { AreaFocus } from "@/components/area-focus";
import { ProjectShell } from "@/components/project-shell";
import type { Project } from "@/lib/types";

function CashierContent({ project }: { project: Project }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        A deep dive, not a score pillar, deposit and withdraw flows are
        shown here for context and evidence, but they don&apos;t move the
        Player CX Score.
      </p>
      <AreaFocus
        project={project}
        areas={["deposit", "withdraw"]}
        emptyHint="Cashier flows sit behind login, record a live session making a small deposit or withdrawal to score them with real evidence."
      />
    </div>
  );
}

export default function CashierPage() {
  const params = useParams<{ id: string }>();
  return (
    <ProjectShell projectId={params.id}>
      {(project) => <CashierContent project={project} />}
    </ProjectShell>
  );
}
