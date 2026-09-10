"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderKanban, LogOut, Plus } from "lucide-react";
import { ScuupIcon } from "@/components/scuup-mark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { displayNameForUser, useAuthUser } from "@/lib/use-auth-user";
import { supabaseBrowser } from "@/lib/supabase-browser";

function labelForResearchUser(
  name: string | null,
  email: string | null
): string {
  const n = name?.trim() ?? "";
  if (n && !/^scuup$/i.test(n)) return n;
  const local = email?.split("@")[0]?.trim();
  if (local) return local;
  return "You";
}

export function ResearchAccountMenu() {
  const router = useRouter();
  const { user, loading, name, email } = useAuthUser();

  if (loading) {
    return <Skeleton className="size-8 rounded-full" />;
  }

  if (!user || !email) {
    return (
      <Link
        href="/login?next=/research"
        className="inline-flex h-8 items-center rounded-lg border border-[var(--rs-border)] px-3 text-xs text-[var(--rs-muted)] hover:text-[var(--rs-fg)]"
      >
        Sign in
      </Link>
    );
  }

  const label = labelForResearchUser(
    name ?? (user ? displayNameForUser(user) : null),
    email
  );

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/research");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-full border border-[var(--rs-border)] bg-zinc-900 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Account"
          />
        }
      >
        <ScuupIcon className="size-[15px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2.5 px-1 py-1.5 text-left text-sm">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--rs-border)] bg-zinc-900">
                <ScuupIcon className="size-[15px]" />
              </span>
              <div className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate font-medium">{label}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => router.push("/research/projects/new")}
          >
            <Plus />
            New research
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/research/projects")}>
            <FolderKanban />
            Projects
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void signOut()}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
