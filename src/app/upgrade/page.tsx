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
import { PRO_PRICE_MONTHLY, PRO_SELLING_POINTS } from "@/lib/plan";

const FREE_FEATURES = [
  "One active report — your brand + 1 competitor",
  "First impression audit",
  "Casino lobby + sports betslip journeys",
  "Full heuristic scoring and evidence",
];

const HEADLINES: Record<string, { title: string; description: string }> = {
  new: {
    title: "Benchmark against the brands taking your players",
    description:
      "Your free audit covers your brand plus one competitor. Pro puts up to 4 competitors next to it and walks every journey — including the logged-in ones.",
  },
  limit: {
    title: "You've used your free report",
    description:
      "Free accounts include one audit of your own brand. Pro unlocks unlimited reports, competitors and every player journey.",
  },
  competitors: {
    title: "See who's actually taking your players",
    description:
      "Pro benchmarks up to 4 competitors next to your brand — same journeys, same heuristics, ranked side by side.",
  },
  default: {
    title: "Go beyond your own brand",
    description:
      "Pro puts your competitors side by side with you and walks the journeys that decide where players deposit.",
  },
};

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

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <CardDescription>See how Scuup scores your brand.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-baseline gap-1.5">
              <span className="font-heading text-3xl font-semibold">$0</span>
              <span className="text-sm text-muted-foreground">forever</span>
            </div>
            <ul className="flex flex-col gap-2.5">
              {FREE_FEATURES.map((f) => (
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
                No competitors or login journeys
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
              The full competitive picture, every cycle.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-baseline gap-1.5">
              <span className="font-heading text-3xl font-semibold">
                ${PRO_PRICE_MONTHLY}
              </span>
              <span className="text-sm text-muted-foreground">/ month</span>
            </div>
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
              Upgrade to Pro — coming soon
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Payments aren&apos;t live yet. Contact us for early Pro access.
            </p>
          </CardContent>
        </Card>
      </div>

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
