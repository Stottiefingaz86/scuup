"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PRO_PLUS_PRICE_MONTHLY,
  PRO_PRICE_MONTHLY,
  type Plan,
} from "@/lib/plan";

type FormState = "idle" | "submitting" | "success" | "error";

export type ContactSalesPlan = Extract<Plan, "pro" | "pro_plus">;

export function contactSalesHref(plan: ContactSalesPlan): string {
  return `/?plan=${plan}#contact`;
}

function salesMessageFor(plan: ContactSalesPlan): string {
  if (plan === "pro_plus") {
    return `Hi, I'm interested in the Pro Plus plan (€${PRO_PLUS_PRICE_MONTHLY}/month). Please get in touch about getting five reports set up for our team.`;
  }
  return `Hi, I'm interested in the Pro plan (€${PRO_PRICE_MONTHLY}/month). Please get in touch about upgrading for competitor benchmarks and monthly refreshes.`;
}

function planFromParam(value: string | null): ContactSalesPlan | null {
  if (value === "pro" || value === "pro_plus") return value;
  return null;
}

export function LandingContact() {
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState("");

  // Pre-fill from Contact sales CTAs: /?plan=pro#contact
  useEffect(() => {
    const plan = planFromParam(searchParams.get("plan"));
    if (!plan) return;
    setMessage(salesMessageFor(plan));
    setState("idle");
    requestAnimationFrame(() => {
      document
        .getElementById("contact")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("contact-message")?.focus();
    });
  }, [searchParams]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setError(null);

    const form = e.currentTarget;
    const website = new FormData(form).get("website");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, message, website }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setState("error");
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setState("success");
      const sentTo = email.trim();
      setName("");
      setEmail("");
      setCompany("");
      setMessage("");
      setSuccessEmail(sentTo);
    } catch {
      setState("error");
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <section id="contact" className="border-t border-border bg-card/40 py-20 sm:py-28">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
        <LandingReveal className="max-w-md">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brand">
            Contact
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Questions about Scuup?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Tell us about your market, competitors, or what you want to
            benchmark. We&apos;ll get back to you within one business day.
          </p>
        </LandingReveal>

        <LandingReveal delay={120}>
          <div className="rounded-xl border border-border bg-background p-6 sm:p-8">
          {state === "success" ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
              <p className="font-heading text-xl font-semibold">Message sent</p>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Thanks for reaching out. We&apos;ll reply to{" "}
                {successEmail || "your email"} soon.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  setState("idle");
                  setSuccessEmail("");
                }}
              >
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="contact-name">Name</Label>
                  <Input
                    id="contact-name"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Your name"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="contact-email">Email</Label>
                  <Input
                    id="contact-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="contact-company">
                  Company{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="contact-company"
                  name="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  autoComplete="organization"
                  placeholder="Operator or brand"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="contact-message">Message</Label>
                <Textarea
                  id="contact-message"
                  name="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  minLength={10}
                  rows={5}
                  placeholder="What market are you in? Which competitors should we compare?"
                />
              </div>
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden
              />
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                size="lg"
                className="w-full sm:w-auto"
                disabled={state === "submitting"}
              >
                {state === "submitting" ? (
                  <>
                    <Loader2 className="animate-spin" data-icon="inline-start" />
                    Sending…
                  </>
                ) : (
                  <>
                    Send message
                    <Send data-icon="inline-end" />
                  </>
                )}
              </Button>
            </form>
          )}
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
