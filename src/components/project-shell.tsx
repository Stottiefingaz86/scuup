"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Camera,
  Coins,
  FileText,
  Grid3x3,
  LayoutDashboard,
  MessagesSquare,
  Palette,
  Repeat,
  Route,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { NavUser } from "@/components/nav-user";
import { ProjectSwitcher } from "@/components/project-switcher";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { VerifyEmailPrompt } from "@/components/verify-email-dialog";
import { AnalysisFailedBanner } from "@/components/analysis-failed-banner";
import { unarchiveProject, useProject } from "@/lib/project-store";
import { tierTextClass } from "@/lib/score";
import { cn } from "@/lib/utils";
import {
  overallScore,
  scorePillars,
  type Project,
  type ScorePillar,
} from "@/lib/types";

function ArchivedBanner({ project }: { project: Project }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 print:hidden">
      <Archive className="size-4 shrink-0 text-amber-500" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">This report is archived.</span>{" "}
        <span className="text-muted-foreground">
          It&apos;s paused, no agent runs, score updates or new evidence
          until you reactivate it.
        </span>
      </p>
      {project.access !== "viewer" ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            unarchiveProject(project.id).catch((e) =>
              toast.error(
                e instanceof Error ? e.message : "Failed to reactivate report"
              )
            )
          }
        >
          <ArchiveRestore data-icon="inline-start" />
          Reactivate
        </Button>
      ) : null}
    </div>
  );
}

/** Nav mirrors how the Player CX Score is built: the four score pillars
 * first, then supporting context that informs but never moves the number,
 * then the outputs. */
