"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, Sparkles } from "lucide-react";
import { LandingShell } from "@/components/landing/landing-shell";
import { ScuupMark } from "@/components/landing/scuup-mark";
import { AccountQuickLinks } from "@/components/account-menu";
import { ManageBillingButton } from "@/components/upgrade-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useAuthUser } from "@/lib/use-auth-user";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  pro_plus: "Pro Plus",
};

export default function AccountPage() {
  const router = useRouter();
  const { user, loading, name, email, initials } = useAuthUser();
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?next=/account");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/account/plan")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.plan) setPlan(d.plan);
      })
      .catch(() => {});
  }, [user]);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <LandingShell>
        <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-6 py-16">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-48 w-full" />
        </div>
      </LandingShell>
    );
  }

  if (!user || !email) {
    return (
      <LandingShell>
        <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-6 py-16">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-48 w-full" />
        </div>
      </LandingShell>
    );
  }

  return (
    <LandingShell>
      <header className="border-b border-border px-6 py-4">
        <ScuupMark />
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            My account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your audits, plan, and sign-in.
          </p>
        </div>

        <Card id="billing">
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                {initials ?? "?"}
              </span>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base">{name ?? "Account"}</CardTitle>
                <CardDescription className="truncate">{email}</CardDescription>
              </div>
              <Badge variant="secondary">
                {plan ? (PLAN_LABELS[plan] ?? plan) : "…"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <AccountQuickLinks />
            {plan === "free" ? (
              <Button
                className="w-full"
                nativeButton={false}
                render={<Link href="/?plan=pro#contact" />}
              >
                <Sparkles data-icon="inline-start" />
                Contact sales
              </Button>
            ) : plan ? (
              <ManageBillingButton className="w-full" />
            ) : null}
            <Button variant="outline" className="w-full" onClick={signOut}>
              <LogOut data-icon="inline-start" />
              Log out
            </Button>
          </CardContent>
        </Card>
      </main>
    </LandingShell>
  );
}
