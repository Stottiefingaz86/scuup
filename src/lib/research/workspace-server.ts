import "server-only";

import { supabase } from "@/lib/supabase-server";
import type { ResearchProject } from "./types";

export async function loadResearchWorkspace(): Promise<ResearchProject[]> {
  const { data, error } = await supabase()
    .from("research_workspace")
    .select("projects")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const projects = data?.projects;
  return Array.isArray(projects) ? (projects as ResearchProject[]) : [];
}
