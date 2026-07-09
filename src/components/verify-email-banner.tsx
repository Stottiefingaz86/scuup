"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Shown on dashboard when the user can browse but hasn't verified email yet. */
export function VerifyEmailBanner() {
  const search = useSearchParams();
  const justVerified = search.get("verified") === "1";

  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(justVerified);
  const [email, setEmail] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/auth/verification");
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { emailVerified: boolean; email: string };
    setVerified(data.emailVerified || justVerified);
    setEmail(data.email);
    setLoading(false);
  }, [justVerified]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function resend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verification", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send email.");
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send email.");
    } finally {
      setSending(false);
    }
  }

  if (loading || verified) return null;

  return (
    <Alert className="mb-8">
      <Mail />
      <AlertTitle>Verify your email to run analysis</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>
          You can set up projects now. When you&apos;re ready to run an audit,
          confirm your inbox{email ? ` (${email})` : ""} — we&apos;ll send a
          one-click link.
        </p>
        {sent ? (
          <p className="text-sm">Link sent. Check your inbox (and spam).</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={sending} onClick={resend}>
            {sending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
            Send verification link
          </Button>
          <Button size="sm" variant="ghost" onClick={() => refresh()}>
            I&apos;ve verified
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/** Client-side gate before starting browser agents. */
export async function ensureEmailVerified(): Promise<boolean> {
  const res = await fetch("/api/auth/verification");
  if (!res.ok) return false;
  const data = (await res.json()) as { emailVerified: boolean };
  return data.emailVerified;
}

export function redirectToVerifyDashboard(router: { push: (path: string) => void }) {
  router.push("/dashboard?verify=1");
}