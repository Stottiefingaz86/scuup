"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { ScuupMark } from "@/components/scuup-mark";
import { Button } from "@/components/ui/button";
import { unlockSite } from "./actions";

function GateForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [state, action, pending] = useActionState(unlockSite, null);

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-muted-foreground">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          className="h-11 rounded-lg border border-border bg-card px-3 text-base outline-none ring-brand/40 focus:ring-2"
        />
      </div>
      {state?.error ? (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          "Enter"
        )}
      </Button>
    </form>
  );
}

export default function GatePage() {
  return (
    <main className="relative flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,oklch(0.35_0.04_250/0.35),transparent_55%)]"
        aria-hidden
      />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-8">
        <ScuupMark size="lg" />
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-10 items-center justify-center rounded-full border border-border bg-card/60 text-muted-foreground">
            <Lock className="size-4" aria-hidden />
          </span>
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-medium tracking-tight">
            Private preview
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter the access password to continue.
          </p>
        </div>
        <Suspense fallback={null}>
          <GateForm />
        </Suspense>
      </div>
    </main>
  );
}
