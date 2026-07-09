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
import { DEFAULT_TEST_EMAIL, defaultTestEmailForBrand } from "@/lib/constants";
import type { Brand, Project } from "@/lib/types";

interface CredentialStatus {
  brandId: string;
  email: string | null;
  username: string | null;
  hasPassword: boolean;
  hasPersona: boolean;
  notes: string | null;
  hasContext: boolean;
  loggedInAt: string | null;
}

interface AgentJobState {
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
  const [login, setLogin] = useState<AgentJobState>({
    status: "none",
    liveViewUrl: null,
    steps: [],
    error: null,
  });
  const [signup, setSignup] = useState<AgentJobState>({
    status: "none",
    liveViewUrl: null,
    steps: [],
    error: null,
  });
  const [seeding, setSeeding] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/brands/${brand.id}/credentials`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "failed to load");
        if (!cancelled) {
          setStatus(data as CredentialStatus);
          const saved = (data as CredentialStatus).email;
          setEmail(
            saved ??
              (brand.role === "own_brand"
                ? DEFAULT_TEST_EMAIL
                : defaultTestEmailForBrand(brand.name))
          );
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

  const seedPersona = useCallback(async () => {
    setSeeding(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/brands/${brand.id}/credentials/seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market,
          brandName: brand.name,
          ownBrand: brand.role === "own_brand",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "seed failed");
      const refreshed = await fetch(`/api/brands/${brand.id}/credentials`);
      if (refreshed.ok) {
        const next = (await refreshed.json()) as CredentialStatus;
        setStatus(next);
        setEmail(next.email ?? email);
      }
      setSaved(true);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "seed failed");
    } finally {
      setSeeding(false);
    }
  }, [brand.id, brand.name, brand.role, market, email]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollJob = useCallback(
    (
      path: "/login" | "/signup",
      setJob: React.Dispatch<React.SetStateAction<AgentJobState>>
    ) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        const poll = await fetch(`/api/brands/${brand.id}${path}`);
        const job = await poll.json();
        setJob({
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
    },
    [brand.id, stopPolling]
  );

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
      pollJob("/login", setLogin);
    } catch (e) {
      setLogin({
        status: "failed",
        liveViewUrl: null,
        steps: [],
        error: e instanceof Error ? e.message : "login failed",
      });
    }
  }, [brand.id, brand.url, market, pollJob]);

  const startAgentSignup = useCallback(async () => {
    setSignup({ status: "starting", liveViewUrl: null, steps: [], error: null });
    try {
      const res = await fetch(`/api/brands/${brand.id}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: brand.url,
          market,
          brandName: brand.name,
          ownBrand: brand.role === "own_brand",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "signup failed to start");
      setSignup((s) => ({ ...s, status: "running", liveViewUrl: data.liveViewUrl }));
      pollJob("/signup", setSignup);
    } catch (e) {
      setSignup({
        status: "failed",
        liveViewUrl: null,
        steps: [],
        error: e instanceof Error ? e.message : "signup failed",
      });
    }
  }, [brand.id, brand.url, brand.name, brand.role, market, pollJob]);

  useEffect(() => stopPolling, [stopPolling]);

  const launchUrl = `/capture?projectId=${projectId}&brandId=${brand.id}&name=${encodeURIComponent(brand.name)}&url=${encodeURIComponent(brand.url)}&market=${encodeURIComponent(market)}`;
  const loginBusy = login.status === "starting" || login.status === "running";
  const signupBusy = signup.status === "starting" || signup.status === "running";

  const renderJobPanel = (
    label: string,
    job: AgentJobState,
    busy: boolean
  ) =>
    job.status !== "none" ? (
      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex items-center gap-2 text-sm">
          {busy ? (
            <LoaderCircle className="size-4 animate-spin text-brand" />
          ) : job.status === "success" ? (
            <CircleCheck className="size-4 text-score-strong" />
          ) : (
            <CircleAlert className="size-4 text-score-weak" />
          )}
          <span className="font-medium">
            {job.status === "success"
              ? `${label} complete — session saved`
              : job.status === "failed"
                ? `${label} failed`
                : `${label} in progress…`}
          </span>
          {job.liveViewUrl ? (
            <Button
              size="sm"
              variant="outline"
              className="ms-auto h-6 gap-1 px-2 text-xs"
              nativeButton={false}
              render={
                <a href={job.liveViewUrl} target="_blank" rel="noreferrer" />
              }
            >
              <ExternalLink className="size-3" />
              Watch / rescue
            </Button>
          ) : null}
        </div>
        {job.steps.length > 0 ? (
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {job.steps.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        ) : null}
        {job.error ? (
          <p className="text-xs leading-relaxed text-score-weak">{job.error}</p>
        ) : null}
        {busy ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            If a captcha, SMS, or email verification appears, open the live view
            and finish it — the agent waits and picks up once you&apos;re through.
          </p>
        ) : null}
      </div>
    ) : null;

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
            placeholder={
              brand.role === "own_brand"
                ? DEFAULT_TEST_EMAIL
                : defaultTestEmailForBrand(brand.name)
            }
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
          <Input
            type="password"
            placeholder={
              status?.hasPassword
                ? "Test password saved — type to replace"
                : "Apply persona to set test password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={seedPersona} disabled={seeding}>
            {seeding ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <KeyRound data-icon="inline-start" />
            )}
            Apply test persona
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : null}
            Save credentials
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={startAgentSignup}
            disabled={signupBusy || loginBusy}
          >
            {signupBusy ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <UserPlus data-icon="inline-start" />
            )}
            {signupBusy ? "Signing up…" : "Sign up with agent"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={startAgentLogin}
            disabled={loginBusy || signupBusy || !status?.hasPassword}
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
            Manual live browser
          </Button>
          {status?.hasPersona ? (
            <span className="text-xs text-muted-foreground">
              Persona + address ready ({market})
            </span>
          ) : null}
          {saved ? (
            <span className="flex items-center gap-1 text-xs text-score-strong">
              <CircleCheck className="size-3.5" /> Saved
            </span>
          ) : null}
        </div>

        {renderJobPanel("Signup", signup, signupBusy)}
        {renderJobPanel("Login", login, loginBusy)}
      </CardContent>
    </Card>
  );
}

