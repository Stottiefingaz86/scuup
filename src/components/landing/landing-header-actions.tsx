"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { AccountMenuContent } from "@/components/account-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useAuthUser } from "@/lib/use-auth-user";

export function LandingHeaderActions() {
  const router = useRouter();
  const { user, loading, name, email, initials } = useAuthUser();

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/");
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

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              aria-label="Open account menu"
            />
          }
        >
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-[10px] font-semibold text-primary">
            {initials ?? "?"}
          </span>
          <span className="max-w-[120px] truncate sm:max-w-[140px]">
            {name ?? email.split("@")[0]}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <AccountMenuContent
          name={name}
          email={email}
          initials={initials}
          align="end"
        />
      </DropdownMenu>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={signOut}
      >
        <LogOut className="size-4 sm:hidden" />
        <span className="hidden sm:inline">Log out</span>
      </Button>
    </div>
  );
}
