import { listProjects } from "./project-db";
import type { Project } from "./types";

/** Where signed-in users should land — latest project overview, or new project. */
export function appHomePath(
  projects: Pick<Project, "id" | "status">[],
  search?: string
): string {
  let path: string;
  if (projects.length === 0) {
    path = "/projects/new";
  } else if (projects[0].status === "analyzing") {
    path = `/projects/${projects[0].id}/analyzing`;
  } else {
    path = `/projects/${projects[0].id}/overview`;
  }
  return search ? `${path}?${search}` : path;
}

export async function appHomePathForUser(userId: string, search?: string) {
  const projects = await listProjects(userId);
  return appHomePath(projects, search);
}
