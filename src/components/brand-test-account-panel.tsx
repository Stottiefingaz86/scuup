"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  credentialMetaFromNotes,
  fetchCredentialStatus,
  pollBrandLogin,
  saveBrandCredentials,
  startBrandLogin,
  type CredentialStatus,
  type DepositMode,
} from "@/lib/brand-credentials-client";
import {
  agentKey,
  friendlyAgentError,
  runAgentBatch,
  useRunningAgents,
} from "@/lib/run-agent";
import { LOGIN_AGENT_JOURNEYS } from "@/lib/constants";
import { projectAreas } from "@/lib/coverage";
import type { Brand, Project } from "@/lib/types";

function DepositModeOption({
  value,
  checked,
  title,
  description,
  onSelect,
}: {
  value: DepositMode;
  checked: boolean;
  title: string;
  description: string;
  onSelect: (v: DepositMode) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
        checked
          ? "border-primary/40 bg-primary/5"
          : "border-border hover:border-primary/20"
      )}
    >
      <input
        type="radio"
        name="deposit-mode"
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="mt-0.5"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

/** Save test credentials, log in via the agent, and re-run logged-in journeys. */
export function BrandTestAccountPanel({
  project,
  brand,
  compact = false,
  /** When set, show a one-click re-run for this journey after login. */
  rerunArea,
  className,
}: {
  project: Project;
  brand: Brand;
  compact?: boolean;
  rerunArea?: string;
  className?: string;
}) {
  const running = useRunningAgents();
  const areas = projectAreas(project);
  const loginJourneys = LOGIN_AGENT_JOURNEYS.filter((j) => areas.includes(j));

  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginLiveUrl, setLoginLiveUrl] = useState<string | null>(null);
  const [loginSteps, setLoginSteps] = useState<string[]>([]);
  const [rerunning, setRerunning] = useState(false);

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [depositMode, setDepositMode] = useState<DepositMode>("cashier_only");
  const [preferredCrypto, setPreferredCrypto] = useState("");
  const [userNotes, setUserNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await fetchCredentialStatus(brand.id);
      setStatus(s);
      setEmail(s.email ?? "");
      setUsername(s.username ?? "");
      const meta = credentialMetaFromNotes(s.notes);
      setDepositMode(meta.depositMode);
      setPreferredCrypto(meta.preferredCrypto);
      setUserNotes(meta.userNotes);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not load test account"
      );
    } finally {
      setLoading(false);
    }
  }, [brand.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!email.trim() && !username.trim()) {
      toast.error("Enter an email or username for the test account.");
      return;
    }
    if (!password.trim() && !status?.hasPassword) {
      toast.error("Enter the account password.");
      return;
    }
    setSaving(true);
    try {
      const s = await saveBrandCredentials(brand.id, {
        email: email.trim() || undefined,
        username: username.trim() || undefined,
        password: password.trim() || undefined,
        meta: { depositMode, preferredCrypto, userNotes },
      });
      setStatus(s);
      setPassword("");
      toast.success(`Test account saved for ${brand.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const pollLogin = async () => {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const job = await pollBrandLogin(brand.id);
      if (job.liveViewUrl) setLoginLiveUrl(job.liveViewUrl);
      if (job.steps?.length) setLoginSteps(job.steps);
      if (job.status === "success") return true;
      if (job.status === "failed") {
        throw new Error(job.error ?? "Login failed");
      }
      if (job.status === "none") break;
    }
    throw new Error("Login timed out — open the live view and finish manually, then retry.");
  };

  const loginAndSaveSession = async () => {
    if (!status?.hasPassword && !password.trim()) {
      toast.error("Save a password first.");
      return;
    }
    if (!email.trim() && !username.trim()) {
      toast.error("Save an email or username first.");
      return;
    }
    if (password.trim()) {
      await save();
    }
    setLoggingIn(true);
    setLoginSteps([]);
    setLoginLiveUrl(null);
    try {
      const job = await startBrandLogin(brand.id, brand.url, project.market);
      if (job.liveViewUrl) setLoginLiveUrl(job.liveViewUrl);
      const ok = await pollLogin();
      if (ok) {
        await load();
        toast.success(`${brand.name} session saved — logged-in journeys can run.`);
      }
    } catch (e) {
      toast.error(friendlyAgentError(e instanceof Error ? e : new Error(String(e))), {
        duration: 12000,
      });
    } finally {
      setLoggingIn(false);
    }
  };

  const rerunLoggedInJourneys = async (onlyArea?: string) => {
    const jobs = onlyArea
      ? [{ brand, area: onlyArea }]
      : loginJourneys.map((area) => ({ brand, area }));
    if (jobs.length === 0) {
      toast.error("No logged-in journeys in this project.");
      return;
    }
    setRerunning(true);
    try {
      const fails = await runAgentBatch(project.id, jobs, 1);
      if (fails.length === 0) {
        toast.success(
          onlyArea
            ? `${brand.name} — logged-in journey re-run finished.`
            : `All logged-in journeys re-run for ${brand.name}.`
        );
      } else {
        toast.error(`${fails.length} run(s) failed`, {
          description: fails.map((f) => `${f.area}: ${f.error}`).join("\n"),
          duration: 12000,
        });
      }
    } finally {
      setRerunning(false);
    }
  };

  const rerunOneRunning = rerunArea
    ? running.includes(agentKey(brand.id, rerunArea))
    : false;

  const shell = compact ? "border-0 bg-transparent p-0 shadow-none" : "";

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <LoaderCircle className="size-4 animate-spin" />
        Loading test account…
      </div>
    );
  }

  const inner = (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${brand.id}-email`}>Email</Label>
          <Input
            id={`${brand.id}-email`}
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="test@yourbrand.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${brand.id}-username`}>Username (if needed)</Label>
          <Input
            id={`${brand.id}-username`}
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${brand.id}-password`}>
          Password
          {status?.hasPassword && !password ? (
            <span className="ms-1.5 font-normal text-muted-foreground">
              (saved — leave blank to keep)
            </span>
          ) : null}
        </Label>
        <Input
          id={`${brand.id}-password`}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={status?.hasPassword ? "••••••••" : "Required"}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>First deposit behaviour</Label>
        <DepositModeOption
          value="cashier_only"
          checked={depositMode === "cashier_only"}
          title="Walk cashier only (recommended)"
          description="Agent opens deposit, picks crypto and captures the payment address — no funds sent."
          onSelect={setDepositMode}
        />
        <DepositModeOption
          value="prefunded"
          checked={depositMode === "prefunded"}
          title="Account already has balance"
          description="Use a test account you've already deposited into — agent can confirm balance and post-deposit UX."
          onSelect={setDepositMode}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${brand.id}-crypto`}>Preferred crypto (optional)</Label>
        <Input
          id={`${brand.id}-crypto`}
          value={preferredCrypto}
          onChange={(e) => setPreferredCrypto(e.target.value)}
          placeholder="e.g. USDT (TRC20), BTC"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${brand.id}-notes`}>Notes (2FA, captcha, quirks)</Label>
        <Textarea
          id={`${brand.id}-notes`}
          value={userNotes}
          onChange={(e) => setUserNotes(e.target.value)}
          placeholder="e.g. 2FA on every login — use live view to complete"
          rows={2}
        />
      </div>

      {status?.loggedInAt ? (
        <p className="flex items-center gap-1.5 text-xs text-primary">
          <ShieldCheck className="size-3.5 shrink-0" />
          Last logged in{" "}
          {new Date(status.loggedInAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
          {status.hasContext ? " · session saved" : ""}
        </p>
      ) : null}

      {loginSteps.length > 0 ? (
        <ol className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          {loginSteps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? (
            <LoaderCircle className="size-3.5 animate-spin" data-icon="inline-start" />
          ) : (
            <KeyRound className="size-3.5" data-icon="inline-start" />
          )}
          Save account
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={loggingIn || saving}
          onClick={() => void loginAndSaveSession()}
        >
          {loggingIn ? (
            <LoaderCircle className="size-3.5 animate-spin" data-icon="inline-start" />
          ) : (
            <Bot className="size-3.5" data-icon="inline-start" />
          )}
          {loggingIn ? "Logging in…" : "Log in & save session"}
        </Button>
        {loginLiveUrl ? (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={
              <a
                href={loginLiveUrl}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <ExternalLink data-icon="inline-start" />
            Live view
          </Button>
        ) : null}
        {rerunArea ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={rerunning || rerunOneRunning}
            onClick={() => void rerunLoggedInJourneys(rerunArea)}
          >
            {rerunning || rerunOneRunning ? (
              <LoaderCircle className="size-3.5 animate-spin" data-icon="inline-start" />
            ) : (
              <Bot className="size-3.5" data-icon="inline-start" />
            )}
            Re-run journey
          </Button>
        ) : loginJourneys.length > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={rerunning}
            onClick={() => void rerunLoggedInJourneys()}
          >
            {rerunning ? (
              <LoaderCircle className="size-3.5 animate-spin" data-icon="inline-start" />
            ) : (
              <Bot className="size-3.5" data-icon="inline-start" />
            )}
            Re-run logged-in journeys
          </Button>
        ) : null}
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-medium">Test account</h4>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Add login details to walk deposit and other logged-in journeys.
          </p>
        </div>
        {inner}
      </div>
    );
  }

  return (
    <Card className={cn(shell, className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4 text-brand" />
          {brand.name}
        </CardTitle>
        <CardDescription>
          Test account for logged-in journeys. Credentials are encrypted — only
          the agent uses them on your authorised sites.
        </CardDescription>
      </CardHeader>
      <CardContent>{inner}</CardContent>
    </Card>
  );
}
