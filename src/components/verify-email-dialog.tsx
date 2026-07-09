"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function VerifyEmailDialog({
  open,
  onOpenChange,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified?: () => void;
}) {
  const [email, setEmail] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentOnOpenRef = useRef(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/auth/verification");
    if (!res.ok) return false;
    const data = (await res.json()) as { emailVerified: boolean; email: string };
    setEmail(data.email);
    return data.emailVerified;
  }, []);

  const sendLink = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (!open) {
      sentOnOpenRef.current = false;
      return;
    }
    void refresh();
    if (!sentOnOpenRef.current) {
      sentOnOpenRef.current = true;
      void sendLink();
    }
  }, [open, refresh, sendLink]);

  async function checkVerified() {
    setChecking(true);
    setError(null);
    try {
      const verified = await refresh();
      if (verified) {
        onOpenChange(false);
        onVerified?.();
        return;
      }
      setError("Not verified yet — click the link in your email, then try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-5 text-primary" />
            Confirm your email
          </DialogTitle>
          <DialogDescription>
            We&apos;ve sent a confirmation link
            {email ? (
              <>
                {" "}
                to <span className="font-medium text-foreground">{email}</span>
              </>
            ) : null}
            . Click it to verify your inbox, then come back here to run the
            report.
          </DialogDescription>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            {sent ? (
              <p className="text-foreground/80">
                Link sent — check your inbox and spam folder.
              </p>
            ) : sending ? (
              <p className="flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" />
                Sending link…
              </p>
            ) : null}
            {error ? <p className="text-destructive">{error}</p> : null}
          </div>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            disabled={checking}
            onClick={checkVerified}
          >
            {checking ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : null}
            I&apos;ve confirmed — run the report
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={sending}
            onClick={sendLink}
          >
            {sending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : null}
            Resend link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Opens the verify dialog when redirected with ?verify=1 */
export function VerifyEmailPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verify") !== "1") return;
    void fetch("/api/auth/verification")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { emailVerified?: boolean } | null) => {
        if (data && !data.emailVerified) setOpen(true);
      });
  }, []);

  return <VerifyEmailDialog open={open} onOpenChange={setOpen} />;
}
