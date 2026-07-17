"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "scuup-alpha-notice-v1";

/**
 * One-time early-access toast on first visit. Dismissed state is remembered
 * per browser so it doesn't nag again. Remove from the root layout when
 * alpha ends.
 */
export function AlphaNotice() {
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "dismissed") return;
    } catch {
      /* show anyway if storage is blocked */
    }

    toast.message("We are in early access", {
      id: "alpha-notice",
      description:
        "Reports are real, but you may hit rough edges. Tell us if something breaks.",
      duration: Infinity,
      action: {
        label: "Report an issue",
        onClick: () => {
          try {
            localStorage.setItem(STORAGE_KEY, "dismissed");
          } catch {
            /* ignore */
          }
          window.location.assign("/#contact");
        },
      },
      onDismiss: () => {
        try {
          localStorage.setItem(STORAGE_KEY, "dismissed");
        } catch {
          /* ignore */
        }
      },
    });
  }, []);

  return null;
}
