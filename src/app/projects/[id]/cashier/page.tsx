"use client";

import { useParams } from "next/navigation";
import { AreaFocus } from "@/components/area-focus";
import { ProjectShell } from "@/components/project-shell";
import type { Project } from "@/lib/types";

function CashierContent({ project }: { project: Project }) {
  return (
    <AreaFocus
      project={project}
      areas={["deposit", "withdraw"]}
      emptyHint="Cashier flows sit behind login — record a live session making a small deposit or withdrawal to score them with real evidence."
    />
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
