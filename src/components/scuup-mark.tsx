import { cn } from "@/lib/utils";

/** Brand wordmark from /public/logo.svg (icon + Scuup). */
export function ScuupMark({
  className,
  size = "default",
}: {
  className?: string;
  size?: "default" | "lg";
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand SVG wordmark
    <img
      src="/logo.svg"
      alt="Scuup"
      width={116}
      height={41}
      className={cn(
        "h-auto w-auto",
        size === "default" && "h-7",
        size === "lg" && "h-8",
        className
      )}
    />
  );
}
