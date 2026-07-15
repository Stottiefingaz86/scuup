"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { VerifyEmailDialog } from "@/components/verify-email-dialog";

/** Shown on dashboard when the user can browse but hasn't verified email yet. */
export function VerifyEmailBanner() {
  const search = useSearchParams();
  const justVerified = search.get("verified") === "1";

  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(justVerified);
  const [email, setEmail] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  if (loading || verified) return null;

  return (
    <>
      <Alert className="mb-8">
        <Mail />
        <AlertTitle>Verify your email to run analysis</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <p>
            You can set up projects now. When you&apos;re ready to run an
            audit, we&apos;ll email a 6-digit code
            {email ? ` to ${email}` : ""}, enter it here and you&apos;re done.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              Verify now
            </Button>
          </div>
        </AlertDescription>
      </Alert>
      <VerifyEmailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onVerified={() => setVerified(true)}
      />
    </>
  );
}

/** Client-side gate before starting browser agents. */
export async function ensureEmailVerified(): Promise<boolean> {
  const res = await fetch("/api/auth/verification");
  if (!res.ok) return false;
  const data = (await res.json()) as { emailVerified: boolean };
  return data.emailVerified;
}

export function redirectToVerifyHome(
  router: { push: (path: string) => void },
  projectId: string
) {
  router.push(`/projects/${projectId}/overview?verify=1`);
}
