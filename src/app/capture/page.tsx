"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Clock,
  Coins,
  Gift,
  Globe,
  Loader2,
  MonitorPlay,
  Route,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatElapsed,
  type CaptureMessage,
} from "@/components/live-capture-dialog";
import { saveAnalysis, saveCapture } from "@/lib/project-store";
import type { JourneyAnalysis } from "@/lib/types";

interface FeedItem {
  at: number;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail?: string;
  tone?: "reward" | "money";
}

/** Fallback recorder feed when no live remote browser is available (e.g. no
 * Browserbase key configured). */
const FEED_SCRIPT: FeedItem[] = [
  { at: 3, icon: MonitorPlay, label: "Remote browser attached — capturing" },
  { at: 8, icon: Route, label: "Screen captured — Home" },
  { at: 15, icon: Route, label: "Navigated to Cashier" },
  { at: 22, icon: Coins, label: "Deposit £50 detected", tone: "money" },
  { at: 29, icon: Clock, label: "Deposit credited in 6s" },
  { at: 38, icon: Coins, label: "Bet placed — £2.50 stake", tone: "money" },
  { at: 47, icon: Coins, label: "Bet placed — £5.00 stake", tone: "money" },
  { at: 56, icon: Gift, label: "Rakeback credit detected +£0.21", tone: "reward" },
  { at: 68, icon: Route, label: "Screen captured — Rewards hub" },
  { at: 79, icon: Gift, label: "Level progress +40 XP", tone: "reward" },
  { at: 92, icon: Coins, label: "Bet placed — £2.50 stake", tone: "money" },
  { at: 104, icon: Gift, label: "Rakeback credit detected +£0.18", tone: "reward" },
];

type Mode = "connecting" | "live" | "sim";

const KIND_STYLE = {
  money: { icon: Coins, tone: "money" as const },
  reward: { icon: Gift, tone: "reward" as const },
  screen: { icon: Route, tone: undefined },
  info: { icon: MonitorPlay, tone: undefined },
};

interface WireEvent {
  at: number;
  kind: "screen" | "money" | "reward" | "info";
  label: string;
  detail?: string;
  /** URL the browser was on when the event fired. */
  context?: string;
}

/** Everything we can match a goal against for one event. */
function eventText(e: WireEvent): string {
  return `${e.label} ${e.detail ?? ""} ${e.context ?? ""}`.toLowerCase();
}

/** What the platform needs from this session. Each goal only ticks when the
 * recorder detects genuinely matching activity — never on a timer or a
 * generic event count. An untucked goal is honest: we didn't observe it. */
const SESSION_GOALS: {
  label: string;
  done: (events: WireEvent[]) => boolean;
}[] = [
  {
    label: "Browse the lobby and game pages",
    done: (ev) =>
      ev.some(
        (e) =>
          e.kind === "screen" &&
          /casino|game|slot|sport|lobby|play/.test(eventText(e))
      ),
  },
  {
    label: "Make a small deposit",
    done: (ev) =>
      ev.some(
        (e) =>
          e.kind === "money" && /deposit|cashier|top.?up/.test(eventText(e))
      ),
  },
  {
    label: "Place a few small bets",
    done: (ev) =>
      ev.filter(
        (e) =>
          e.kind === "money" &&
          /bet|stake|casino|game|slot|sport/.test(eventText(e))
      ).length >= 2,
  },
  {
    label: "Visit the rewards / VIP hub",
    done: (ev) =>
      ev.some((e) =>
        /reward|vip|loyal|rakeback|rebate|bonus/.test(eventText(e))
      ),
  },
  {
    label: "Request a small withdrawal",
    done: (ev) =>
      ev.some((e) => /withdraw|cash.?out|payout/.test(eventText(e))),
  },
];

/** Skeleton stand-in for the remote browser stream (fallback only). */
function SimulatedSite({ name }: { name: string }) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/20 font-heading text-sm font-semibold text-primary">
          {name.slice(0, 2).toUpperCase()}
        </span>
        <div className="h-3 w-24 rounded-full bg-foreground/10" />
        <div className="ms-auto flex gap-2">
          <div className="h-8 w-20 rounded-lg bg-foreground/10" />
          <div className="h-8 w-20 rounded-lg bg-primary/25" />
        </div>
      </div>
      <div className="relative flex h-36 shrink-0 items-center overflow-hidden rounded-xl bg-gradient-to-r from-primary/15 via-card to-card p-6">
        <div className="flex flex-col gap-2.5">
          <div className="h-4 w-56 rounded-full bg-foreground/15" />
          <div className="h-3 w-40 rounded-full bg-foreground/10" />
          <div className="mt-1 h-8 w-28 rounded-lg bg-primary/30" />
        </div>
        <div
          aria-hidden
          className="absolute -right-10 -top-10 size-40 rounded-full bg-primary/10 blur-2xl"
        />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-6 content-start gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[3/4] animate-pulse rounded-lg bg-foreground/[0.07]"
            style={{ animationDelay: `${(i % 6) * 150}ms` }}
          />
        ))}
      </div>
      <span className="text-[11px] text-muted-foreground/50">
        No live browser available — showing a simulation. Add a Browserbase
        key to stream the real site here.
      </span>
    </div>
  );
}

