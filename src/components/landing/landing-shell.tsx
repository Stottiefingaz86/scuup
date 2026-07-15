import { cn } from "@/lib/utils";

/** Marketing shell, same dark navy theme as the app, so the landing page
 * looks like the product it's selling. */
export function LandingShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-screen overflow-x-clip bg-background text-foreground", className)}>
      {children}
    </div>
  );
}
