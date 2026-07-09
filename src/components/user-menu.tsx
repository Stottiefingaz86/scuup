"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useAuthUser } from "@/lib/use-auth-user";

/** Signed-in account indicator with sign-out, for app headers. */
export function UserMenu() {
  const router = useRouter();
  const { user, loading, email, name } = useAuthUser();

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading || !user || !email) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {name ?? email}
      </span>
      <Button variant="ghost" size="sm" onClick={signOut} title="Sign out">
        <LogOut data-icon="inline-start" />
        Sign out
      </Button>
    </div>
  );
}
