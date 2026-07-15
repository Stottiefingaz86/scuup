import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { AuthError, requireUser } from "@/lib/auth-server";
import { authEmailOrigin } from "@/lib/app-url";
import { stripe, stripeConfigured, stripeCustomerIdFor } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Open the Stripe customer portal (change card, cancel, invoices). */
export async function POST() {
  try {
    if (!stripeConfigured()) {
      return NextResponse.json(
        { error: "Billing isn't live yet." },
        { status: 503 }
      );
    }
    const user = await requireUser();
    const customerId = await stripeCustomerIdFor(user.id);
    if (!customerId) {
      return NextResponse.json(
        { error: "No subscription found for this account." },
        { status: 404 }
      );
    }

    const session = await stripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${authEmailOrigin()}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error("[billing/portal] failed:", e);
    Sentry.captureException(e, { tags: { route: "billing-portal" } });
    return NextResponse.json(
      { error: "Couldn't open the billing portal." },
      { status: 500 }
    );
  }
}
