"use client";

import { useEffect, useState } from "react";
import { update } from "@intercom/messenger-js-sdk";
import { useLegalDialog } from "@/components/landing/landing-legal-dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "scuup-cookie-consent";
/** Keep the Intercom launcher clear of this bar while it's visible. */
const INTERCOM_CLEARANCE_PX = 96;

export function CookieConsent() {
  const [show, setShow] = useState(false);
  const { openLegal } = useLegalDialog();

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "accepted") {
        setShow(true);
      }
    } catch {
      setShow(true);
    }
  }, []);

  // Lift Intercom above the cookie bar so Accept stays clickable.
  useEffect(() => {
    if (!show) return;
    try {
      update({ vertical_padding: INTERCOM_CLEARANCE_PX });
    } catch {
      /* Intercom may not be booted yet */
    }
    return () => {
      try {
        update({ vertical_padding: 20 });
      } catch {
        /* ignore */
      }
    };
  }, [show]);

  if (!show) return null;

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 p-4 shadow-[0_-12px_40px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md sm:p-5"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 pe-16 sm:flex-row sm:items-center sm:justify-between sm:pe-20">
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          We use essential cookies to keep you signed in and remember preferences.
          See our{" "}
          <button
            type="button"
            onClick={() => openLegal("cookies")}
            className="text-foreground underline-offset-4 hover:underline"
          >
            Cookie Policy
          </button>{" "}
          for details.
        </p>
        <Button type="button" size="sm" className="shrink-0 self-start sm:self-auto" onClick={accept}>
          Accept
        </Button>
      </div>
    </div>
  );
}
