"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { appHomePath } from "@/lib/app-home";
import { useProjects } from "@/lib/project-store";

function DashboardRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projects = useProjects();

  useEffect(() => {
    if (projects === undefined) return;
    const search = searchParams.toString();
    router.replace(appHomePath(projects, search || undefined));
  }, [projects, router, searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-4 w-48" />
    </div>
  );
}

/** Legacy entry — immediately forwards to the user's project overview. */
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
