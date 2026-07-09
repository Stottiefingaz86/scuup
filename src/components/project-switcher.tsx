"use client";

import Link from "next/link";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useProjects } from "@/lib/project-store";
import type { Project } from "@/lib/types";
import { useRouter } from "next/navigation";

export function ProjectSwitcher({ project }: { project: Project }) {
  const projects = useProjects() ?? [];
  const router = useRouter();

  return (
    <SidebarMenu className="group-data-[collapsible=icon]:items-center">
      <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={project.name}
                className="data-[state=open]:bg-sidebar-accent group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center"
              />
            }
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 font-heading text-[10px] font-semibold uppercase text-primary group-data-[collapsible=icon]:size-6">
              {project.name.slice(0, 2)}
            </div>
            <div className="grid min-w-0 flex-1 gap-0.5 text-left leading-none group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-medium">
                {project.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {project.market}
              </span>
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64"
            side="bottom"
            align="start"
            sideOffset={6}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Switch analysis
              </DropdownMenuLabel>
              {projects.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  className="gap-2.5 px-2 py-2"
                  onClick={() => router.push(`/projects/${p.id}/overview`)}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted font-heading text-[10px] font-semibold uppercase">
                    {p.name.slice(0, 2)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{p.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {p.market}
                    </span>
                  </span>
                  {p.id === project.id ? (
                    <Check className="size-4 text-primary" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2.5 px-2 py-2"
              render={<Link href="/projects/new" />}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-dashed">
                <Plus className="size-4" />
              </span>
              New analysis
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