function AccountsContent({ project }: { project: Project }) {
  const [bulkSeeding, setBulkSeeding] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const seedAll = async () => {
    setBulkSeeding(true);
    setBulkError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/seed-accounts`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "seed failed");
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "seed failed");
    } finally {
      setBulkSeeding(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-brand" />
                Test accounts &amp; logged-in sessions
              </CardTitle>
              <CardDescription>
                Login-gated journeys need a real account. Persona uses{" "}
                <span className="font-medium text-foreground">
                  {DEFAULT_TEST_EMAIL}
                </span>{" "}
                (+brand per competitor), test password from server env, and a{" "}
                {project.market === "Nordics" ? "Nordic" : "US-style"} address
                on registration forms.
              </CardDescription>
            </div>
            <Button size="sm" onClick={seedAll} disabled={bulkSeeding}>
              {bulkSeeding ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : (
                <KeyRound data-icon="inline-start" />
              )}
              Apply persona to all brands
            </Button>
          </div>
          {bulkError ? (
            <p className="text-xs text-score-weak">{bulkError}</p>
          ) : null}
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
        Workflow: click <strong className="font-medium text-foreground/80">Apply test persona</strong>{" "}
        (stores email + password + address), then{" "}
        <strong className="font-medium text-foreground/80">Sign up with agent</strong>{" "}
        for brands without an account. The agent fills each form step with the
        market persona — every site&apos;s form is different, so open{" "}
        <strong className="font-medium text-foreground/80">Watch / rescue</strong>{" "}
        for CAPTCHA or email verification at {DEFAULT_TEST_EMAIL}. Once through,
        future runs use <strong className="font-medium text-foreground/80">Log in with agent</strong>.
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
