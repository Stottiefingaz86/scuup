import Stripe from "stripe";
import { supabase } from "./supabase-server";
import type { Plan } from "./plan";

/**
 * Stripe billing. Everything here no-ops gracefully until the env vars
 * are set, so the app deploys and runs without a Stripe account:
 *
 *   STRIPE_SECRET_KEY        sk_live_... / sk_test_...
 *   STRIPE_WEBHOOK_SECRET    whsec_... (from the webhook endpoint)
 *   STRIPE_PRICE_PRO         price_... (Pro monthly)
 *   STRIPE_PRICE_PRO_PLUS    price_... (Pro Plus monthly)
 */

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_PRO &&
      process.env.STRIPE_PRICE_PRO_PLUS
  );
}

export function stripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY).");
  client = new Stripe(key);
  return client;
}

/** Which paid plan a Stripe price ID maps to. */
export function planForPrice(priceId: string): Plan | null {
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_PRO_PLUS) return "pro_plus";
  return null;
}

export function priceForPlan(plan: Plan): string | null {
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO ?? null;
  if (plan === "pro_plus") return process.env.STRIPE_PRICE_PRO_PLUS ?? null;
  return null;
}

/** Persist the outcome of a subscription change on the user's profile. */
export async function setUserPlan(
  userId: string,
  plan: Plan,
  stripeCustomerId?: string | null,
  stripeSubscriptionId?: string | null
): Promise<void> {
  const update: Record<string, unknown> = { plan };
  if (stripeCustomerId !== undefined) {
    update.stripe_customer_id = stripeCustomerId;
  }
  if (stripeSubscriptionId !== undefined) {
    update.stripe_subscription_id = stripeSubscriptionId;
  }
  const { error } = await supabase()
    .from("ps_profiles")
    .update(update)
    .eq("user_id", userId);
  if (error) throw new Error(`failed to update plan: ${error.message}`);
}

/** Find the user a Stripe customer belongs to. */
export async function userIdForCustomer(
  customerId: string
): Promise<string | null> {
  const { data } = await supabase()
    .from("ps_profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}

export async function stripeCustomerIdFor(
  userId: string
): Promise<string | null> {
  const { data } = await supabase()
    .from("ps_profiles")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.stripe_customer_id ?? null;
}
