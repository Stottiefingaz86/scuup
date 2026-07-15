import Link from "next/link";
import { ArrowLeft, Check, Lock, Sparkles } from "lucide-react";
import { ScuupLogo } from "@/components/scuup-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FREE_PLAN_FEATURES,
  PRO_PLUS_PRICE_MONTHLY,
  PRO_PLUS_SELLING_POINTS,
  PRO_PRICE_MONTHLY,
  PRO_SELLING_POINTS,
} from "@/lib/plan";

const HEADLINES: Record<string, { title: string; description: string }> = {
  new: {
    title: "Benchmark against the brands taking your players",
    description:
      "Free scores your brand once. Pro adds four competitors and every journey on one live report. Pro Plus runs five reports in parallel.",
  },
  limit: {
    title: "You've used your free report",
    description:
      "Free is one-and-done, your brand only, no re-runs. Upgrade for competitive benchmarks, logged-in journeys and monthly refreshes.",
  },
  competitors: {
    title: "See who's actually taking your players",
    description:
      "Pro puts up to four competitors next to your brand on the same heuristics. Pro Plus gives you five reports for multiple markets or lines.",
  },
  default: {
    title: "Go beyond your own brand",
    description:
      "Pro and Pro Plus walk the journeys that decide where players deposit, with evidence your whole team can review.",
  },
};

function PlanPrice({
  amount,
  period,
  taxNote,
}: {
  amount: number;
  period: string;
  taxNote?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-1.5">
        <span className="font-heading text-3xl font-semibold tabular-nums">
          €{amount}
        </span>
        {period ? (
          <span className="text-sm text-muted-foreground">{period}</span>
        ) : (
          <span className="text-sm text-muted-foreground">forever</span>
        )}
      </div>
      {taxNote ? (
        <span className="text-xs text-muted-foreground">{taxNote}</span>
      ) : null}
    </div>
  );
}

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const heading = HEADLINES[from ?? "default"] ?? HEADLINES.default;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-12">
      <ScuupLogo />

      <div className="flex max-w-lg flex-col gap-2 text-center">
        <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
          {heading.title}
        </h1>
        <p className="text-muted-foreground">{heading.description}</p>
      </div>

      <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <CardDescription>Score your brand once.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <PlanPrice amount={0} period="" />
            <ul className="flex flex-col gap-2.5">
              {FREE_PLAN_FEATURES.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
                  {f}
                </li>
              ))}
              <li className="flex items-start gap-2 text-sm text-muted-foreground/60">
                <Lock className="mt-0.5 size-4 shrink-0" />
                No competitors
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-primary/40 bg-primary/[0.03]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Pro
            </CardTitle>
            <CardDescription>
              One competitive report, refreshed monthly.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <PlanPrice
              amount={PRO_PRICE_MONTHLY}
              period="/ month"
              taxNote="exc. tax"
            />
            <ul className="flex flex-col gap-2.5">
              {PRO_SELLING_POINTS.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                  {f}
                </li>
              ))}
            </ul>
            <Button size="lg" className="w-full glow-primary" disabled>
              <Sparkles data-icon="inline-start" />
              Upgrade to Pro, coming soon
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pro Plus</CardTitle>
            <CardDescription>
              Five reports for teams tracking multiple sets.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <PlanPrice
              amount={PRO_PLUS_PRICE_MONTHLY}
              period="/ month"
              taxNote="exc. tax"
            />
            <ul className="flex flex-col gap-2.5">
              {PRO_PLUS_SELLING_POINTS.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                  {f}
                </li>
              ))}
            </ul>
            <Button size="lg" className="w-full" variant="outline" disabled>
              Pro Plus, coming soon
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="max-w-md text-center text-xs text-muted-foreground">
        Payments aren&apos;t live yet. Contact us for early Pro or Pro Plus
        access.
      </p>

      <Button
        variant="ghost"
        nativeButton={false}
        render={<Link href="/dashboard" />}
      >
        <ArrowLeft data-icon="inline-start" />
        Continue with Free
      </Button>
    </div>
  );
}
