"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { unlockResearch } from "./actions";

function PinForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [state, action, pending] = useActionState(unlockResearch, null);
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
        className="h-12 rounded-lg border border-[var(--rs-border)] bg-[var(--rs-card)] px-3 text-center font-mono text-xl tracking-[0.6em] text-[var(--rs-fg)] outline-none transition-colors focus:border-[var(--rs-accent)]"
      />
      {state?.error ? (
        <p className="text-center text-sm text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || pin.length < 4}
        className="flex h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-[var(--rs-accent)] text-sm font-medium text-[var(--rs-bg)] disabled:opacity-50"
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

export default function ResearchPinPage() {
  return (
    <main className="flex min-h-[70vh] flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-xs flex-col items-center gap-6">
        <span className="flex size-10 items-center justify-center rounded-full border border-[var(--rs-border)] bg-[var(--rs-card)] text-[var(--rs-muted)]">
          <Lock className="size-4" aria-hidden />
        </span>
        <div className="text-center">
          <h1 className="font-heading text-xl font-medium tracking-tight text-[var(--rs-fg)]">
            Research
          </h1>
          <p className="mt-1 text-sm text-[var(--rs-muted)]">
            Enter the 4-digit PIN to continue.
          </p>
        </div>
        <Suspense fallback={null}>
          <PinForm />
        </Suspense>
      </div>
    </main>
  );
}
