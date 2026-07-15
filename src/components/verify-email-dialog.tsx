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

/** Email confirmation without leaving the page: we email a 6-digit code,
 * the user types it here, and the report runs immediately. */
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
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentOnOpenRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const sendCode = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verification", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send the code.");
      setSent(true);
      inputRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the code.");
    } finally {
      setSending(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      sentOnOpenRef.current = false;
      setCode("");
      setError(null);
      setSent(false);
      return;
    }
    void fetch("/api/auth/verification")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { email?: string; emailVerified?: boolean } | null) => {
        if (data?.email) setEmail(data.email);
        // Already verified (e.g. confirmed in another tab), carry on.
        if (data?.emailVerified) {
          onOpenChange(false);
          onVerified?.();
        }
      });
    if (!sentOnOpenRef.current) {
      sentOnOpenRef.current = true;
      void sendCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sendCode]);

  async function verify() {
    if (code.replace(/\D/g, "").length < 4) {
      setError("Enter the code from the email.");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.replace(/\D/g, "") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed.");
      onOpenChange(false);
      onVerified?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-5 text-primary" />
            Enter your confirmation code
          </DialogTitle>
          <DialogDescription>
            We&apos;ve emailed a 6-digit code
            {email ? (
              <>
                {" "}
                to <span className="font-medium text-foreground">{email}</span>
              </>
            ) : null}
            . Type it below, no need to leave this page.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ""))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={12}
            className="w-full rounded-lg border border-input bg-transparent px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-primary"
          />
          <div className="flex min-h-5 flex-col gap-1 text-sm">
            {error ? <p className="text-destructive">{error}</p> : null}
            {!error && sent ? (
              <p className="text-muted-foreground">
                Code sent, check your inbox and spam folder.
              </p>
            ) : null}
            {!error && !sent && sending ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Sending code…
              </p>
            ) : null}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="submit" className="w-full" disabled={verifying}>
              {verifying ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : null}
              Confirm & run the report
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={sending}
              onClick={sendCode}
            >
              {sending ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : null}
              Resend code
            </Button>
          </DialogFooter>
        </form>
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
