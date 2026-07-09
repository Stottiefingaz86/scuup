"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import {
  Coins,
  Gift,
  MonitorPlay,
  Radio,
  Route,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnimatedTabs } from "@/components/animated-tabs";
import { ProjectShell } from "@/components/project-shell";
import { formatElapsed } from "@/components/live-capture-dialog";
import type { CaptureEvent, CaptureRecord, Project } from "@/lib/types";

const KIND_ICON: Record<CaptureEvent["kind"], typeof Coins> = {
  money: Coins,
  reward: Gift,
  screen: Route,
  info: MonitorPlay,
};

function SessionCard({ session }: { session: CaptureRecord }) {
  const [open, setOpen] = useState(false);
  const moneyCount = session.events.filter((e) => e.kind === "money").length;
  const rewardCount = session.events.filter((e) => e.kind === "reward").length;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full cursor-pointer text-left"
      >
        <CardHeader>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <CardTitle className="text-base">{session.brandName}</CardTitle>
            <span className="text-xs text-muted-foreground">
              {new Date(session.date).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
            <span className="ms-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span>{formatElapsed(session.durationSec)} recorded</span>
              <span className="flex items-center gap-1">
                <Coins className="size-3.5 text-primary" />
                {moneyCount}
              </span>
              <span className="flex items-center gap-1">
                <Gift className="size-3.5 text-brand" />
                {rewardCount}
              </span>
            </span>
          </div>
        </CardHeader>
      </button>
      {open ? (
        <CardContent>
          <ol className="flex flex-col gap-2 border-s ps-4">
            {session.events.map((event, i) => {
              const Icon = KIND_ICON[event.kind];
              return (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-10 shrink-0 pt-0.5 text-end font-mono text-[11px] tabular-nums text-muted-foreground/60">
                    {formatElapsed(event.at)}
                  </span>
                  <Icon
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      event.kind === "reward"
                        ? "text-brand"
                        : event.kind === "money"
                          ? "text-primary"
                          : "text-muted-foreground"
                    )}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm text-foreground/90">
                      {event.label}
                    </span>
                    {event.detail ? (
                      <span className="truncate text-xs text-muted-foreground/70">
                        {event.detail}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </CardContent>
      ) : null}
    </Card>
  );
}

function SessionsContent({ project }: { project: Project }) {
  const [brandFilter, setBrandFilter] = useState("all");
  const brandsWithSessions = project.brands.filter((b) =>
    project.sessions.some((s) => s.brandId === b.id)
  );
  const filtered =
    brandFilter === "all"
      ? project.sessions
      : project.sessions.filter((s) => s.brandId === brandFilter);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="size-4 text-brand" />
            Live sessions
          </CardTitle>
          <CardDescription>
            Every recorded capture session with its full event timeline —
            deposits, bets, rewards and navigation, exactly as detected.
          </CardDescription>
        </CardHeader>
        {project.sessions.length === 0 ? (
          <CardContent>
            <p className="py-2 text-sm text-muted-foreground">
              No sessions recorded yet. Launch any brand from a Launch button
              — the recorder detects money movements and rewards while you
              play, and saved sessions land here.
            </p>
          </CardContent>
        ) : null}
      </Card>

      {project.sessions.length > 0 ? (
        <>
          {brandsWithSessions.length > 1 ? (
            <AnimatedTabs
              tabs={[
                { value: "all", label: "All brands" },
                ...brandsWithSessions.map((b) => ({
                  value: b.id,
                  label: b.name,
                })),
              ]}
              value={brandFilter}
              onValueChange={setBrandFilter}
            />
          ) : null}
          <div className="flex flex-col gap-4">
            {filtered.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function SessionsPage() {
  const params = useParams<{ id: string }>();
  return (
    <ProjectShell projectId={params.id}>
      {(project) => <SessionsContent project={project} />}
    </ProjectShell>
  );
}
