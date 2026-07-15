import { cn } from "@/lib/utils";

/** Verdict-first summary: the first sentence carries the judgement, the rest
 * is supporting detail, render them with different visual weight. */
export function Verdict({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const match = text.match(/^([\s\S]*?[.!?])\s+([\s\S]*)$/);
  if (!match) {
    return (
      <p className={cn("text-sm leading-relaxed text-foreground/90", className)}>
        {text}
      </p>
    );
  }
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="text-sm font-medium leading-relaxed text-foreground">
        {match[1]}
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {match[2]}
      </p>
    </div>
  );
}
