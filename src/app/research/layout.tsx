import type { Metadata } from "next";
import { ResearchShell } from "@/components/research-shell";
import "./research.css";

export const metadata: Metadata = {
  title: "Research | Timed journey teardowns",
  description:
    "Internal product tool — stopwatch journey maps, competitor teardowns, and CRM inbox evidence for activation work.",
};

export default function ResearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ResearchShell>{children}</ResearchShell>;
}
