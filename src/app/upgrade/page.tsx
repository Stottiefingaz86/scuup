import Link from "next/link";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { ScuupLogo } from "@/components/scuup-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PRO_FEATURES = [
  "Unlimited competitor reports",
  "All player journeys, every market",
  "Logged-in audits with test accounts",
  "Action plans and gap comparisons",
  "Priority analysis queue",
];

export default function UpgradePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <ScuupLogo />

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            You&apos;ve used your free report
          </CardTitle>
          <CardDescription>
            Free accounts include one full competitor audit. Upgrade to Pro to
            keep benchmarking.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ul className="flex flex-col gap-2.5">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                {f}
              </li>
            ))}
          </ul>

          <div className="flex items-baseline gap-1.5 rounded-lg border bg-muted/30 px-4 py-3">
            <span className="font-heading text-3xl font-semibold">$249</span>
            <span className="text-sm text-muted-foreground">/ month</span>
          </div>

          <Button size="lg" className="w-full glow-primary" disabled>
            <Sparkles data-icon="inline-start" />
            Upgrade to Pro — coming soon
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Payments aren&apos;t live yet. Contact us to get early Pro access.
          </p>

          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/dashboard" />}
          >
            <ArrowLeft data-icon="inline-start" />
            Back to dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
