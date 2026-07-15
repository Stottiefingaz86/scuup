"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Starts Stripe Checkout for a paid plan. */
export function UpgradeButton({
  plan,
  variant = "default",
  className,
  children,
}: {
  plan: "pro" | "pro_plus";
  variant?: "default" | "outline";
  className?: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Couldn't start checkout.");
      }
      window.location.href = data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start checkout.");
      setLoading(false);
    }
  }

  return (
    <Button
      size="lg"
      variant={variant}
      className={className}
      onClick={startCheckout}
      disabled={loading}
    >
      {loading ? (
        <Loader2 data-icon="inline-start" className="animate-spin" />
      ) : (
        <Sparkles data-icon="inline-start" />
      )}
      {children}
    </Button>
  );
}

/** Opens the Stripe customer portal for card changes and cancellation. */
export function ManageBillingButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Couldn't open billing.");
      }
      window.location.href = data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open billing.");
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      className={className}
      onClick={openPortal}
      disabled={loading}
    >
      {loading ? (
        <Loader2 data-icon="inline-start" className="animate-spin" />
      ) : null}
      Manage subscription
    </Button>
  );
}
