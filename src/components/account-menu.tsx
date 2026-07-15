"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
} from "lucide-react";
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAppHomeHref } from "@/lib/use-app-home-href";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function AccountMenuContent({
  name,
  email,
  initials,
  align = "end",
  onNavigate,
}: {
  name: string | null;
  email: string;
  initials: string | null;
  align?: "start" | "center" | "end";
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const dashboardHref = useAppHomeHref();

  async function signOut() {
    onNavigate?.();
    await supabaseBrowser().auth.signOut();
    router.push("/");
    router.refresh();
  }

  function go(href: string) {
    onNavigate?.();
    router.push(href);
  }

  return (
    <DropdownMenuContent align={align} className="w-56">
      {/* Base UI requires GroupLabel to live inside a Group, a bare label
       * throws MenuGroupContext-missing and crashes the whole page. */}
      <DropdownMenuGroup>
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
              {initials ?? "?"}
            </span>
            <div className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate font-medium">{name ?? "Account"}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem onClick={() => go("/projects/new")}>
          <Plus />
          Start new audit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go(dashboardHref)}>
          <LayoutDashboard />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("/account")}>
          <Settings />
          My account
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("/account#billing")}>
          <CreditCard />
          Billing & plan
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onClick={signOut}>
        <LogOut />
        Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

/** Inline links for the account page (same destinations, no dropdown). */
export function AccountQuickLinks() {
  const dashboardHref = useAppHomeHref();

  return (
    <div className="flex flex-col gap-2">
      <Link
        href="/projects/new"
        className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted/50"
      >
        <Plus className="size-4 text-primary" />
        Start new audit
      </Link>
      <Link
        href={dashboardHref}
        className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted/50"
      >
        <LayoutDashboard className="size-4 text-primary" />
        Open dashboard
      </Link>
      <Link
        href="/upgrade"
        className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted/50"
      >
        <CreditCard className="size-4 text-primary" />
        Billing & plan
      </Link>
    </div>
  );
}
