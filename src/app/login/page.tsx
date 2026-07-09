"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { supabaseBrowser } from "@/lib/supabase-browser";

type Mode = "signin" | "signup";

function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
      />
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/dashboard";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function grantAccessThenSignIn(userId?: string): Promise<void> {
    const grant = await fetch("/api/auth/grant-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, userId }),
    });
    if (!grant.ok) {
      const body = await grant.json().catch(() => ({}));
      throw new Error(
        typeof body.error === "string" ? body.error : "Could not sign in."
      );
    }
    const supabase = supabaseBrowser();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) throw signInError;
  }

  async function sendVerificationEmail(): Promise<void> {
    try {
      await fetch("/api/auth/verification", { method: "POST" });
    } catch {
      // Non-blocking — user can resend from the dashboard banner.
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
            emailRedirectTo: `${window.location.origin}/auth/callback?verified=1&next=${encodeURIComponent(next)}`,
            data: { company, phone },
          },
        });
        if (signUpError) {
          const exists = signUpError.message
            .toLowerCase()
            .includes("already registered");
          if (!exists) throw signUpError;
          await grantAccessThenSignIn();
          await sendVerificationEmail();
          router.push(next);
          router.refresh();
          return;
        }

        if (data.session) {
          await sendVerificationEmail();
          router.push(next);
          router.refresh();
          return;
        }

        if (!data.user?.id) {
          throw new Error(
            "Account could not be created. Check your email or try logging in."
          );
        }

        await grantAccessThenSignIn(data.user.id);

        await sendVerificationEmail();
        router.push(next);
        router.refresh();
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        const needsGrant =
          signInError.message.toLowerCase().includes("not confirmed") ||
          signInError.message.toLowerCase().includes("email not confirmed");
        if (needsGrant) {
          await grantAccessThenSignIn();
          router.push(next);
          router.refresh();
          return;
        }
        throw signInError;
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </CardTitle>
        <CardDescription>
          {mode === "signin"
            ? "Log in to see your audits and reports."
            : "Free accounts include one full audit report."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                mode === m
                  ? "bg-background font-medium text-foreground shadow-sm"
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
              />
              <Field
                id="phone"
                label="Mobile number"
                type="tel"
                value={phone}
                onChange={setPhone}
                autoComplete="tel"
              />
            </>
          ) : null}
          <Field
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={busy} className="mt-1">
            {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
            {mode === "signin" ? "Log in" : "Create account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <ScuupLogo />
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
