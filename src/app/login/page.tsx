"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { LandingShell } from "@/components/landing/landing-shell";
import { ScuupLogo } from "@/components/scuup-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { appOriginClient, authCallbackUrl } from "@/lib/app-url";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { track } from "@/lib/track";

type Mode = "signin" | "signup";

function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  required = false,
  hint,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
        {required ? (
          <>
            <span className="text-brand" aria-hidden="true">
              {" "}
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border/80 bg-background/70 px-3 py-2.5 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/45 focus:border-primary/45 focus:ring-2 focus:ring-primary/15"
      />
      {hint ? (
        <p className="text-xs text-muted-foreground/80">{hint}</p>
      ) : null}
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required = false,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  required?: boolean;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
        {required ? (
          <>
            <span className="text-brand" aria-hidden="true">
              {" "}
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          required={required}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border/80 bg-background/70 py-2.5 pe-10 ps-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/45 focus:border-primary/45 focus:ring-2 focus:ring-primary/15"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </button>
      </div>
      {hint ? (
        <p className="text-xs text-muted-foreground/80">{hint}</p>
      ) : null}
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/dashboard";
  const authError = search.get("error");
  const modeParam = search.get("mode");

  const [mode, setMode] = useState<Mode>(
    modeParam === "signup" ? "signup" : "signin"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendVerificationEmail(): Promise<void> {
    try {
      await fetch("/api/auth/verification", { method: "POST" });
    } catch {
      // Non-blocking, user can resend from the dashboard banner.
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: authCallbackUrl(appOriginClient(), next),
            data: { company, phone },
          },
        });
        if (signUpError) {
          const exists = signUpError.message
            .toLowerCase()
            .includes("already registered");
          if (exists) {
            throw new Error(
              "That email already has an account, log in instead."
            );
          }
          throw signUpError;
        }
        if (!data.session) {
          throw new Error(
            "Account created, check your email to confirm, then log in."
          );
        }
        track("signup_completed", { company: company || null });
        await sendVerificationEmail();
        router.push(next);
        router.refresh();
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      track("logged_in");
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-border/80 bg-card/50 shadow-[0_24px_80px_-36px_rgba(0,0,0,0.75)] backdrop-blur-sm">
      <CardHeader className="gap-2 pb-2">
        <CardTitle className="font-heading text-xl">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </CardTitle>
        <CardDescription>
          {mode === "signin"
            ? "Log in to see your audits and reports."
            : "Free accounts include one full audit report."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-muted/25 p-1 ring-1 ring-border/60">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cn(
                "rounded-full px-3 py-2 text-sm transition-colors",
                mode === m
                  ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "signin" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field
            id="email"
            label="Work email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />
          {mode === "signup" ? (
            <>
              <Field
                id="company"
                label="Company"
                type="text"
                value={company}
                onChange={setCompany}
                autoComplete="organization"
                required
              />
              <Field
                id="phone"
                label="Mobile number"
                type="tel"
                value={phone}
                onChange={setPhone}
                autoComplete="tel"
                required
              />
            </>
          ) : null}
          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            required
            hint={mode === "signup" ? "At least 8 characters." : undefined}
          />
          {error || authError ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/20">
              {error ?? authError}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={busy}
            className={cn("mt-1", mode === "signup" && "glow-primary")}
          >
            {busy ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : null}
            {mode === "signin" ? "Log in" : "Create account"}
          </Button>
        </form>

        {mode === "signup" ? (
          <p className="text-center text-xs text-muted-foreground/80">
            <span className="text-brand">*</span> Required fields
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <LandingShell>
      <div className="landing-hero-glow landing-bg-dots relative flex min-h-screen flex-col overflow-hidden">
        <div aria-hidden className="landing-grain-texture absolute inset-0" />

        <header className="relative z-[2] px-6 py-5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to home
          </Link>
        </header>

        <div className="relative z-[2] flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-16 pt-4">
          <ScuupLogo />
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </LandingShell>
  );
}
