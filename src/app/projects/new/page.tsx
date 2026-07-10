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
  Lock,
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
import { FREE_JOURNEYS, PRO_SELLING_POINTS, type Plan } from "@/lib/plan";
import { createProject, LimitError } from "@/lib/project-store";
import { ensureEmailVerified } from "@/components/verify-email-banner";
import { VerifyEmailDialog } from "@/components/verify-email-dialog";
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

type StepId =
  | "brand"
  | "competitors"
  | "market"
  | "products"
  | "journeys"
  | "launch";

const FREE_STEPS: StepId[] = ["brand", "market", "products", "launch"];
const PRO_STEPS: StepId[] = [
  "brand",
  "competitors",
  "market",
  "products",
  "journeys",
  "launch",
];

/** "https://www.betfair.com/uk" → "Betfair" */
function brandNameFromUrl(url: string): string {
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`)
      .hostname;
    const base = host.replace(/^www\./, "").split(".")[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return url;
  }
}

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

/** Compact Pro pitch shown on the free launch step — sells, never blocks. */
function ProUpsellCard() {
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <span className="font-heading text-sm font-medium">
          Want to see who&apos;s taking your players?
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {PRO_SELLING_POINTS.slice(0, 3).map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-sm text-muted-foreground"
          >
            <Check className="mt-0.5 size-3.5 shrink-0 text-brand" />
            {f}
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        nativeButton={false}
        render={<Link href="/upgrade?from=new" />}
      >
        <Lock data-icon="inline-start" />
        Unlock with Pro
      </Button>
    </div>
  );
}

/** Free accounts get one report — say so before they fill anything out. */
function LimitReachedScreen() {
  return (
    <div className="flex w-full max-w-lg flex-col gap-6 duration-500 animate-in fade-in slide-in-from-bottom-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-medium tracking-tight">
          You&apos;ve used your free audit
        </h1>
        <p className="text-muted-foreground">
          Free accounts include one report so you can see how Scuup scores
          your brand. Pro unlocks competitors, every journey, and unlimited
          reports.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {PRO_SELLING_POINTS.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-brand" />
            {f}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          className="glow-primary"
          nativeButton={false}
          render={<Link href="/upgrade?from=limit" />}
        >
          <Sparkles data-icon="inline-start" />
          Upgrade to Pro
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/dashboard" />}
        >
          <ArrowLeft data-icon="inline-start" />
          Back to my report
        </Button>
      </div>
    </div>
  );
}

export default function NewProjectPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const pendingLaunchRef = useRef(false);

  const [plan, setPlan] = useState<Plan>("free");
  const [limitReached, setLimitReached] = useState(false);

  const [ownBrandUrl, setOwnBrandUrl] = useState("");
  const [competitors, setCompetitors] = useState<string[]>(["", "", ""]);
  const [market, setMarket] = useState<string | null>(null);
  const [products, setProducts] = useState<string[]>(["Casino", "Sports"]);
  const [journeys, setJourneys] = useState<JourneyType[]>([
    "casino",
    "sports_betslip",
  ]);

  useEffect(() => {
    void fetch("/api/account/plan")
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: {
          plan?: Plan;
          projectCount?: number;
          projectLimit?: number | null;
        } | null) => {
          if (!data) return;
          if (data.plan) setPlan(data.plan);
          if (
            typeof data.projectLimit === "number" &&
            (data.projectCount ?? 0) >= data.projectLimit
          ) {
            setLimitReached(true);
          }
        }
      );
  }, []);

  const steps = plan === "pro" ? PRO_STEPS : FREE_STEPS;
  const stepId = steps[Math.min(stepIndex, steps.length - 1)];
  const totalSteps = steps.length;

  /** Pro: journeys follow the picked products. Free: casino/sports only. */
  const availableJourneys = useMemo(
    () =>
      plan === "pro"
        ? journeysForProducts(products)
        : FREE_JOURNEYS.filter((j) =>
            journeysForProducts(products).includes(j)
          ),
    [plan, products]
  );

  useEffect(() => {
    setJourneys((prev) => {
      const next = prev.filter((j) => availableJourneys.includes(j));
      return next.length === prev.length ? prev : next;
    });
  }, [availableJourneys]);

  const validCompetitors = useMemo(
    () => competitors.filter((c) => c.trim().length > 0),
    [competitors]
  );

  const validate = useCallback(
    (id: StepId): string | null => {
      if (id === "brand" && ownBrandUrl.trim().length === 0)
        return "Enter your brand URL to continue.";
      if (id === "market" && !market) return "Pick the market you want audited.";
      if (id === "products" && products.length === 0)
        return "Pick at least one product.";
      if (id === "journeys" && journeys.length === 0)
        return "Select at least one journey.";
      if (id === "launch" && journeys.length === 0)
        return "Select at least one product to audit.";
      return null;
    },
    [ownBrandUrl, market, products, journeys]
  );

  const next = useCallback(() => {
    const problem = validate(stepId);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    if (stepIndex < totalSteps - 1) setStepIndex((s) => s + 1);
  }, [stepId, stepIndex, totalSteps, validate]);

  const back = useCallback(() => {
    setError(null);
    if (stepIndex > 0) setStepIndex((s) => s - 1);
  }, [stepIndex]);

  const launch = useCallback(async () => {
    for (let i = 0; i < steps.length; i++) {
      const problem = validate(steps[i]);
      if (problem) {
        setError(problem);
        setStepIndex(i);
        return;
      }
    }
    setLaunching(true);
    try {
      const verified = await ensureEmailVerified();
      if (!verified) {
        pendingLaunchRef.current = true;
        setVerifyOpen(true);
        return;
      }
      pendingLaunchRef.current = false;
      const brandName = brandNameFromUrl(ownBrandUrl.trim());
      const project = await createProject({
        name: `${brandName} — ${market}`,
        ownBrandName: brandName,
        ownBrandUrl: ownBrandUrl.trim(),
        competitors:
          plan === "pro"
            ? validCompetitors.map((url) => ({ name: "", url: url.trim() }))
            : [],
        market: market!,
        products,
        journeys: journeys.filter((j) => availableJourneys.includes(j)),
        analysisMode: "Public Audit Mode",
      });
      router.push(`/projects/${project.id}/analyzing`);
    } catch (e) {
      if (e instanceof LimitError) {
        setLimitReached(true);
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setLaunching(false);
    }
  }, [steps, validate, ownBrandUrl, market, plan, validCompetitors, products, journeys, availableJourneys, router]);

  // Enter advances, except on the final step where it launches.
  const stepRef = useRef({ next, launch, stepId });
  useEffect(() => {
    stepRef.current = { next, launch, stepId };
  }, [next, launch, stepId]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      if (stepRef.current.stepId === "launch") stepRef.current.launch();
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
      const available =
        plan === "pro"
          ? journeysForProducts(nextProducts)
          : FREE_JOURNEYS.filter((j) =>
              journeysForProducts(nextProducts).includes(j)
            );
      setJourneys((prevJourneys) => {
        const wasAvailable =
          plan === "pro"
            ? journeysForProducts(prev)
            : FREE_JOURNEYS.filter((j) => journeysForProducts(prev).includes(j));
        const kept = prevJourneys.filter((j) => available.includes(j));
        const added = available.filter((j) => !wasAvailable.includes(j));
        return [...new Set([...kept, ...added])];
      });
      return nextProducts;
    });
  }

  const progress = ((stepIndex + 1) / totalSteps) * 100;
  const freeProducts = ["Casino", "Sports"];
  const productChoices = plan === "pro" ? PRODUCTS : freeProducts;

  if (limitReached) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center px-6 py-5">
          <ScuupLogo href="/dashboard" />
        </header>
        <main className="flex flex-1 items-center justify-center px-6 pb-20">
          <LimitReachedScreen />
        </main>
      </div>
    );
  }

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
          {stepIndex + 1} / {totalSteps}
        </span>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-28 pt-8">
        {stepId === "brand" ? (
          <StepShell
            index={stepIndex}
            question="Where do your players play?"
            hint={
              plan === "pro"
                ? "Your brand's URL — the experience everything gets benchmarked against."
                : "Your brand's URL. Your free audit scores its first impression, casino and sports experience."
            }
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
            question="Who's taking your players?"
            hint="Up to three competitors, benchmarked side by side. Leave blank to audit solo."
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

        {stepId === "market" ? (
          <StepShell
            index={stepIndex}
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
                </span>
              </p>
            </div>
          </StepShell>
        ) : null}

        {stepId === "products" ? (
          <StepShell
            index={stepIndex}
            question={
              plan === "pro"
                ? "Which products matter to you?"
                : "What does your brand offer?"
            }
            hint={
              plan === "pro"
                ? "We'll weight the analysis toward the products you actually compete on."
                : "Your free audit walks the casino lobby and the sports betslip — pick what applies."
            }
          >
            <div className="flex flex-wrap gap-2">
              {productChoices.map((p) => {
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
            {plan === "free" ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {["Payments", "Rewards", "Support"].map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-4 py-2 font-heading text-sm text-muted-foreground/60"
                  >
                    <Lock className="size-3" />
                    {p} — Pro
                  </span>
                ))}
              </div>
            ) : null}
          </StepShell>
        ) : null}

        {stepId === "journeys" ? (
          <StepShell
            index={stepIndex}
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

        {stepId === "launch" ? (
          <StepShell
            index={stepIndex}
            question={
              plan === "pro" ? "Ready to see the gaps?" : "Ready for your free audit?"
            }
            hint="Real browsers visit your site and walk each journey — a vision model scores what they see. Public pages only, no credentials needed."
          >
            <div className="flex flex-col gap-2">
              {/* Review strip */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card/50 px-4 py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-primary" />
                  {ownBrandUrl || "your brand"}
                </span>
                {plan === "pro" && validCompetitors.length > 0 ? (
                  <span>
                    vs {validCompetitors.length} competitor
                    {validCompetitors.length === 1 ? "" : "s"}
                  </span>
                ) : null}
                <span>{market ?? "no market"}</span>
                <span>
                  first impression
                  {journeys.length > 0
                    ? ` + ${journeys
                        .map((j) => JOURNEY_LABELS[j].toLowerCase())
                        .join(", ")}`
                    : ""}
                </span>
              </div>

              <Button
                size="lg"
                className="mt-4 h-12 w-full text-base glow-primary"
                disabled={launching}
                onClick={launch}
              >
                <Sparkles data-icon="inline-start" />
                {launching
                  ? "Starting your audit…"
                  : plan === "pro"
                    ? "Run the analysis"
                    : "Run my free audit"}
              </Button>

              {plan === "free" ? <ProUpsellCard /> : null}
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
            {stepIndex > 0 ? (
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
            {stepId !== "launch" ? (
              <Button onClick={next}>
                OK
                <Check data-icon="inline-end" />
              </Button>
            ) : null}
          </div>
        </div>
      </footer>

      <VerifyEmailDialog
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        onVerified={() => {
          if (pendingLaunchRef.current) void launch();
        }}
      />
    </div>
  );
}
