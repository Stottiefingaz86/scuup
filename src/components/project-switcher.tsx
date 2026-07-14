"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronsUpDown,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  archiveProject,
  deleteProject,
  unarchiveProject,
  useProjects,
} from "@/lib/project-store";
import type { Project } from "@/lib/types";

export function ProjectSwitcher({ project }: { project: Project }) {
  const projects = useProjects() ?? [];
  const router = useRouter();
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const archived = project.status === "archived";
  const isViewer = project.access === "viewer";

  async function onArchive() {
    setBusy(true);
    try {
      await archiveProject(project.id);
      setConfirm(null);
      toast.success("Report archived", {
        description:
          "It's paused — no more updates will run until you reactivate it.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to archive report");
    } finally {
      setBusy(false);
    }
  }

  async function onReactivate() {
    try {
      await unarchiveProject(project.id);
      toast.success("Report reactivated", {
        description: "Agent runs and score updates are back on.",
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to reactivate report"
      );
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await deleteProject(project.id);
      toast.success("Report deleted", {
        description: "All scores, screenshots and sessions were removed.",
      });
      router.push("/dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete report");
      setBusy(false);
    }
  }

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
                {archived ? "Archived — paused" : project.market}
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
                  {p.access === "viewer" ? (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      Shared
                    </Badge>
                  ) : p.status === "archived" ? (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      Archived
                    </Badge>
                  ) : null}
                  {p.id === project.id ? (
                    <Check className="size-4 shrink-0 text-primary" />
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
            {!isViewer ? (
            <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                This report
              </DropdownMenuLabel>
              {archived ? (
                <DropdownMenuItem
                  className="gap-2.5 px-2 py-2"
                  onClick={onReactivate}
                >
                  <ArchiveRestore className="size-4 text-muted-foreground" />
                  Reactivate report
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="gap-2.5 px-2 py-2"
                  onClick={() => setConfirm("archive")}
                >
                  <Archive className="size-4 text-muted-foreground" />
                  Archive report
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                className="gap-2.5 px-2 py-2"
                onClick={() => setConfirm("delete")}
              >
                <Trash2 className="size-4" />
                Delete report
              </DropdownMenuItem>
            </DropdownMenuGroup>
            </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog
          open={confirm === "archive"}
          onOpenChange={(open) => !open && setConfirm(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Archive this report?</DialogTitle>
              <DialogDescription>
                Archiving pauses <strong>{project.name}</strong>. No agent
                runs, score updates or new evidence — everything captured so
                far stays readable, and you can reactivate it anytime. Plans
                currently include one active report, so archiving frees the
                slot for a new one.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Keep active
              </DialogClose>
              <Button onClick={onArchive} disabled={busy}>
                <Archive />
                {busy ? "Archiving…" : "Archive report"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={confirm === "delete"}
          onOpenChange={(open) => !open && setConfirm(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this report?</DialogTitle>
              <DialogDescription>
                This permanently deletes <strong>{project.name}</strong> —
                every score, screenshot, session and action plan. No further
                updates will ever run and nothing can be recovered. If you
                just want to pause it, archive it instead.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              {!archived ? (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={onArchive}
                >
                  <Archive />
                  Archive instead
                </Button>
              ) : (
                <DialogClose render={<Button variant="outline" />}>
                  Cancel
                </DialogClose>
              )}
              <Button variant="destructive" onClick={onDelete} disabled={busy}>
                <Trash2 />
                {busy ? "Deleting…" : "Delete forever"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
