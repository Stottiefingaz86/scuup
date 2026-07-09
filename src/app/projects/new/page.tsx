"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CornerDownLeft,
  Dice5,
  Gift,
  Goal,
  Headphones,
  Landmark,
  ShieldCheck,
  Sparkles,
  UserCog,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScuupLogo } from "@/components/scuup-logo";
import { cn } from "@/lib/utils";
import {
  JOURNEY_LABELS,
  journeysForProducts,
  MARKET_PROXY_COUNTRY,
  MARKETS,
  PRODUCTS,
} from "@/lib/constants";
import { createProject, LimitError } from "@/lib/project-store";
import { ensureEmailVerified } from "@/components/verify-email-banner";
import type { JourneyType } from "@/lib/types";

const JOURNEY_ICONS: Record<JourneyType, typeof UserPlus> = {
  signup: UserPlus,
  deposit: Wallet,
  withdraw: Landmark,
  casino: Dice5,
  sports_betslip: Goal,
  loyalty_rewards: Gift,
  support: Headphones,
  my_account: UserCog,
};

const JOURNEY_HINTS: Record<JourneyType, string> = {
  signup: "Offer clarity, form effort, trust",
  deposit: "Methods, fees, timing, focus",
  withdraw: "KYC, tracking, timeframes",
  casino: "Lobby, search, game launch",
  sports_betslip: "Markets, slip, bet builder",
  loyalty_rewards: "Progress, value-back, loop",
  support: "Chat access, money-issue help",
  my_account: "Balance, bonus, verification",
};

const ANALYSIS_MODES = [
  {
    value: "Public Audit Mode",
    hint: "Public pages only. No credentials needed. Available now.",
    available: true,
  },
  {
    value: "Logged-In Audit Mode",
    hint: "Uses saved test accounts — set them up on the Accounts page after launch.",
    available: true,
  },
  {
    value: "Assisted Audit Mode",
    hint: "Pauses for OTP, CAPTCHA and manual steps. Coming in v2.",
    available: false,
  },
  {
    value: "Manual Capture Mode",
    hint: "You drive, we record and analyse. Coming in v2.",
    available: false,
  },
];

const TOTAL_STEPS = 7;

