"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { appHomePath } from "@/lib/app-home";
import { useProjects } from "@/lib/project-store";

function DashboardRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projects = useProjects();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 4000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (projects === undefined) return;
    const search = searchParams.toString();
    router.replace(appHomePath(projects, search || undefined));
  }, [projects, router, searchParams]);

  if (slow && projects === undefined) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          Taking longer than expected to load your workspace.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button nativeButton={false} render={<Link href="/account" />}>
            My account
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/projects/new" />}
          >
            Start new audit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-4 w-48" />
    </div>
  );
}

/** Legacy entry, immediately forwards to the user's project overview. */
export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Skeleton className="h-8 w-32" />
        </div>
      }
    >
      <DashboardRedirect />
    </Suspense>
  );
}
