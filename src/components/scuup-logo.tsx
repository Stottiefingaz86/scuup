import Link from "next/link";
import { ScuupMark } from "@/components/scuup-mark";
import { cn } from "@/lib/utils";

export function ScuupLogo({
  href = "/",
  className,
  size = "default",
}: {
  href?: string;
  className?: string;
  size?: "default" | "lg";
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center", className)}>
      <ScuupMark size={size} />
    </Link>
  );
}
