"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { AccountMenuContent } from "@/components/account-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthUser } from "@/lib/use-auth-user";

export function LandingHeaderActions() {
  const { user, loading, name, email, initials } = useAuthUser();

  if (loading) {
    return <Skeleton className="h-9 w-28" />;
  }

  if (!user || !email) {
    return (
      <>
        <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>
          Log in
        </Button>
        <Button nativeButton={false} render={<Link href="/login?mode=signup" />}>
          Start
          <ArrowRight data-icon="inline-end" />
        </Button>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="h-9 gap-2 rounded-full ps-1.5 pe-2.5"
            aria-label="Open account menu"
          />
        }
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold leading-none text-primary">
          {initials ?? "?"}
        </span>
        <span className="max-w-[120px] truncate text-sm font-medium sm:max-w-[140px]">
          {name ?? email.split("@")[0]}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground/70" />
      </DropdownMenuTrigger>
      <AccountMenuContent
        name={name}
        email={email}
        initials={initials}
        align="end"
      />
    </DropdownMenu>
  );
}
