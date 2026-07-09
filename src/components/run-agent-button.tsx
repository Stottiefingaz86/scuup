"use client";

import { useState } from "react";
import { Bot, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { agentKey, friendlyAgentError, runAgent, useRunningAgents } from "@/lib/run-agent";
import type { Brand } from "@/lib/types";

/** Kicks off an autonomous agent analysis for one brand+area. */
export function RunAgentButton({
  projectId,
  brand,
  area,
  label = "Run agent",
  className,
  variant = "default",
  size = "sm",
}: {
  projectId: string;
  brand: Pick<Brand, "id" | "url" | "name">;
  area: string;
  label?: string;
  className?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "default";
}) {
  const running = useRunningAgents();
  const isRunning = running.includes(agentKey(brand.id, area));
  const [failed, setFailed] = useState(false);

  return (
    <Button
      size={size}
      variant={variant}
      disabled={isRunning}
      className={cn("gap-1.5", className)}
      onClick={(e) => {
        e.stopPropagation();
        setFailed(false);
        runAgent(projectId, brand, area).catch((err: Error) => {
          setFailed(true);
          toast.error(`Agent couldn't run on ${brand.name}`, {
            description: friendlyAgentError(err),
            duration: 10000,
          });
        });
      }}
    >
      {isRunning ? (
        <LoaderCircle className="size-3.5 animate-spin" />
      ) : (
        <Bot className="size-3.5" />
      )}
      {isRunning ? "Agent running…" : failed ? "Failed — retry" : label}
    </Button>
  );
}
