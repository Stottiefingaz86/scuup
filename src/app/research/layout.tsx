import type { Metadata } from "next";
import { ResearchShell } from "@/components/research-shell";
import { ResearchWorkspacePrime } from "@/components/research-workspace-prime";
import { loadResearchWorkspace } from "@/lib/research/workspace-server";
import "./research.css";

export const metadata: Metadata = {
  title: "Research | Timed journey teardowns",
  description:
    "Internal product tool — stopwatch journey maps, competitor teardowns, and CRM inbox evidence for activation work.",
};

export const dynamic = "force-dynamic";

export default async function ResearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let projects: Awaited<ReturnType<typeof loadResearchWorkspace>> = [];
  try {
    projects = await loadResearchWorkspace();
  } catch {
    projects = [];
  }
  return (
    <ResearchWorkspacePrime projects={projects}>
      <ResearchShell>{children}</ResearchShell>
    </ResearchWorkspacePrime>
  );
}
