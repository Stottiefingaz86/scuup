"use client";

import { useEffect, useRef, useState } from "react";
import {
  Clock,
  Coins,
  CreditCard,
  ExternalLink,
  Gift,
  KeyRound,
  MonitorPlay,
  Route,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ANALYSIS_AREA_LABELS } from "@/lib/constants";
import { getProject, refreshProjects } from "@/lib/project-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Brand, CaptureEvent } from "@/lib/types";

const CAPTURED = [
  {
    icon: MonitorPlay,
    title: "Screens & states",
    detail: "Every page and cashier state, screenshotted as you move.",
  },
  {
    icon: Route,
    title: "Journey steps",
    detail: "The path you take, taps, transitions and dead ends.",
  },
  {
    icon: Coins,
    title: "Bets & stakes",
    detail: "Every bet placed, stake size and settled result.",
  },
  {
    icon: Gift,
    title: "Value-back",
    detail: "Rakeback, boosts, rebates and level progress as they credit.",
  },
  {
    icon: Clock,
    title: "Timings",
    detail: "Step durations, plus promised vs actual processing times.",
  },
];

const NEVER_STORED = [
  {
    icon: KeyRound,
    title: "Passwords & secure keystrokes",
    detail: "Input in credential fields is never logged.",
  },
  {
    icon: CreditCard,
    title: "Card numbers",
    detail: "Payment details are auto-redacted in every stored frame.",
  },
];

export function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** Messages posted from the capture popup back to the platform window. */
export type CaptureMessage =
  | {
      type: "capture-saved";
      brand: string;
      elapsed: number;
      /** True when a real remote browser session was recorded. */
      live: boolean;
      events: CaptureEvent[];
      /** Journey areas that were scored from this session's screenshots. */
      scoredAreas: string[];
    }
  | { type: "capture-discarded" };

export function LiveCaptureDialog({
  brand,
  projectId,
  onClose,
}: {
  brand: Brand | null;
  projectId: string;
  onClose: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const openPopup = () => {
    if (!brand) return;
    const existing = popupRef.current;
    if (existing && !existing.closed) {
      existing.focus();
      return;
    }
    const width = Math.min(1500, window.screen.availWidth - 100);
    const height = Math.min(920, window.screen.availHeight - 60);
    const market = getProject(projectId)?.market ?? "";
    const href = `/capture?name=${encodeURIComponent(brand.name)}&url=${encodeURIComponent(brand.url)}&projectId=${encodeURIComponent(projectId)}&brandId=${encodeURIComponent(brand.id)}&market=${encodeURIComponent(market)}`;
    popupRef.current = window.open(
      href,
      `capture-${brand.id}`,
      `popup=yes,width=${width},height=${height},left=50,top=30`
    );
  };

  // While a session runs, the platform window just waits for the popup to
  // report back (saved / discarded / closed).
  useEffect(() => {
    if (!recording) return;

    const cleanup = () => {
      popupRef.current = null;
      setRecording(false);
      onClose();
    };

    // The popup persists the session and its scores server-side; pull the
    // fresh data into this window so scores appear without a reload.
    const onMessage = (e: MessageEvent<CaptureMessage>) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "capture-saved") {
        void refreshProjects();
        if (e.data.live) {
          const scored = e.data.scoredAreas ?? [];
          toast.success("Session saved", {
            description:
              scored.length > 0
                ? `${formatElapsed(e.data.elapsed)} of ${e.data.brand} captured. Scored: ${scored
                    .map((a) => ANALYSIS_AREA_LABELS[a] ?? a)
                    .join(", ")}.`
                : `${formatElapsed(e.data.elapsed)} of ${e.data.brand} captured, ${e.data.events.length} events recorded. No scoreable journey pages were visited.`,
            duration: 8000,
          });
        } else {
          toast.info("Nothing saved", {
            description:
              "No live browser session was active, so there was no real data to keep.",
          });
        }
        cleanup();
      } else if (e.data?.type === "capture-discarded") {
        cleanup();
      }
    };

    const poll = setInterval(() => {
      if (popupRef.current?.closed) {
        // Closed via the X, the popup still saved server-side on pagehide.
        void refreshProjects();
        cleanup();
      }
    }, 1000);

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearInterval(poll);
    };
  }, [recording, onClose, brand, projectId]);

  const start = () => {
    openPopup();
    setRecording(true);
  };

  const cancel = () => {
    popupRef.current?.close();
    popupRef.current = null;
    setRecording(false);
    onClose();
  };

  return (
    <Dialog
      open={brand !== null && !recording}
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Live capture, {brand?.name}</DialogTitle>
          <DialogDescription>
            The site opens in a desktop-size capture window with the
            recording dock alongside it. Use your own account and play as a
            normal customer, everything is recorded in that window.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              What we capture
            </span>
            {CAPTURED.map(({ icon: Icon, title, detail }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Icon className="size-3.5" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{title}</span>
                  <span className="text-xs text-muted-foreground">
                    {detail}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Never stored
            </span>
            {NEVER_STORED.map(({ icon: Icon, title, detail }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-3.5" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{title}</span>
                  <span className="text-xs text-muted-foreground">
                    {detail}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-brand" />
            Encrypted at rest · saved to your Evidence Library · delete any
            session at any time.
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={cancel}>
            Cancel
          </Button>
          <Button onClick={start}>
            <ExternalLink data-icon="inline-start" />
            Launch & start recording
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
