"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  CircleAlert,
  CircleCheck,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  LogIn,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/brand-mark";
import { ProjectShell } from "@/components/project-shell";
import type { Brand, Project } from "@/lib/types";

interface CredentialStatus {
  brandId: string;
  email: string | null;
  username: string | null;
  hasPassword: boolean;
  notes: string | null;
  hasContext: boolean;
  loggedInAt: string | null;
}

interface LoginState {
  status: "none" | "starting" | "running" | "success" | "failed";
  liveViewUrl: string | null;
  steps: string[];
  error: string | null;
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function BrandAccountCard({
  brand,
  projectId,
  market,
}: {
  brand: Brand;
  projectId: string;
  market: string;
}) {
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [login, setLogin] = useState<LoginState>({
    status: "none",
    liveViewUrl: null,
    steps: [],
    error: null,
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/brands/${brand.id}/credentials`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "failed to load");
        if (!cancelled) {
          setStatus(data as CredentialStatus);
          setEmail((data as CredentialStatus).email ?? "");
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [brand.id]);

  const save = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/brands/${brand.id}/credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          // Only send the password when the user typed a new one.
          ...(password ? { password } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save failed");
      setStatus(data as CredentialStatus);
      setPassword("");
      setSaved(true);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }, [brand.id, email, password]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startAgentLogin = useCallback(async () => {
    setLogin({ status: "starting", liveViewUrl: null, steps: [], error: null });
    try {
      const res = await fetch(`/api/brands/${brand.id}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: brand.url, market }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "login failed to start");
      setLogin((s) => ({ ...s, status: "running", liveViewUrl: data.liveViewUrl }));

      stopPolling();
      pollRef.current = setInterval(async () => {
        const poll = await fetch(`/api/brands/${brand.id}/login`);
        const job = await poll.json();
        setLogin({
          status: job.status === "none" ? "failed" : job.status,
          liveViewUrl: job.liveViewUrl ?? null,
          steps: job.steps ?? [],
          error: job.error ?? null,
        });
        if (job.status === "success" || job.status === "failed") {
          stopPolling();
          if (job.status === "success") {
            const refreshed = await fetch(`/api/brands/${brand.id}/credentials`);
            if (refreshed.ok) setStatus(await refreshed.json());
          }
        }
      }, 4000);
    } catch (e) {
      setLogin({
        status: "failed",
        liveViewUrl: null,
        steps: [],
        error: e instanceof Error ? e.message : "login failed",
      });
    }
  }, [brand.id, brand.url, market, stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  const launchUrl = `/capture?projectId=${projectId}&brandId=${brand.id}&name=${encodeURIComponent(brand.name)}&url=${encodeURIComponent(brand.url)}&market=${encodeURIComponent(market)}`;
  const loginBusy = login.status === "starting" || login.status === "running";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BrandMark brand={brand} className="size-4" />
            {brand.name}
            {brand.role === "own_brand" ? " (you)" : ""}
          </CardTitle>
          {status?.loggedInAt ? (
            <Badge className="gap-1">
              <ShieldCheck className="size-3" />
              Logged in {timeAgo(status.loggedInAt)}
            </Badge>
          ) : status?.hasContext ? (
            <Badge variant="secondary">Context saved</Badge>
          ) : (
            <Badge variant="outline">No session</Badge>
          )}
        </div>
        <CardDescription>
          {status?.loggedInAt
            ? "Agents reuse this saved login for gated journeys — progress, personalisation, cashier, account."
            : "Store a test account and log the agent in once — the session persists for every future run."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loadError ? (
          <p className="flex items-start gap-1.5 rounded-lg border border-score-weak/30 bg-score-weak/[0.05] px-3 py-2 text-xs text-muted-foreground">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-score-weak" />
            {loadError}
          </p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Email or username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
          <Input
            type="password"
            placeholder={status?.hasPassword ? "Password saved — type to replace" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <KeyRound data-icon="inline-start" />
            )}
            Save credentials
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={startAgentLogin}
            disabled={loginBusy || !status?.hasPassword}
          >
            {loginBusy ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <LogIn data-icon="inline-start" />
            )}
            {loginBusy ? "Logging in…" : "Log in with agent"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={<a href={launchUrl} target="_blank" rel="noreferrer" />}
          >
            <UserPlus data-icon="inline-start" />
            Sign up / log in manually
          </Button>
          {saved ? (
            <span className="flex items-center gap-1 text-xs text-score-strong">
              <CircleCheck className="size-3.5" /> Saved
            </span>
          ) : null}
        </div>

        {login.status !== "none" ? (
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm">
              {loginBusy ? (
                <LoaderCircle className="size-4 animate-spin text-brand" />
              ) : login.status === "success" ? (
                <CircleCheck className="size-4 text-score-strong" />
              ) : (
                <CircleAlert className="size-4 text-score-weak" />
              )}
              <span className="font-medium">
                {login.status === "success"
                  ? "Agent logged in — session saved"
                  : login.status === "failed"
                    ? "Login failed"
                    : "Agent logging in…"}
              </span>
              {login.liveViewUrl ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="ms-auto h-6 gap-1 px-2 text-xs"
                  nativeButton={false}
                  render={
                    <a href={login.liveViewUrl} target="_blank" rel="noreferrer" />
                  }
                >
                  <ExternalLink className="size-3" />
                  Watch / rescue
                </Button>
              ) : null}
            </div>
            {login.steps.length > 0 ? (
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {login.steps.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            ) : null}
            {login.error ? (
              <p className="text-xs leading-relaxed text-score-weak">
                {login.error}
              </p>
            ) : null}
            {loginBusy ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                If a captcha or 2FA prompt appears, open the live view and solve
                it — the agent waits and picks up once you&apos;re through.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AccountsContent({ project }: { project: Project }) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-brand" />
            Test accounts &amp; logged-in sessions
          </CardTitle>
          <CardDescription>
            Login-gated mechanics — progress meters, personalisation, account
            integration, cashier — can only be scored from an authenticated
            session. Save a test account per brand and log the agent in once;
            the browser session persists so every future agent run starts
            logged in. Passwords are encrypted at rest and never leave the
            server.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {project.brands.map((brand) => (
          <BrandAccountCard
            key={brand.id}
            brand={brand}
            projectId={project.id}
            market={project.market}
          />
        ))}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Don&apos;t have an account yet? Use &ldquo;Sign up / log in
        manually&rdquo; — it opens a live browser attached to the brand&apos;s
        persistent session. Complete signup (email verification, KYC) yourself,
        then save the credentials here. Automated account creation on
        real-money gambling sites is unreliable and usually against terms.
      </p>
    </div>
  );
}

export default function AccountsPage() {
  const params = useParams<{ id: string }>();
  return (
    <ProjectShell projectId={params.id}>
      {(project) => <AccountsContent project={project} />}
    </ProjectShell>
  );
}
