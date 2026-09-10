"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Bell, FolderKanban, LockKeyhole, Plus } from "lucide-react";
import { ResearchAccountMenu } from "@/components/research-account-menu";
import { ResearchNotificationsPanel } from "@/components/research-notifications-panel";
import { ScuupIcon, ScuupMark } from "@/components/scuup-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { usePendingResearchActions } from "@/lib/research/use-pending-actions";

function useResearchProjectId(): string | null {
  const pathname = usePathname();
  const match = pathname?.match(/^\/research\/projects\/([^/]+)/);
  if (!match || match[1] === "new") return null;
  return match[1];
}

function NotificationsNavItem() {
  const [open, setOpen] = useState(false);
  // New BTC address / SMS request → chime + browser notification + open panel.
  const count = usePendingResearchActions({
    onNewAction: () => setOpen(true),
  });

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Notifications"
          onClick={() => {
            if (
              typeof Notification !== "undefined" &&
              Notification.permission === "default"
            ) {
              void Notification.requestPermission();
            }
            setOpen(true);
          }}
          className="h-10 rounded-md px-3 font-normal"
        >
          <Bell />
          <span className="group-data-[collapsible=icon]:hidden">
            Notifications
          </span>
          {count > 0 ? (
            <SidebarMenuBadge className="bg-[var(--rs-accent)] text-[var(--rs-bg)]">
              {count > 9 ? "9+" : count}
            </SidebarMenuBadge>
          ) : null}
        </SidebarMenuButton>
      </SidebarMenuItem>
      <ResearchNotificationsPanel open={open} onOpenChange={setOpen} />
    </>
  );
}

function ResearchSidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = useResearchProjectId();
  const tab = searchParams.get("tab");
  const onProjects =
    pathname === "/research/projects" || pathname === "/research/projects/";
  const onNew = pathname?.startsWith("/research/projects/new");
  const onTestAccounts = Boolean(projectId) && tab === "persona";

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3.5 group-data-[collapsible=icon]:px-1">
        <Link
          href="/research"
          className="flex items-center rounded-md px-1 py-1 group-data-[collapsible=icon]:justify-center"
          aria-label="Research home"
        >
          <ScuupMark className="h-7 w-auto group-data-[collapsible=icon]:hidden" />
          <ScuupIcon className="hidden size-[18px] group-data-[collapsible=icon]:block" />
        </Link>
      </SidebarHeader>

      <SidebarContent className="flex flex-col px-2 py-5 group-data-[collapsible=icon]:px-1">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-2.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={Boolean(onNew)}
                  tooltip="New project"
                  className="h-10 rounded-md px-3 font-normal"
                  render={<Link href="/research/projects/new" />}
                >
                  <Plus />
                  <span className="group-data-[collapsible=icon]:hidden">
                    New project
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={onProjects && !projectId}
                  tooltip="Projects"
                  className="h-10 rounded-md px-3 font-normal"
                  render={<Link href="/research/projects" />}
                >
                  <FolderKanban />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Projects
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <NotificationsNavItem />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {projectId ? (
          <SidebarGroup className="mt-auto p-0 pt-6">
            <SidebarGroupContent>
              <SidebarMenu className="gap-2.5">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={onTestAccounts}
                    tooltip="Test accounts"
                    className="h-10 rounded-md px-3 font-normal"
                    onClick={() =>
                      router.replace(
                        `/research/projects/${projectId}?tab=persona`,
                      )
                    }
                  >
                    <LockKeyhole />
                    <span className="group-data-[collapsible=icon]:hidden">
                      Test accounts
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
    </>
  );
}

export function ResearchShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // PIN screen: no sidebar / account menu (they'd 401 before the cookie is set).
  const immersive =
    pathname?.startsWith("/research/projects/new") ||
    pathname === "/research/pin" ||
    pathname === "/pin";

  if (immersive) {
    return (
      <div className="research-root flex min-h-full flex-1 flex-col bg-[var(--rs-bg)] text-[var(--rs-fg)]">
        {children}
      </div>
    );
  }

  return (
    <div className="research-root flex min-h-full flex-1 flex-col bg-[var(--rs-bg)] text-[var(--rs-fg)]">
      <SidebarProvider defaultOpen={false}>
        <Sidebar collapsible="icon">
          <Suspense
            fallback={
              <SidebarHeader className="p-3">
                <Skeleton className="h-7 w-28" />
              </SidebarHeader>
            }
          >
            <ResearchSidebarNav />
          </Suspense>
          <SidebarRail />
        </Sidebar>
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--rs-border)] bg-[var(--rs-bg)]/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-[var(--rs-bg)]/75">
            <SidebarTrigger className="-ms-1" />
            <div className="min-w-0 flex-1" />
            <ResearchAccountMenu />
          </header>
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
