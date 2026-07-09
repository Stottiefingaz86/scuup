"use client";

import { appHomePath } from "@/lib/app-home";
import { useProjects } from "@/lib/project-store";

/** Stable client navigation target for "Dashboard" / "My account". */
export function useAppHomeHref(): string {
  const projects = useProjects();
  if (projects === undefined) return "/account";
  return appHomePath(projects).split("?")[0] ?? "/account";
}
