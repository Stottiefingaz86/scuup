import Link from "next/link";
import { LandingShell } from "@/components/landing/landing-shell";
import { ScuupMark } from "@/components/landing/scuup-mark";
import { Separator } from "@/components/ui/separator";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <LandingShell>
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center px-6 py-5">
          <Link href="/">
            <ScuupMark />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-20">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brand">
          Legal
        </p>
        <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
        <Separator className="my-8" />
        <div className="prose-legal flex flex-col gap-5 text-sm leading-relaxed text-muted-foreground [&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:ps-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
          {children}
        </div>
        <Separator className="my-10" />
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/cookies" className="hover:text-foreground">
            Cookies
          </Link>
          <Link href="/" className="hover:text-foreground">
            Back to home
          </Link>
        </nav>
      </main>
    </LandingShell>
  );
}
