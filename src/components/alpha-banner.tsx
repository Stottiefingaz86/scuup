import Link from "next/link";
import { FlaskConical, MessageSquareWarning } from "lucide-react";

/**
 * Slim site-wide notice that Scuup is in early access, with a shortcut to
 * report problems via the contact form. Sticky so app chrome (fixed sidebar,
 * sticky headers) can offset below `--alpha-banner-height`. Remove from the
 * root layout and zero that CSS variable when alpha ends.
 */
export function AlphaBanner() {
  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex h-(--alpha-banner-height) shrink-0 items-center border-b border-amber-500/25 bg-amber-500/10 text-amber-100"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-center gap-2.5 px-3 sm:gap-3 sm:px-6">
        <p className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs text-amber-100/90 sm:text-[13px]">
          <FlaskConical className="size-3.5 shrink-0 text-amber-300" />
          We are in early access
        </p>
        <Link
          href="/#contact"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-200 transition-colors hover:bg-amber-400/25 hover:text-amber-100"
        >
          <MessageSquareWarning className="size-3" />
          Report an issue
        </Link>
      </div>
    </div>
  );
}
