import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { AuthError, requireUser } from "@/lib/auth-server";
import { authEmailOrigin } from "@/lib/app-url";
import {
  priceForPlan,
  stripe,
  stripeConfigured,
  stripeCustomerIdFor,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start a Stripe Checkout session for Pro or Pro Plus. */
export async function POST(request: NextRequest) {
  try {
    if (!stripeConfigured()) {
      return NextResponse.json(
        { error: "Payments aren't live yet. Contact us for early access." },
        { status: 503 }
      );
    }
    const user = await requireUser();

    const body = await request.json();
    const plan = body.plan === "pro_plus" ? "pro_plus" : "pro";
    const price = priceForPlan(plan);
    if (!price) {
      return NextResponse.json({ error: "unknown plan" }, { status: 400 });
    }

    const origin = authEmailOrigin();
    const existingCustomer = await stripeCustomerIdFor(user.id);

    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      // client_reference_id ties the webhook event back to our user.
      client_reference_id: user.id,
      ...(existingCustomer
        ? { customer: existingCustomer }
        : { customer_email: user.email }),
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      success_url: `${origin}/dashboard?upgraded=1`,
      cancel_url: `${origin}/upgrade?from=default`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error("[billing/checkout] failed:", e);
    Sentry.captureException(e, { tags: { route: "billing-checkout" } });
    return NextResponse.json(
      { error: "Couldn't start checkout. Try again or contact support." },
      { status: 500 }
    );
  }
}
