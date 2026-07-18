"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  CornerDownLeft,
  Dice5,
  Gift,
  Grid3x3,
  Goal,
  Headphones,
  Landmark,
  LoaderCircle,
  Lock,
  Monitor,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCog,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CircleMarketFlag } from "@/components/circle-market-flag";
import { ScuupLogo } from "@/components/scuup-logo";
import { cn } from "@/lib/utils";
import {
  faviconUrl,
  JOURNEY_LABELS,
  journeysForProducts,
  MARKET_OPTIONS,
  PRODUCTS,
  type MarketOption,
} from "@/lib/constants";
import {
  FREE_JOURNEYS,
  isPaidPlan,
  PLAN_COMPETITOR_LIMIT,
  PRO_SELLING_POINTS,
  type Plan,
} from "@/lib/plan";
import {
  ActiveReportError,
  createProject,
  LimitError,
} from "@/lib/project-store";
import { track } from "@/lib/track";
import { ensureEmailVerified } from "@/components/verify-email-banner";
import { VerifyEmailDialog } from "@/components/verify-email-dialog";
import type { DeviceMode, JourneyType } from "@/lib/types";

const DEVICE_OPTIONS: {
  id: DeviceMode;
  label: string;
  hint: string;
  icons: (typeof Monitor)[];
}[] = [
  {
    id: "desktop",
    label: "Desktop",
    hint: "Fastest, most reliable walks",
    icons: [Monitor],
  },
  {
    id: "mobile",
    label: "Mobile",
    hint: "Where ~80% of players are",
    icons: [Smartphone],
  },
  {
    id: "both",
    label: "Both",
    hint: "Desktop and mobile in one report",
    icons: [Monitor, Smartphone],
  },
];

