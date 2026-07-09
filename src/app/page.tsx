import Link from "next/link";
import {
  ArrowRight,
  Camera,
  ChartNoAxesColumn,
  Coins,
  Eye,
  FileText,
  Repeat,
  Route,
  ShieldCheck,
  Telescope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const METRICS = [
  {
    icon: ChartNoAxesColumn,
    title: "Player CX Score",
    description:
      "One score for the full player journey — sign up, money moments, play, rewards, account and support.",
  },
  {
    icon: Repeat,
    title: "Retention Loop Score",
    description:
      "Measures whether players have a reason to come back tomorrow — progress, value-back and habit mechanics.",
  },
  {
    icon: Coins,
    title: "Cashier Trust Index",
    description:
      "How much confidence your cashier creates before players commit money — fees, timing, KYC and tracking.",
  },
  {
    icon: Eye,
    title: "Player Promise Gap",
    description:
      "What players believe each brand is best at — and whether your brand owns any position at all.",
  },
];

const STEPS = [
  {
    title: "Add your brand and competitors",
    description:
      "Enter your URL, up to three competitors, your market and the journeys you want audited.",
  },
  {
    title: "AI runs the player journeys",
    description:
      "An AI mystery shopper walks sign-up, deposit, withdraw, casino, betslip, rewards, support and account journeys — capturing evidence at every step.",
  },
  {
    title: "Get scores, strategy and direction",
    description:
      "Journey scores, feature gaps, retention loop analysis and a board-ready report that says what to fix now and what to build next.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-6 py-4">
          <Telescope className="size-6 text-primary" />
          <span className="text-lg font-semibold tracking-tight">
            PlayerScope AI
          </span>
          <div className="ms-auto flex items-center gap-2">
            <Button variant="ghost" nativeButton={false} render={<Link href="/dashboard" />}>
              Dashboard
            </Button>
            <Button nativeButton={false} render={<Link href="/projects/new" />}>
              Start an audit
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-96 bg-primary/10 blur-3xl"
          />
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 py-24 text-center">
            <Badge variant="outline" className="gap-1.5">
              <ShieldCheck className="size-3.5" />
              Compliant competitor research for iGaming
            </Badge>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              See where competitors beat you in the player journey — and what
              to do next
            </h1>
            <p className="max-w-2xl text-balance text-lg text-muted-foreground">
              PlayerScope AI is an AI CX researcher and mystery shopper for
              iGaming brands. It walks the journeys your players walk, scores
              them against competitors, and turns the gaps into product
              direction.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" nativeButton={false} render={<Link href="/projects/new" />}>
                Analyze your brand
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                nativeButton={false} render={<Link href="/projects/demo/overview" />}
              >
                View example dashboard
              </Button>
            </div>
          </div>
        </section>

        <Separator />

        {/* How it works */}
        <section className="mx-auto w-full max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold tracking-tight">
            How it works
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Card key={step.title}>
                <CardHeader>
                  <span className="text-sm font-medium text-primary">
                    Step {i + 1}
                  </span>
                  <CardTitle>{step.title}</CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        {/* Metrics */}
        <section className="mx-auto w-full max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold tracking-tight">
            Flagship metrics
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Not another crawler. PlayerScope scores the things executives
            actually argue about: retention, money-moment trust and strategic
            position.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {METRICS.map((metric) => {
              const Icon = metric.icon;
              return (
                <Card key={metric.title}>
                  <CardHeader>
                    <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <CardTitle>{metric.title}</CardTitle>
                    <CardDescription>{metric.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section>

        <Separator />

        {/* Evidence + report */}
        <section className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
                  <Camera className="size-5 text-primary" />
                </div>
                <CardTitle>Evidence, not opinions</CardTitle>
                <CardDescription>
                  Every finding is backed by screenshots, session replays and
                  step-by-step journey timelines. When the report says a
                  competitor makes deposits feel safer, you can see exactly
                  why.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
                  <FileText className="size-5 text-primary" />
                </div>
                <CardTitle>A report a CEO forwards</CardTitle>
                <CardDescription>
                  Executive summary, competitor strategy read, journey
                  scorecard, feature gaps and a roadmap split into fix now,
                  improve next and strategic bets.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden border-t">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-primary/10 blur-3xl"
          />
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5 px-6 py-20 text-center">
            <Route className="size-8 text-primary" />
            <h2 className="text-balance text-3xl font-semibold tracking-tight">
              Stop guessing why players choose competitors
            </h2>
            <p className="max-w-xl text-muted-foreground">
              Run your first audit with your brand and three competitors. See
              the gaps through your player&apos;s eyes.
            </p>
            <Button size="lg" nativeButton={false} render={<Link href="/projects/new" />}>
              Create your first project
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-6 py-6 text-sm text-muted-foreground">
          <span>PlayerScope AI</span>
          <span aria-hidden>·</span>
          <span>
            Compliant competitor research and authorised mystery shopping. The
            platform pauses at CAPTCHAs, KYC, payment confirmation and any
            access-control barrier.
          </span>
        </div>
      </footer>
    </div>
  );
}
