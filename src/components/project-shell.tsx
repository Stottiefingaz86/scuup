"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import {
  ArrowLeft,
  Camera,
  Coins,
  FileText,
  Grid3x3,
  KeyRound,
  LayoutDashboard,
  Radio,
  Repeat,
  Route,
  Zap,
} from "lucide-react";
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
import { AnalysisFailedBanner } from "@/components/analysis-failed-banner";
import { useProject } from "@/lib/project-store";
import type { Project } from "@/lib/types";

const NAV_GROUPS = [
  {
    label: "Intelligence",
    items: [
      { slug: "overview", label: "Overview", icon: LayoutDashboard },
      { slug: "journeys", label: "Journeys", icon: Route },
      { slug: "features", label: "Features", icon: Grid3x3 },
      { slug: "retention", label: "Retention", icon: Repeat },
      { slug: "cashier", label: "Cashier Trust", icon: Coins },
      { slug: "sessions", label: "Live Sessions", icon: Radio },
      { slug: "accounts", label: "Accounts", icon: KeyRound },
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

const PAGE_TITLES: Record<string, string> = {
  overview: "Overview",
  journeys: "Journeys",
  features: "Feature Matrix",
  retention: "Retention Loop",
  cashier: "Cashier Trust",
  sessions: "Live Sessions",
  accounts: "Accounts",
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
  const project = useProject(projectId);
  const currentSlug = pathname.split("/").pop() ?? "overview";

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

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="print:hidden">
        <SidebarHeader className="border-b border-sidebar-border px-2 py-3 group-data-[collapsible=icon]:px-1">
          <ProjectSwitcher project={project} />
        </SidebarHeader>
        <SidebarContent className="gap-5 px-2 py-4 group-data-[collapsible=icon]:px-1">
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.label} className="p-0">
              <SidebarGroupLabel className="h-auto px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
                  {group.items.map((item) => {
                    const href = `/projects/${projectId}/${item.slug}`;
                    const active = pathname === href;
                    const Icon = item.icon;
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
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur print:hidden">
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
            <AnalysisFailedBanner />
          </Suspense>
          {children(project)}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