/* Typeform-style oversized underline input. */
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
  step,
  question,
  hint,
  children,
}: {
  step: number;
  question: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      key={step}
      className="flex w-full max-w-2xl flex-col gap-8 duration-500 animate-in fade-in slide-in-from-bottom-6"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <span className="tabular-nums">{step + 1}</span>
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

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [ownBrandUrl, setOwnBrandUrl] = useState("");
  const [competitors, setCompetitors] = useState<string[]>(["", "", ""]);
  const [market, setMarket] = useState<string | null>(null);
  const [products, setProducts] = useState<string[]>([
    "Casino",
    "Sports",
    "Payments",
    "Rewards",
  ]);
  const [journeys, setJourneys] = useState<JourneyType[]>(
    journeysForProducts(["Casino", "Sports", "Payments", "Rewards"])
  );

  /** Only journeys relevant to the picked products are offered. */
  const availableJourneys = useMemo(
    () => journeysForProducts(products),
    [products]
  );

  // Drop deposit/withdraw (etc.) when their product was deselected on a prior step.
  useEffect(() => {
    setJourneys((prev) => {
      const next = prev.filter((j) => availableJourneys.includes(j));
      return next.length === prev.length ? prev : next;
    });
  }, [availableJourneys]);
  const [mode, setMode] = useState<string>("Public Audit Mode");

  const validCompetitors = useMemo(
    () => competitors.filter((c) => c.trim().length > 0),
    [competitors]
  );

  const validate = useCallback(
    (s: number): string | null => {
      if (s === 0 && name.trim().length === 0) return "Give the project a name to continue.";
      if (s === 1 && ownBrandUrl.trim().length === 0) return "Enter your brand URL to continue.";
      if (s === 2 && validCompetitors.length === 0) return "Add at least one competitor URL.";
      if (s === 3 && !market) return "Pick the market you want audited.";
      if (s === 5 && journeys.length === 0) return "Select at least one journey.";
      return null;
    },
    [name, ownBrandUrl, validCompetitors, market, journeys]
  );

  const next = useCallback(() => {
    const problem = validate(step);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  }, [step, validate]);

  const back = useCallback(() => {
    setError(null);
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  const launch = useCallback(async () => {
    for (let s = 0; s < TOTAL_STEPS; s++) {
      const problem = validate(s);
      if (problem) {
        setError(problem);
        setStep(s);
        return;
      }
    }
    try {
      const verified = await ensureEmailVerified();
      if (!verified) {
        setError("Verify your email before running analysis — check the banner on your dashboard.");
        return;
      }
      const project = await createProject({
        name: name.trim(),
        ownBrandName: "",
        ownBrandUrl: ownBrandUrl.trim(),
        competitors: validCompetitors.map((url) => ({ name: "", url: url.trim() })),
        market: market!,
        products,
        journeys: journeys.filter((j) => availableJourneys.includes(j)),
        analysisMode: mode,
      });
      router.push(`/projects/${project.id}/analyzing`);
    } catch (e) {
      if (e instanceof LimitError) {
        router.push("/upgrade");
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to create project");
    }
  }, [validate, name, ownBrandUrl, validCompetitors, market, products, journeys, availableJourneys, mode, router]);

  // Enter advances, except on the final step where it launches.
  const stepRef = useRef({ next, launch, step });
  useEffect(() => {
    stepRef.current = { next, launch, step };
  }, [next, launch, step]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      if (stepRef.current.step === TOTAL_STEPS - 1) stepRef.current.launch();
      else stepRef.current.next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleJourney(journey: JourneyType) {
    setJourneys((prev) =>
      prev.includes(journey)
        ? prev.filter((j) => j !== journey)
        : [...prev, journey]
    );
  }

  function toggleProduct(product: string) {
    setProducts((prev) => {
      const nextProducts = prev.includes(product)
        ? prev.filter((p) => p !== product)
        : [...prev, product];
      // Deselecting a product removes its journeys; selecting one offers
      // them again (pre-ticked, since the user just said they matter).
      const available = journeysForProducts(nextProducts);
      setJourneys((prevJourneys) => {
        const kept = prevJourneys.filter((j) => available.includes(j));
        const added = available.filter(
          (j) => !journeysForProducts(prev).includes(j)
        );
        return [...new Set([...kept, ...added])];
      });
      return nextProducts;
    });
  }

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Progress */}
      <div className="fixed inset-x-0 top-0 z-20 h-1 bg-muted/50">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <header className="flex items-center px-6 py-5">
        <ScuupLogo href="/dashboard" />
        <span className="ms-auto text-sm text-muted-foreground tabular-nums">
          {step + 1} / {TOTAL_STEPS}
        </span>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-28 pt-8">
        {step === 0 ? (
          <StepShell
            step={0}
            question="What should we call this audit?"
            hint="You'll see this on your dashboard and on the report cover."
          >
            <BigInput
              autoFocus
              id="project-name"
              value={name}
              onChange={setName}
              placeholder="UK Market — Q3 Competitor Audit"
            />
          </StepShell>
        ) : null}

        {step === 1 ? (
          <StepShell
            step={1}
            question="Where do your players play?"
            hint="Your brand's URL. This is the experience everything gets benchmarked against."
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

        {step === 2 ? (
          <StepShell
            step={2}
            question="Who's taking your players?"
            hint="Up to three competitors. One is enough to start."
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
                        prev.map((v, j) => (j === i ? e.target.value : v))
                      )
                    }
                    placeholder={
                      ["https://stake.com", "https://rainbet.com", "https://bet365.com"][i]
                    }
                    className="w-full border-b-2 border-input bg-transparent pb-2 font-heading text-xl outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-primary"
                  />
                </div>
              ))}
            </div>
          </StepShell>
        ) : null}

        {step === 3 ? (
          <StepShell
            step={3}
            question="Which market are we auditing?"
            hint="Journeys, payment methods and compliance expectations differ by market."
          >
            <div className="flex flex-col gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {MARKETS.map((m) => {
                  const selected = market === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMarket(m);
                        setError(null);
                      }}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all",
                        selected
                          ? "border-primary/60 bg-primary/10 text-foreground"
                          : "border-border bg-card/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      )}
                    >
                      {m}
                      {selected ? <Check className="size-4 text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
              <p className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
                <span>
                  No VPN needed — our agents browse from{" "}
                  {market && MARKET_PROXY_COUNTRY[market]
                    ? `${market} automatically`
                    : "the selected market automatically"}{" "}
                  via regional routing, so geo-gated offers, payment methods
                  and compliance content are what a real local player sees.
                  Global / Crypto brands serve one worldwide experience, so
                  they&apos;re audited without routing.
                </span>
              </p>
            </div>
          </StepShell>
        ) : null}

        {step === 4 ? (
          <StepShell
            step={4}
            question="Which products matter to you?"
            hint="We'll weight the analysis toward the products you actually compete on."
          >
            <div className="flex flex-wrap gap-2">
              {PRODUCTS.map((p) => {
                const selected = products.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleProduct(p)}
                    className={cn(
                      "rounded-full border px-5 py-2.5 font-heading text-sm transition-all",
                      selected
                        ? "border-primary/60 bg-primary/15 text-foreground"
                        : "border-border bg-card/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </StepShell>
        ) : null}

        {step === 5 ? (
          <StepShell
            step={5}
            question="Which player journeys should we walk?"
            hint="Each journey is scored with iGaming-specific heuristics and evidence."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {availableJourneys.map((journey) => {
                const selected = journeys.includes(journey);
                const Icon = JOURNEY_ICONS[journey];
                return (
                  <button
                    key={journey}
                    type="button"
                    onClick={() => toggleJourney(journey)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-4 text-left transition-all",
                      selected
                        ? "border-primary/60 bg-primary/10"
                        : "border-border bg-card/50 hover:border-primary/30"
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-md",
                        selected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="size-4.5" />
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span
                        className={cn(
                          "font-heading text-sm font-medium",
                          !selected && "text-muted-foreground"
                        )}
                      >
                        {JOURNEY_LABELS[journey]}
                      </span>
                      <span className="text-xs text-muted-foreground/70">
                        {JOURNEY_HINTS[journey]}
                      </span>
                    </div>
                    {selected ? (
                      <Check className="ms-auto size-4 shrink-0 text-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </StepShell>
        ) : null}

        {step === 6 ? (
          <StepShell
            step={6}
            question="Ready to see the gaps?"
            hint="Public Audit Mode walks everything visible without credentials. The analysis pauses at CAPTCHAs, OTP, KYC and payment confirmation — no real money ever moves."
          >
            <div className="flex flex-col gap-2">
              {ANALYSIS_MODES.map((m) => {
                const selected = mode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    disabled={!m.available}
                    onClick={() => setMode(m.value)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all",
                      selected
                        ? "border-primary/60 bg-primary/10"
                        : "border-border bg-card/50 hover:border-primary/30",
                      !m.available && "cursor-not-allowed opacity-40 hover:border-border"
                    )}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="font-heading text-sm font-medium">
                        {m.value}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {m.hint}
                      </span>
                    </div>
                    {selected ? (
                      <Check className="ms-auto size-4 shrink-0 text-primary" />
                    ) : null}
                  </button>
                );
              })}

              {/* Review strip */}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card/50 px-4 py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-primary" />
                  {name || "Untitled audit"}
                </span>
                <span>{ownBrandUrl || "your brand"}</span>
                <span>
                  vs {validCompetitors.length} competitor
                  {validCompetitors.length === 1 ? "" : "s"}
                </span>
                <span>{market ?? "no market"}</span>
                <span>{journeys.length} journeys</span>
              </div>

              <Button size="lg" className="mt-4 h-12 w-full text-base glow-primary" onClick={launch}>
                <Sparkles data-icon="inline-start" />
                Run the analysis
              </Button>
            </div>
          </StepShell>
        ) : null}
      </main>

      {/* Bottom bar */}
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
            {step > 0 ? (
              <Button variant="ghost" onClick={back}>
                <ArrowLeft data-icon="inline-start" />
                Back
              </Button>
            ) : (
              <Button
                variant="ghost"
                nativeButton={false}
                render={<Link href="/dashboard" />}
              >
                Cancel
              </Button>
            )}
            {step < TOTAL_STEPS - 1 ? (
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
