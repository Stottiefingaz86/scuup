import { listProjects } from "./project-db";
import type { Project } from "./types";

/** Where signed-in users should land — latest project overview, or new project. */
export function appHomePath(
  projects: Pick<Project, "id" | "status">[],
  search?: string
): string {
  // Land on the live report when one exists; archived ones only count
  // when nothing is active.
  const home = projects.find((p) => p.status !== "archived") ?? projects[0];
  let path: string;
  if (!home) {
    path = "/projects/new";
  } else if (home.status === "analyzing") {
    path = `/projects/${home.id}/analyzing`;
  } else {
    path = `/projects/${home.id}/overview`;
  }
  return search ? `${path}?${search}` : path;
}

export async function appHomePathForUser(userId: string, search?: string) {
  const projects = await listProjects(userId);
  return appHomePath(projects, search);
}