const JOURNEY_ICONS: Record<JourneyType, typeof UserPlus> = {
  signup: UserPlus,
  deposit: Wallet,
  withdraw: Landmark,
  casino: Dice5,
  bingo: Grid3x3,
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
  bingo: "Rooms, schedule, ticket clarity",
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

const MARKET_GROUPS: MarketOption["group"][] = [
  "Europe",
  "North America",
  "Latin America",
  "Asia-Pacific",
  "Africa",
  "Other",
];

/** Best-effort licensing/geo knowledge for one brand: which markets it's
 * known to block or serve. Markets in neither list are unknown. */
interface BrandAvailability {
  blocked: string[];
  available: string[];
}

interface PickerBrand {
  url: string;
  name: string;
}

/** NordVPN-style country picker: search, popular row, grouped list. */
function MarketPicker({
  market,
  onSelect,
  brands = [],
  availability = {},
  checkingAvailability = false,
}: {
  market: string | null;
  onSelect: (label: string) => void;
  brands?: PickerBrand[];
  availability?: Record<string, BrandAvailability>;
  checkingAvailability?: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      q.length === 0
        ? MARKET_OPTIONS
        : MARKET_OPTIONS.filter((m) => m.label.toLowerCase().includes(q)),
    [q]
  );
  const popular = MARKET_OPTIONS.filter((m) => m.popular);
  const selectedOption = MARKET_OPTIONS.find((m) => m.label === market);
  const hasAvailabilityData = Object.values(availability).some(
    (a) => a.blocked.length > 0 || a.available.length > 0
  );

  /** Brands known to geo-block a market, the decision-relevant signal. */
  const blockedIn = (label: string): PickerBrand[] =>
    brands.filter((b) => availability[b.url]?.blocked.includes(label));

  /** Every entered brand confidently serves this market. */
  const servedByAll = (label: string): boolean =>
    brands.length > 0 &&
    brands.every((b) => availability[b.url]?.available.includes(label));

  const selectedBlocked = market ? blockedIn(market) : [];
  const selectedServed = market ? servedByAll(market) : false;

  const MarketButton = ({ m }: { m: MarketOption }) => {
    const selected = market === m.label;
    const blocked = blockedIn(m.label);
    const allServe = servedByAll(m.label);
    return (
      <button
        type="button"
        onClick={() => onSelect(m.label)}
        title={
          blocked.length > 0
            ? `${blocked.map((b) => b.name).join(" and ")} geo-block${blocked.length === 1 ? "s" : ""} players in ${m.label}`
            : allServe
              ? `All your brands serve ${m.label}`
              : undefined
        }
        className={cn(
          "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-all",
          selected
            ? "border-primary/60 bg-primary/10 text-foreground"
            : allServe && brands.length > 0
              ? "border-brand/35 bg-brand/[0.04] text-foreground hover:border-brand/50"
              : "border-border bg-card/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
        )}
      >
        <CircleMarketFlag market={m} size={22} className="shadow-sm ring-1 ring-black/10" />
        <span className="min-w-0 truncate">{m.label}</span>
        <span className="ms-auto flex shrink-0 items-center gap-1">
          {blocked.length > 0 ? (
            <span className="flex items-center -space-x-1">
              {blocked.slice(0, 3).map((b) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={b.url}
                  src={faviconUrl(b.url, 32)}
                  alt={b.name}
                  className="size-3.5 rounded-full opacity-90 outline outline-1 outline-score-weak grayscale-[35%]"
                />
              ))}
            </span>
          ) : allServe && brands.length > 0 ? (
            <span className="rounded border border-brand/35 px-1 py-px text-[10px] uppercase tracking-wide text-brand">
              all brands
            </span>
          ) : null}
          {m.cryptoFriendly ? (
            <span className="rounded border border-brand/30 px-1 py-px text-[10px] uppercase tracking-wide text-brand/80">
              crypto
            </span>
          ) : null}
          {selected ? <Check className="size-4 text-primary" /> : null}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search markets…"
        autoComplete="off"
        className="w-full rounded-lg border border-input bg-transparent px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary"
      />

      {q.length === 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Popular
          </span>
          <div className="grid gap-2 sm:grid-cols-3">
            {popular.map((m) => (
              <MarketButton key={m.label} m={m} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex max-h-72 flex-col gap-4 overflow-y-auto pe-1">
        {MARKET_GROUPS.map((group) => {
          const inGroup = matches.filter((m) => m.group === group);
          if (inGroup.length === 0) return null;
          return (
            <div key={group} className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {group === "Other" ? "No routing" : group}
              </span>
              <div className="grid gap-2 sm:grid-cols-3">
                {inGroup.map((m) => (
                  <MarketButton key={m.label} m={m} />
                ))}
              </div>
            </div>
          );
        })}
        {matches.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No market matches &quot;{query}&quot;, pick Global (US routing) or
            the closest country.
          </p>
        ) : null}
      </div>

      {checkingAvailability ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <LoaderCircle className="size-3.5 animate-spin" />
          Checking which markets your brands serve…
        </p>
      ) : hasAvailabilityData ? (
        <p className="text-xs text-muted-foreground">
          A brand&apos;s icon means it geo-blocks that market.{" "}
          <span className="text-brand">All brands</span> means every brand you
          entered serves it, Stake and Rainbet block Canada and all US routes;
          Winna and offshore books like BetOnline need different markets.
        </p>
      ) : null}

      {selectedServed && selectedBlocked.length === 0 && brands.length > 0 ? (
        <p className="flex items-start gap-2 rounded-lg border border-brand/30 bg-brand/[0.06] px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <Check className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>
            Every brand you entered serves{" "}
            <span className="font-medium text-foreground">{market}</span>, good
            pick for a side-by-side audit.
          </span>
        </p>
      ) : null}

      {selectedBlocked.length > 0 ? (
        <p className="flex items-start gap-2 rounded-lg border border-score-weak/40 bg-score-weak/[0.06] px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-score-weak" />
          <span>
            <span className="font-medium text-foreground">
              {selectedBlocked.map((b) => b.name).join(" and ")}
            </span>{" "}
            geo-block{selectedBlocked.length === 1 ? "s" : ""} players in{" "}
            {market}, those audits will come back blocked. Pick a market every
            brand serves, or continue if this market is what you compete in.
          </span>
        </p>
      ) : null}

      <p className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
        <span>
          {selectedOption && !selectedOption.geo
            ? "No routing, sessions browse from our datacenter. Fine for brands that serve one worldwide experience."
            : `Stake and Rainbet block Canada and all US routes, pick Finland, Brazil or Japan for crypto brands, or US (rest / offshore) for BetOnline-class books.`}
        </span>
      </p>
    </div>
  );
}

/** Compact Pro pitch shown on the free launch step, sells, never blocks. */
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

/** Free accounts get one report, say so before they fill anything out. */
function LimitReachedScreen() {
  return (
    <div className="flex w-full max-w-lg flex-col gap-6 duration-500 animate-in fade-in slide-in-from-bottom-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-medium tracking-tight">
          You&apos;ve used your free audit
        </h1>
        <p className="text-muted-foreground">
          Free accounts score your brand once, no competitors and no re-runs.
          Upgrade to Pro for four competitors and logged-in journeys, or Pro
          Plus for five parallel reports.
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
  const pendingReplaceActiveRef = useRef(false);

  const [plan, setPlan] = useState<Plan>("free");
  const [limitReached, setLimitReached] = useState(false);

  const [ownBrandUrl, setOwnBrandUrl] = useState("");
  const [competitors, setCompetitors] = useState<string[]>(["", "", "", ""]);
  const [activeConflict, setActiveConflict] = useState<{
    message: string;
    projectId: string | null;
  } | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [market, setMarket] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [products, setProducts] = useState<string[]>(["Casino", "Sports"]);
  const [journeys, setJourneys] = useState<JourneyType[]>([
    "casino",
    "sports_betslip",
  ]);
  const proDefaultsApplied = useRef(false);

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
          const accountPlan = data.plan;
          if (accountPlan) setPlan(accountPlan);
          if (accountPlan && isPaidPlan(accountPlan) && !proDefaultsApplied.current) {
            proDefaultsApplied.current = true;
            setProducts(["Casino", "Sports", "Payments", "Rewards"]);
          }
          if (
            typeof data.projectLimit === "number" &&
            (data.projectCount ?? 0) >= data.projectLimit
          ) {
            setLimitReached(true);
          }
        }
      );
  }, []);

  const steps = isPaidPlan(plan) ? PRO_STEPS : FREE_STEPS;
  const stepId = steps[Math.min(stepIndex, steps.length - 1)];
  const totalSteps = steps.length;

  /** Pro: journeys follow the picked products. Free: casino/sports only. */
  const availableJourneys = useMemo(
    () =>
      isPaidPlan(plan)
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

  /** Paid audits include signup + logged-in journeys by default. */
  useEffect(() => {
    if (!isPaidPlan(plan) || !proDefaultsApplied.current) return;
    setJourneys((prev) => {
      const merged = [
        ...new Set([...prev, ...availableJourneys]),
      ].filter((j) => availableJourneys.includes(j));
      return merged.length > prev.length ? merged : prev;
    });
  }, [plan, availableJourneys]);

  const competitorLimit = PLAN_COMPETITOR_LIMIT[plan];
  const validCompetitors = useMemo(
    () =>
      competitors
        .slice(0, PLAN_COMPETITOR_LIMIT[plan])
        .filter((c) => c.trim().length > 0),
    [competitors, plan]
  );

  // Best-effort brand→market availability, fetched when the market step
  // opens so the picker can flag markets a chosen brand geo-blocks.
  const [availability, setAvailability] = useState<
    Record<string, BrandAvailability>
  >({});
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const availabilityKeyRef = useRef("");
  const pickerBrands = useMemo<PickerBrand[]>(
    () =>
      [ownBrandUrl, ...validCompetitors]
        .map((u) => u.trim())
        .filter(Boolean)
        .map((url) => ({ url, name: brandNameFromUrl(url) })),
    [ownBrandUrl, validCompetitors]
  );

  useEffect(() => {
    if (stepId !== "market" || pickerBrands.length === 0) return;
    const key = pickerBrands.map((b) => b.url).join("|");
    if (availabilityKeyRef.current === key) return;
    availabilityKeyRef.current = key;
    setCheckingAvailability(true);
    let cancelled = false;
    let settled = false;
    void fetch("/api/market-availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brands: pickerBrands.map((b) => b.url) }),
    })
      .then(async (res) => (res.ok ? res.json() : null))
      .then(
        (data: { brands?: (BrandAvailability & { url: string })[] } | null) => {
          if (cancelled || !data?.brands) return;
          setAvailability(
            Object.fromEntries(
              data.brands.map((b) => [
                b.url,
                { blocked: b.blocked, available: b.available },
              ])
            )
          );
        }
      )
      .catch(() => {
        availabilityKeyRef.current = "";
      })
      .finally(() => {
        settled = true;
        if (!cancelled) setCheckingAvailability(false);
      });
    return () => {
      cancelled = true;
      // A discarded in-flight response should be refetched next time the
      // market step opens.
      if (!settled) availabilityKeyRef.current = "";
    };
  }, [stepId, pickerBrands]);

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

  const launch = useCallback(
    async (opts?: { replaceActive?: boolean }) => {
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
          pendingReplaceActiveRef.current = opts?.replaceActive === true;
          setVerifyOpen(true);
          return;
        }
        pendingLaunchRef.current = false;
        pendingReplaceActiveRef.current = false;
        const brandName = brandNameFromUrl(ownBrandUrl.trim());
        const project = await createProject(
          {
            name: `${brandName}: ${market}`,
            ownBrandName: brandName,
            ownBrandUrl: ownBrandUrl.trim(),
            competitors: validCompetitors.map((url) => ({
              name: "",
              url: url.trim(),
            })),
            market: market!,
            products,
            journeys: journeys.filter((j) => availableJourneys.includes(j)),
            analysisMode: "Public Audit Mode",
            device: isPaidPlan(plan) ? device : device === "both" ? "desktop" : device,
          },
          { replaceActive: opts?.replaceActive === true }
        );
        setActiveConflict(null);
        track("report_created", {
          market: market!,
          plan,
          competitors: validCompetitors.length,
          journeys: journeys.length,
        });
        router.push(`/projects/${project.id}/analyzing`);
      } catch (e) {
        if (e instanceof ActiveReportError) {
          setActiveConflict({
            message: e.message,
            projectId: e.activeProjectId,
          });
          return;
        }
        if (e instanceof LimitError) {
          setLimitReached(true);
          return;
        }
        setError(e instanceof Error ? e.message : "Failed to create project");
      } finally {
        setLaunching(false);
        setArchiving(false);
      }
    },
    [
      steps,
      validate,
      ownBrandUrl,
      market,
      plan,
      validCompetitors,
      products,
      journeys,
      availableJourneys,
      device,
      router,
    ]
  );

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
        isPaidPlan(plan)
          ? journeysForProducts(nextProducts)
          : FREE_JOURNEYS.filter((j) =>
              journeysForProducts(nextProducts).includes(j)
            );
      setJourneys((prevJourneys) => {
        const wasAvailable =
          isPaidPlan(plan)
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
  const productChoices = isPaidPlan(plan) ? PRODUCTS : freeProducts;

  if (limitReached) {
    return (
      <>
        <div className="flex min-h-screen flex-col">
          <header className="flex items-center px-6 py-5">
            <ScuupLogo href="/dashboard" />
          </header>
          <main className="flex flex-1 items-center justify-center px-6 pb-20">
            <LimitReachedScreen />
          </main>
        </div>
        <VerifyEmailDialog
          open={verifyOpen}
          onOpenChange={setVerifyOpen}
          onVerified={() => {
            if (pendingLaunchRef.current) {
              void launch({
                replaceActive: pendingReplaceActiveRef.current,
              });
            }
          }}
        />
      </>
    );
  }

  if (activeConflict) {
    return (
      <>
        <div className="flex min-h-screen flex-col">
          <header className="flex items-center px-6 py-5">
            <ScuupLogo href="/dashboard" />
          </header>
          <main className="flex flex-1 items-center justify-center px-6 pb-20">
            <div className="flex w-full max-w-lg flex-col gap-6 duration-500 animate-in fade-in slide-in-from-bottom-6">
              <div className="flex flex-col gap-2">
                <h1 className="font-heading text-3xl font-medium tracking-tight">
                  You already have an active report
                </h1>
                <p className="text-muted-foreground">
                  Plans currently include one active report at a time.
                  Archiving pauses your current report, no more agent runs or
                  score updates, but everything captured stays readable and
                  you can reactivate it later.
                </p>
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {activeConflict.projectId ? (
                  <Button
                    className="glow-primary"
                    disabled={archiving || launching}
                    onClick={() => {
                      setArchiving(true);
                      void launch({ replaceActive: true });
                    }}
                  >
                    <Sparkles data-icon="inline-start" />
                    {archiving || launching
                      ? "Archiving…"
                      : "Archive current report & start this one"}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/dashboard" />}
                >
                  <ArrowLeft data-icon="inline-start" />
                  Keep my current report
                </Button>
              </div>
            </div>
          </main>
        </div>
        <VerifyEmailDialog
          open={verifyOpen}
          onOpenChange={setVerifyOpen}
          onVerified={() => {
            if (pendingLaunchRef.current) {
              void launch({
                replaceActive: pendingReplaceActiveRef.current,
              });
            }
          }}
        />
      </>
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
              isPaidPlan(plan)
                ? "Your brand's URL, the experience everything gets benchmarked against."
                : "Your brand's URL. Free scores first impression, casino and sports, your brand only, one time."
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
            hint="Up to four competitors, benchmarked side by side. Leave blank to audit solo."
          >
            <div className="flex flex-col gap-6">
              {competitors.slice(0, competitorLimit).map((url, i) => (
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

        {stepId === "market" ? (
          <StepShell
            index={stepIndex}
            question="Which market are we auditing?"
            hint="Sessions browse from this location through residential routing, no VPN needed. Offers, payment methods and geo-gates match what a real local player sees."
          >
            <MarketPicker
              market={market}
              onSelect={(m) => {
                setMarket(m);
                setError(null);
              }}
              brands={pickerBrands}
              availability={availability}
              checkingAvailability={checkingAvailability}
            />
          </StepShell>
        ) : null}

        {stepId === "products" ? (
          <StepShell
            index={stepIndex}
            question={
              isPaidPlan(plan)
                ? "Which products matter to you?"
                : "What does your brand offer?"
            }
            hint={
              isPaidPlan(plan)
                ? "We'll weight the analysis toward the products you actually compete on."
                : "Your free audit walks the casino lobby and the sports betslip, pick what applies."
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
                    {p}, Pro
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
              isPaidPlan(plan) ? "Ready to see the gaps?" : "Ready for your free audit?"
            }
            hint="Real browsers visit your site and walk each journey, a vision model scores what they see. Public pages only, no credentials needed."
          >
            <div className="flex flex-col gap-2">
              {/* Device: one viewport per run keeps walks fast enough to
                  finish inside the serverless time limit. */}
              <div className="flex flex-col gap-1.5 pb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Audit device
                </span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {DEVICE_OPTIONS.map((opt) => {
                    const locked = opt.id === "both" && !isPaidPlan(plan);
                    const selected = device === opt.id && !locked;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          if (!locked) setDevice(opt.id);
                        }}
                        className={cn(
                          "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all",
                          locked
                            ? "cursor-not-allowed border-dashed border-border bg-card/30 opacity-60"
                            : selected
                              ? "border-primary/60 bg-primary/10"
                              : "border-border bg-card/50 hover:border-primary/30"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex shrink-0 items-center gap-0.5",
                            locked
                              ? "text-muted-foreground/50"
                              : selected
                                ? "text-primary"
                                : "text-muted-foreground"
                          )}
                        >
                          {opt.icons.map((Icon, i) => (
                            <Icon key={i} className="size-4" />
                          ))}
                        </span>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 font-heading text-sm font-medium",
                              (locked || !selected) && "text-muted-foreground"
                            )}
                          >
                            {opt.label}
                            {locked ? (
                              <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground/60">
                                <Lock className="size-3" />
                                Pro
                              </span>
                            ) : null}
                          </span>
                          <span className="text-xs text-muted-foreground/70">
                            {opt.hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Review strip */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card/50 px-4 py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-primary" />
                  {ownBrandUrl || "your brand"}
                </span>
                {validCompetitors.length > 0 ? (
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
                onClick={() => void launch()}
              >
                <Sparkles data-icon="inline-start" />
                {launching
                  ? "Starting your audit…"
                  : isPaidPlan(plan)
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
          if (pendingLaunchRef.current) {
            void launch({
              replaceActive: pendingReplaceActiveRef.current,
            });
          }
        }}
      />
    </div>
  );
}
