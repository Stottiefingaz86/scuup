"use client";

import { useLayoutEffect } from "react";
import {
  adoptRemoteProjects,
  ResearchServerProjects,
} from "@/lib/research/store";
import type { ResearchProject } from "@/lib/research/types";

/** Server workspace on first paint, then copied into the client store. */
export function ResearchWorkspacePrime({
  projects,
  children,
}: {
  projects: ResearchProject[];
  children: React.ReactNode;
}) {
  useLayoutEffect(() => {
    adoptRemoteProjects(projects);
  }, [projects]);
  return (
    <ResearchServerProjects.Provider value={projects}>
      {children}
    </ResearchServerProjects.Provider>
  );
}
