import { NextResponse, type NextRequest } from "next/server";
import { AuthError, isAdminUser, requireUser } from "@/lib/auth-server";
import { stripe, stripeCustomerIdFor } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface AdminPayment {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  receiptUrl: string | null;
}

/** A user's Stripe invoice history, for the mission-control detail row. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "admins only" }, { status: 403 });
    }
    const { id } = await params;
    const customerId = await stripeCustomerIdFor(id);
    if (!customerId || !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ payments: [], customerId: customerId ?? null });
    }

    const invoices = await stripe().invoices.list({
      customer: customerId,
      limit: 24,
    });
    const payments: AdminPayment[] = invoices.data.map((inv) => ({
      id: inv.id ?? "",
      date: new Date(inv.created * 1000).toISOString(),
      amount: (inv.amount_paid || inv.amount_due) / 100,
      currency: inv.currency.toUpperCase(),
      status: inv.status ?? "unknown",
      description:
        inv.lines.data[0]?.description ?? inv.description ?? "Subscription",
      receiptUrl: inv.hosted_invoice_url ?? null,
    }));
    return NextResponse.json({ payments, customerId });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "failed to load payments";
    console.error("[admin] payments failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
