import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import type Stripe from "stripe";
import {
  planForPrice,
  setUserPlan,
  stripe,
  userIdForCustomer,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook: the single source of truth for who is on a paid plan.
 * Point a Stripe webhook endpoint at /api/billing/webhook with events:
 *   checkout.session.completed
 *   customer.subscription.updated
 *   customer.subscription.deleted
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "webhook not configured" },
      { status: 503 }
    );
  }

  let event: Stripe.Event;
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "missing signature" }, { status: 400 });
    }
    const payload = await request.text();
    event = await stripe().webhooks.constructEventAsync(
      payload,
      signature,
      secret
    );
  } catch (e) {
    console.error("[billing/webhook] signature verification failed:", e);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : (session.customer?.id ?? null);
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription?.id ?? null);
        if (!userId || !subscriptionId) break;

        const sub = await stripe().subscriptions.retrieve(subscriptionId);
        const plan = planForPrice(sub.items.data[0]?.price.id ?? "");
        if (plan) {
          await setUserPlan(userId, plan, customerId, subscriptionId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const userId = await userIdForCustomer(customerId);
        if (!userId) break;

        // Cancelled-at-period-end stays paid until Stripe actually ends it
        // (that arrives as subscription.deleted).
        if (sub.status === "active" || sub.status === "trialing") {
          const plan = planForPrice(sub.items.data[0]?.price.id ?? "");
          if (plan) await setUserPlan(userId, plan, customerId, sub.id);
        } else if (
          sub.status === "canceled" ||
          sub.status === "unpaid" ||
          sub.status === "incomplete_expired"
        ) {
          await setUserPlan(userId, "free", customerId, null);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const userId = await userIdForCustomer(customerId);
        if (userId) await setUserPlan(userId, "free", customerId, null);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error(`[billing/webhook] ${event.type} handling failed:`, e);
    Sentry.captureException(e, {
      tags: { route: "billing-webhook", event: event.type },
    });
    // 500 makes Stripe retry the event — safe because handlers are idempotent.
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}