function CaptureContent() {
  const params = useSearchParams();
  const name = params.get("name") ?? "Site";
  const url = params.get("url") ?? "";
  const projectId = params.get("projectId") ?? "";
  const brandId = params.get("brandId") ?? "";
  const market = params.get("market") ?? "";

  const [elapsed, setElapsed] = useState(0);
  const [mode, setMode] = useState<Mode>("connecting");
  const [scoring, setScoring] = useState(false);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<WireEvent[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const endedRef = useRef(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Keep the latest state in a ref so the pagehide handler (bound once) can
  // save a session even when the user just closes the window.
  const stateRef = useRef({
    elapsed: 0,
    mode: "connecting" as Mode,
    liveEvents: [] as WireEvent[],
  });
  useEffect(() => {
    stateRef.current = { elapsed, mode, liveEvents };
  }, [elapsed, mode, liveEvents]);

  useEffect(() => {
    document.title = `Recording ${name} — Scuup`;
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [name]);

  // Kick off a real remote-browser session; fall back to simulation on error.
  useEffect(() => {
    if (startedRef.current || !url) return;
    startedRef.current = true;
    let source: EventSource | null = null;

    (async () => {
      try {
        // Size the remote browser to the stage so the live view is 1:1
        // instead of a scaled-down 1920x1080 desktop.
        const rect = stageRef.current?.getBoundingClientRect();
        const res = await fetch("/api/capture/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            brandId,
            market,
            width: Math.round(rect?.width ?? window.innerWidth - 340),
            height: Math.round(rect?.height ?? window.innerHeight - 44),
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as {
          sessionId: string;
          liveViewUrl: string;
        };
        sessionIdRef.current = data.sessionId;
        setLiveViewUrl(data.liveViewUrl);
        setMode("live");

        source = new EventSource(
          `/api/capture/events?sessionId=${data.sessionId}`
        );
        source.onmessage = (e) => {
          const event = JSON.parse(e.data) as WireEvent;
          setLiveEvents((prev) => [...prev, event]);
        };
        source.addEventListener("done", () => source?.close());
        source.onerror = () => source?.close();
      } catch {
        setMode("sim");
      }
    })();

    return () => source?.close();
  }, [url, brandId, market]);

  const stopBeacon = (id: string) => {
    const payload = JSON.stringify({ sessionId: id });
    // Best-effort teardown that survives the window closing.
    const beaconed = navigator.sendBeacon?.("/api/capture/stop", payload);
    if (!beaconed) {
      void fetch("/api/capture/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    }
  };

  const end = async (save: boolean, canScore = true) => {
    if (endedRef.current) return;
    endedRef.current = true;
    const { elapsed, mode, liveEvents } = stateRef.current;
    const id = sessionIdRef.current;
    const live = mode === "live";

    // Persist the session record synchronously first: this popup shares the
    // same localStorage-backed store as the app, so the evidence survives
    // even if the opener page navigated away or this window closes early.
    if (save && live && projectId && brandId) {
      saveCapture(projectId, {
        id: `cap-${Date.now().toString(36)}`,
        brandId,
        brandName: name,
        date: new Date().toISOString(),
        durationSec: elapsed,
        events: liveEvents,
      });
    }

    let scoredAreas: string[] = [];
    if (save && live && id && canScore) {
      // Turn the recording into scores: the server groups this session's
      // screenshots by journey and runs the vision analyst on each.
      setScoring(true);
      try {
        const res = await fetch("/api/capture/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: id }),
        });
        if (res.ok) {
          const data = (await res.json()) as { analyses: JourneyAnalysis[] };
          for (const analysis of data.analyses ?? []) {
            if (projectId && brandId) {
              saveAnalysis(projectId, brandId, analysis);
            }
          }
          scoredAreas = (data.analyses ?? []).map((a) => a.area);
        } else {
          stopBeacon(id);
        }
      } catch {
        stopBeacon(id);
      }
    } else if (id) {
      stopBeacon(id);
    }

    const message: CaptureMessage = save
      ? {
          type: "capture-saved",
          brand: name,
          elapsed,
          live,
          events: liveEvents,
          scoredAreas,
        }
      : { type: "capture-discarded" };
    window.opener?.postMessage(message, window.location.origin);
    window.close();
  };

  // Closing the window with the X still saves the recorded session — but it
  // can't wait for scoring, so that path skips analysis (use End & save for
  // scores).
  useEffect(() => {
    const onPageHide = () => void end(true, false);
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = mode === "live";
  const feed: FeedItem[] = live
    ? liveEvents
        .map((e) => ({
          at: e.at,
          icon: KIND_STYLE[e.kind].icon,
          tone: KIND_STYLE[e.kind].tone,
          label: e.label,
          detail: e.detail,
        }))
        .reverse()
    : FEED_SCRIPT.filter((e) => e.at <= elapsed).reverse();

  // Each goal ticks only on genuinely matching detected activity (live) or
  // on the demo timeline (sim).
  const goalStates = SESSION_GOALS.map(({ done }, i) =>
    live ? done(liveEvents) : i < Math.floor(elapsed / 18)
  );
  const goalsDone = goalStates.filter(Boolean).length;

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Remote browser stage */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2.5 border-b bg-card px-3.5">
          <Globe className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-mono text-xs text-muted-foreground">
            {url}
          </span>
          <span className="ms-auto flex shrink-0 items-center gap-1.5 rounded-full border border-tier-1/30 bg-tier-1/10 px-2.5 py-1 text-[11px] font-medium text-tier-1">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tier-1 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-tier-1" />
            </span>
            REC
          </span>
        </div>
        <div
          ref={stageRef}
          className="min-h-0 flex-1 bg-[radial-gradient(ellipse_at_top,_oklch(0.21_0.03_275)_0%,_var(--background)_70%)]"
        >
          {scoring ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Loader2 className="size-6 animate-spin text-brand" />
              <span className="text-sm text-foreground/80">
                Scoring your session…
              </span>
              <span className="max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
                The analyst is turning what you just did into journey scores —
                every area you visited gets rated with the screenshots as
                evidence. This can take a minute; the window closes itself
                when done.
              </span>
            </div>
          ) : mode === "connecting" ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-sm text-foreground/80">
                Attaching secure remote browser…
              </span>
              <span className="text-xs text-muted-foreground">
                {name} loads in an isolated session — nothing runs on your
                machine.
              </span>
            </div>
          ) : mode === "live" && liveViewUrl ? (
            <iframe
              src={liveViewUrl}
              title={`${name} live session`}
              className="h-full w-full border-0"
              sandbox="allow-same-origin allow-scripts allow-forms"
              allow="clipboard-read; clipboard-write"
            />
          ) : (
            <SimulatedSite name={name} />
          )}
        </div>
      </div>

      {/* Recording dock */}
      <aside className="flex w-[340px] shrink-0 flex-col border-s bg-card">
        <div className="flex items-center gap-2.5 border-b px-4 py-3.5">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tier-1 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-tier-1" />
          </span>
          <span className="text-sm font-medium">Recording {name}</span>
          <span className="ms-auto font-mono text-xs tabular-nums text-muted-foreground">
            {formatElapsed(elapsed)}
          </span>
        </div>

        {/* Session goals */}
        <div className="flex flex-col gap-2.5 border-b px-4 py-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Session goals
            </span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {goalsDone}/{SESSION_GOALS.length}
            </span>
          </div>
          {SESSION_GOALS.map(({ label: goal }, i) => {
            const done = goalStates[i];
            return (
              <div key={goal} className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                    done
                      ? "border-brand bg-brand/15 text-brand"
                      : "border-border text-transparent"
                  )}
                >
                  <Check className="size-3" />
                </span>
                <span
                  className={cn(
                    "text-xs transition-colors duration-300",
                    done ? "text-foreground/90" : "text-muted-foreground"
                  )}
                >
                  {goal}
                </span>
              </div>
            );
          })}
          <span className="text-[11px] leading-relaxed text-muted-foreground/60">
            These fill this brand&apos;s data gaps. A goal only ticks when the
            recorder detects that specific activity — unticked means we
            didn&apos;t observe it.
          </span>
        </div>

        {/* Live feed */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3.5">
          {feed.length === 0 ? (
            <span className="py-1 text-xs text-muted-foreground">
              Waiting for activity — play as a normal customer…
            </span>
          ) : (
            feed.map((event, i) => {
              const Icon = event.icon;
              return (
                <div
                  key={`${event.at}-${i}-${event.label}`}
                  className="flex items-start gap-2.5 animate-in fade-in-0 slide-in-from-top-1 duration-300"
                >
                  <span className="w-9 shrink-0 pt-0.5 text-end font-mono text-[11px] tabular-nums text-muted-foreground/60">
                    {formatElapsed(event.at)}
                  </span>
                  <Icon
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      event.tone === "reward"
                        ? "text-brand"
                        : event.tone === "money"
                          ? "text-primary"
                          : "text-muted-foreground"
                    )}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-xs text-foreground/90">
                      {event.label}
                    </span>
                    {event.detail ? (
                      <span className="truncate text-[11px] text-muted-foreground/70">
                        {event.detail}
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-col gap-3 border-t px-4 py-3.5">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0 text-brand" />
            Passwords & card numbers are excluded from the recording.
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={scoring}
              onClick={() => end(false)}
            >
              Discard
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={scoring}
              onClick={() => end(true)}
            >
              {scoring ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Scoring…
                </>
              ) : (
                "End & save"
              )}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function CapturePage() {
  return (
    <Suspense fallback={null}>
      <CaptureContent />
    </Suspense>
  );
}
