"use client";

import { useEffect, useState } from "react";
import { FlaskConical, X } from "lucide-react";

/** Bump to re-show the banner after a meaningful alpha milestone. */
const STORAGE_KEY = "scuup-alpha-banner-v1";

/**
 * Slim site-wide notice that Scuup is in alpha. Dismissible per browser;
 * remove this component from the root layout when alpha ends.
 */
export function AlphaBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(STORAGE_KEY) !== "dismissed");
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "dismissed");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  return (
    <div
      role="status"
      className="relative z-50 border-b border-amber-500/25 bg-amber-500/10 text-amber-100"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2.5 px-4 py-2 pe-10 sm:px-6">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-amber-300">
          <FlaskConical className="size-3" />
          Alpha
        </span>
        <p className="min-w-0 truncate text-xs leading-relaxed text-amber-100/90 sm:text-[13px]">
          Scuup is in early access. Reports are real, but you may hit rough
          edges while we polish.
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss alpha notice"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-amber-200/70 transition-colors hover:bg-amber-400/15 hover:text-amber-100"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
