"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CornerDownLeft,
  Monitor,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScuupLogo } from "@/components/scuup-logo";
import { cn } from "@/lib/utils";
import { faviconUrl } from "@/lib/constants";
import { autoMarketForBrands } from "@/lib/brand-markets";
import { createResearchProject } from "@/lib/research/store";
import type { ResearchDevice } from "@/lib/research/types";

type StepId = "brand" | "competitors" | "device" | "launch";

const STEPS: StepId[] = ["brand", "competitors", "device", "launch"];

const DEVICE_OPTIONS: {
  id: ResearchDevice;
  label: string;
  hint: string;
  icons: (typeof Monitor)[];
}[] = [
  {
    id: "desktop",
    label: "Desktop",
    hint: "Clearest cashier and lobby reads",
    icons: [Monitor],
  },
  {
    id: "mobile",
    label: "Mobile",
    hint: "Where most players actually land",
    icons: [Smartphone],
  },
];

function brandNameFromUrl(url: string): string {
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`)
      .hostname;
    const base = host.replace(/^www\./, "").split(".")[0] ?? "Brand";
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return url || "Brand";
  }
}

function BigInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      autoComplete="off"
      className="w-full border-b-2 border-input bg-transparent pb-3 font-heading text-2xl outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-primary sm:text-3xl"
    />
  );
}

function StepShell({
  index,
  question,
  hint,
  children,
}: {
  index: number;
  question: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      key={index}
      className="flex w-full max-w-2xl flex-col gap-8 duration-500 animate-in fade-in slide-in-from-bottom-6"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <span className="tabular-nums">{index + 1}</span>
          <ArrowRight className="size-3.5" />
        </div>
        <h1 className="font-heading text-3xl font-medium tracking-tight sm:text-4xl">
          {question}
        </h1>
        {hint ? <p className="text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export default function NewResearchProjectPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  const [ownBrandUrl, setOwnBrandUrl] = useState("");
  const [competitors, setCompetitors] = useState<string[]>(["", "", "", ""]);
  const [device, setDevice] = useState<ResearchDevice>("desktop");

  const stepId = STEPS[Math.min(stepIndex, STEPS.length - 1)]!;
  const totalSteps = STEPS.length;
  const progress = ((stepIndex + 1) / totalSteps) * 100;

  const validCompetitors = useMemo(
    () => competitors.filter((c) => c.trim().length > 0),
    [competitors],
  );

  const projectName = useMemo(
    () => `${brandNameFromUrl(ownBrandUrl.trim())} first-bet teardown`,
    [ownBrandUrl],
  );

  const validate = useCallback(
    (id: StepId): string | null => {
      if (id === "brand" && ownBrandUrl.trim().length === 0) {
        return "Enter your brand URL to continue.";
      }
      return null;
    },
    [ownBrandUrl],
  );

  const next = useCallback(() => {
    const msg = validate(stepId);
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    if (stepIndex < totalSteps - 1) setStepIndex((i) => i + 1);
  }, [stepId, stepIndex, totalSteps, validate]);

  const back = useCallback(() => {
    setError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const launch = useCallback(() => {
    const msg = validate("brand");
    if (msg) {
      setError(msg);
      return;
    }
    setLaunching(true);
    // Routing is per brand: curated brands pin the country that lets them
    // load (Bovada → US, Stake → Finland…). This is only the fallback for
    // brands we haven't catalogued — never shown in the report.
    const market = autoMarketForBrands([
      ownBrandUrl.trim(),
      ...validCompetitors,
    ]);
    const project = createResearchProject({
      name: projectName,
      market,
      device,
      ownBrandUrl: ownBrandUrl.trim(),
      competitorUrls: validCompetitors,
    });
    router.push(`/research/projects/${project.id}`);
  }, [validate, projectName, device, ownBrandUrl, validCompetitors, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA") return;
      e.preventDefault();
      if (stepId === "launch") launch();
      else next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepId, next, launch]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="fixed inset-x-0 top-0 z-20 h-1 bg-muted/50">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <header className="flex items-center px-6 py-5">
        <ScuupLogo href="/research" />
        <span className="ms-3 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-primary">
          Research
        </span>
        <span className="ms-auto text-sm text-muted-foreground tabular-nums">
          {stepIndex + 1} / {totalSteps}
        </span>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-28 pt-8">
        {stepId === "brand" ? (
          <StepShell
            index={stepIndex}
            question="Where do your players play?"
            hint="Your brand URL — everything gets timed against this experience."
          >
            <BigInput
              autoFocus
              id="own-brand"
              value={ownBrandUrl}
              onChange={setOwnBrandUrl}
              placeholder="https://yourbrand.com"
            />
          </StepShell>
        ) : null}

        {stepId === "competitors" ? (
          <StepShell
            index={stepIndex}
            question="Who are you benchmarking?"
            hint="Up to four competitors for stopwatch teardowns. Leave blank to tear down solo."
          >
            <div className="flex flex-col gap-6">
              {competitors.map((url, i) => (
                <div key={i} className="flex items-center gap-4">
                  <span className="w-6 shrink-0 font-heading text-sm text-muted-foreground tabular-nums">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <input
                    type="text"
                    value={url}
                    autoFocus={i === 0}
                    autoComplete="off"
                    onChange={(e) =>
                      setCompetitors((prev) =>
                        prev.map((v, j) => (j === i ? e.target.value : v)),
                      )
                    }
                    placeholder={
                      [
                        "https://stake.com",
                        "https://rainbet.com",
                        "https://bet365.com",
                        "https://betway.com",
                      ][i]
                    }
                    className="w-full border-b-2 border-input bg-transparent pb-2 font-heading text-xl outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-primary"
                  />
                </div>
              ))}
            </div>
          </StepShell>
        ) : null}

        {stepId === "device" ? (
          <StepShell
            index={stepIndex}
            question="Desktop or mobile?"
            hint="Pick the surface you care about for first-bet timing."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {DEVICE_OPTIONS.map((opt) => {
                const selected = device === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDevice(opt.id)}
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border p-5 text-left transition-all",
                      selected
                        ? "border-primary/60 bg-primary/10"
                        : "border-border bg-card/50 hover:border-primary/30",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {opt.icons.map((Icon) => (
                        <Icon
                          key={Icon.displayName ?? "icon"}
                          className={cn(
                            "size-5",
                            selected ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                      ))}
                    </div>
                    <div>
                      <p className="font-heading text-lg font-medium">
                        {opt.label}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {opt.hint}
                      </p>
                    </div>
                    {selected ? (
                      <Check className="size-4 text-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </StepShell>
        ) : null}

        {stepId === "launch" ? (
          <StepShell
            index={stepIndex}
            question="Ready to tear it down?"
            hint="We'll create the project, then you set the persona and run timed journeys."
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={faviconUrl(
                      ownBrandUrl.trim() || "https://example.com",
                      32,
                    )}
                    alt=""
                    className="size-4 rounded-sm"
                  />
                  {brandNameFromUrl(ownBrandUrl)}
                </span>
                {validCompetitors.length > 0 ? (
                  <span>
                    vs {validCompetitors.length} competitor
                    {validCompetitors.length === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span>solo teardown</span>
                )}
                <span className="capitalize">{device}</span>
                <span>Routing picked per brand</span>
              </div>

              {validCompetitors.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {validCompetitors.map((url) => (
                    <li
                      key={url}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={faviconUrl(url, 32)}
                        alt=""
                        className="size-3.5 rounded-sm"
                      />
                      {brandNameFromUrl(url)}
                    </li>
                  ))}
                </ul>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Project name:{" "}
                <span className="text-foreground">{projectName}</span>
              </p>

              <Button
                size="lg"
                className="mt-2 h-12 w-full text-base glow-primary"
                disabled={launching}
                onClick={() => launch()}
              >
                <Sparkles data-icon="inline-start" />
                {launching ? "Creating…" : "Create research project"}
              </Button>
            </div>
          </StepShell>
        ) : null}
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-6 py-4">
          {error ? (
            <span className="text-sm text-destructive">{error}</span>
          ) : (
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              press
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                Enter
              </kbd>
              <CornerDownLeft className="size-3" />
              to continue
            </span>
          )}
          <div className="ms-auto flex items-center gap-2">
            {stepIndex > 0 ? (
              <Button variant="ghost" onClick={back}>
                <ArrowLeft data-icon="inline-start" />
                Back
              </Button>
            ) : (
              <Button
                variant="ghost"
                nativeButton={false}
                render={<Link href="/research/projects" />}
              >
                Cancel
              </Button>
            )}
            {stepId !== "launch" ? (
              <Button onClick={next}>
                OK
                <Check data-icon="inline-end" />
              </Button>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
