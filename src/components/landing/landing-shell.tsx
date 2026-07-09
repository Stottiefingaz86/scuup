import { cn } from "@/lib/utils";

/** Forces light marketing tokens while the app shell stays dark. */
export function LandingShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("scuup-landing min-h-screen bg-background text-foreground", className)}>
      {children}
    </div>
  );
}
