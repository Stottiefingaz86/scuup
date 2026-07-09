"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { appHomePath } from "@/lib/app-home";
import { useProjects } from "@/lib/project-store";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useAuthUser } from "@/lib/use-auth-user";

export function LandingHeaderActions() {
  const router = useRouter();
  const { user, loading, name, email, initials } = useAuthUser();
  const projects = useProjects();

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.refresh();
  }

  if (loading) {
    return <Skeleton className="h-9 w-28" />;
  }

  if (!user || !email) {
    return (
      <>
        <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>
          Log in
        </Button>
        <Button nativeButton={false} render={<Link href="/projects/new" />}>
          Start audit
        </Button>
      </>
    );
  }

  const accountHref =
    projects === undefined ? "/dashboard" : appHomePath(projects);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-[10px] font-semibold text-primary">
              {initials ?? "?"}
            </span>
            <span className="hidden max-w-[140px] truncate sm:inline">
              {name ?? email}
            </span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{name ?? "Account"}</span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={accountHref} />}>
          <LayoutDashboard />
          My account
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/projects/new" />}>
          <UserRound />
          New audit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
