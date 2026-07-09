import { cn } from "@/lib/utils";

export function ScuupMark({
  className,
  size = "default",
}: {
  className?: string;
  size?: "default" | "lg";
}) {
  return (
    <span
      className={cn(
        "font-heading font-semibold tracking-tight text-foreground",
        size === "default" && "text-lg",
        size === "lg" && "text-xl",
        className
      )}
    >
      Scuup
      <span className="scuup-blink text-primary">.</span>
    </span>
  );
}
