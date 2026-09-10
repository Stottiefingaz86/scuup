"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { ScuupMark } from "@/components/scuup-mark";
import { unlockSite } from "./actions";

function GateForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [state, action, pending] = useActionState(unlockSite, null);
  const [pin, setPin] = useState("");

  return (
    <form action={action} className="flex w-full max-w-xs flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <input
        id="pin"
        name="pin"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        autoFocus
        required
        maxLength={4}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        placeholder="••••"
        aria-label="4-digit PIN"
        className="h-12 rounded-lg border border-border bg-card px-3 text-center font-mono text-xl tracking-[0.6em] outline-none ring-brand/40 focus:ring-2"
      />
      {state?.error ? (
        <p className="text-center text-sm text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || pin.length < 4}
        className="flex h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          "Enter"
        )}
      </button>
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
      <div className="relative flex w-full max-w-xs flex-col items-center gap-8">
        <ScuupMark size="lg" />
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-10 items-center justify-center rounded-full border border-border bg-card/60 text-muted-foreground">
            <Lock className="size-4" aria-hidden />
          </span>
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-medium tracking-tight">
            Scuup
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter the 4-digit PIN to continue.
          </p>
        </div>
        <Suspense fallback={null}>
          <GateForm />
        </Suspense>
      </div>
    </main>
  );
}
