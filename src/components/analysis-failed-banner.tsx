"use client";

import { useSearchParams } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AnalysisFailedBanner() {
  const params = useSearchParams();
  if (params.get("analysis_failed") !== "1") return null;
  return (
    <Alert variant="destructive" className="mb-6">
      <CircleAlert />
      <AlertTitle>Analysis didn&apos;t complete</AlertTitle>
      <AlertDescription>
        Every journey visit failed — usually a Browserbase session limit or
        connectivity issue. Fix the underlying problem, then run analysis
        again from Journeys.
      </AlertDescription>
    </Alert>
  );
}