const NAV_GROUPS = [
  {
    label: null,
    items: [{ slug: "overview", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Score pillars",
    items: [
      { slug: "journeys", label: "Journeys", icon: Route },
      { slug: "retention", label: "Retention", icon: Repeat },
      { slug: "voc", label: "Voice of Customer", icon: MessagesSquare },
      { slug: "design", label: "Design Review", icon: Palette },
    ],
  },
  {
    label: "Deep dives",
    items: [
      { slug: "features", label: "Feature Matrix", icon: Grid3x3 },
      { slug: "cashier", label: "Cashier Trust", icon: Coins },
    ],
  },
  {
    label: "Deliverables",
    items: [
      { slug: "evidence", label: "Evidence", icon: Camera },
      { slug: "report", label: "Report", icon: FileText },
      { slug: "action-plan", label: "Action Plan", icon: Zap },
    ],
  },
];

/** Which pillar score each nav slug reports, the reader's own brand,
 * mirroring the numbers on the overview card. */
const SLUG_PILLAR: Record<string, ScorePillar["key"]> = {
  journeys: "journeys",
  retention: "retention",
  voc: "voc",
  design: "design",
};

const PAGE_TITLES: Record<string, string> = {
  overview: "Overview",
  journeys: "Journeys",
  features: "Feature Matrix",
  retention: "Retention Loop",
  voc: "Voice of Customer",
  design: "Design Review",
  cashier: "Cashier Trust",
  evidence: "Evidence Library",
  report: "Report",
  "action-plan": "Action Plan",
};

export function ProjectShell({
  projectId,
  children,
}: {
  projectId: string;
  children: (project: Project) => React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const project = useProject(projectId);
  const currentSlug = pathname.split("/").pop() ?? "overview";
  const isViewer = project != null && project.access === "viewer";

  // Invited teammates only get the report, bounce them off other pages.
  useEffect(() => {
    if (isViewer && currentSlug !== "report") {
      router.replace(`/projects/${projectId}/report`);
    }
  }, [isViewer, currentSlug, projectId, router]);

  if (project === undefined) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden w-64 border-r p-4 lg:block">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-10 w-64" />
        </div>
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Project not found.</p>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/dashboard" />}
        >
          <ArrowLeft data-icon="inline-start" />
          Back to overview
        </Button>
      </div>
    );
  }

  const ownBrand = project.brands.find((b) => b.role === "own_brand");
  const pillarScores: Partial<Record<ScorePillar["key"], number | null>> =
    ownBrand
      ? Object.fromEntries(scorePillars(ownBrand).map((p) => [p.key, p.score]))
      : {};
  const cxScore = ownBrand ? overallScore(ownBrand) : null;

  const navGroups = isViewer
    ? [
        {
          label: "Shared with you",
          items: [{ slug: "report", label: "Report", icon: FileText }],
        },
      ]
    : NAV_GROUPS;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="print:hidden">
        <SidebarHeader className="border-b border-sidebar-border px-2 py-3 group-data-[collapsible=icon]:px-1">
          <ProjectSwitcher project={project} />
        </SidebarHeader>
        <SidebarContent className="gap-5 px-2 py-4 group-data-[collapsible=icon]:px-1">
          {navGroups.map((group) => (
            <SidebarGroup key={group.label ?? "top"} className="p-0">
              {group.label ? (
                <SidebarGroupLabel className="h-auto px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden">
                  {group.label}
                </SidebarGroupLabel>
              ) : null}
              <SidebarGroupContent>
                <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
                  {group.items.map((item) => {
                    const href = `/projects/${projectId}/${item.slug}`;
                    const active = pathname === href;
                    const Icon = item.icon;
                    const pillarKey = SLUG_PILLAR[item.slug];
                    const score = pillarKey
                      ? (pillarScores[pillarKey] ?? null)
                      : undefined;
                    return (
                      <SidebarMenuItem
                        key={item.slug}
                        className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center"
                      >
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={item.label}
                          className="h-9 rounded-md px-3 font-normal text-sidebar-foreground/70 hover:text-sidebar-foreground data-[active=true]:font-medium data-[active=true]:text-sidebar-foreground [&_svg]:size-4 [&_svg]:text-sidebar-foreground/45 data-[active=true]:[&_svg]:text-primary group-data-[collapsible=icon]:justify-center"
                          render={<Link href={href} />}
                        >
                          <Icon />
                          <span className="group-data-[collapsible=icon]:hidden">
                            {item.label}
                          </span>
                          {item.slug === "overview" && cxScore !== null ? (
                            <span className="ms-auto font-heading text-xs font-semibold tabular-nums group-data-[collapsible=icon]:hidden">
                              <span className={tierTextClass(cxScore)}>
                                {cxScore}
                              </span>
                              <span className="font-normal text-sidebar-foreground/35">
                                /100
                              </span>
                            </span>
                          ) : null}
                          {score !== undefined ? (
                            <span
                              className={cn(
                                "ms-auto font-heading text-xs font-semibold tabular-nums group-data-[collapsible=icon]:hidden",
                                score === null
                                  ? "font-normal text-sidebar-foreground/30"
                                  : tierTextClass(score)
                              )}
                            >
                              {score ?? "N/A"}
                            </span>
                          ) : null}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border px-2 py-2.5 group-data-[collapsible=icon]:px-1">
          <NavUser />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 print:block print:min-h-0">
        <header className="sticky top-(--alpha-banner-height) z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur print:hidden">
          <SidebarTrigger className="text-muted-foreground" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:block">
                <BreadcrumbLink
                  render={<Link href={`/projects/${projectId}/overview`} />}
                >
                  Projects
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink
                  render={<Link href={`/projects/${projectId}/overview`} />}
                >
                  {project.name}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-heading font-medium">
                  {PAGE_TITLES[currentSlug] ?? project.name}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ms-auto flex items-center gap-2">
            {currentSlug !== "report" ? (
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href={`/projects/${projectId}/report`} />}
              >
                <FileText data-icon="inline-start" />
                Report
              </Button>
            ) : null}
          </div>
        </header>
        <div className="flex-1 p-4 md:p-6 print:p-0">
          <Suspense fallback={null}>
            <VerifyEmailBanner />
          </Suspense>
          <Suspense fallback={null}>
            <VerifyEmailPrompt />
          </Suspense>
          <Suspense fallback={null}>
            <AnalysisFailedBanner />
          </Suspense>
          {project.status === "archived" ? (
            <ArchivedBanner project={project} />
          ) : null}
          {children(project)}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
