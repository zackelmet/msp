import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { getCaller } from "@/lib/org/access";
import { getOrg } from "@/lib/org/tree";
import { COLLECTIONS } from "@/lib/org/collections";
import { OrgDocument } from "@/lib/types/org";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/setup-session
 *
 * Starts Tier-2 billing activation for a CONSOLIDATED BUYER (supplier): a Stripe
 * Checkout Session in `mode: "setup"` that collects a card. On completion the
 * webhook (`org_billing_setup` flow) attaches it as the default payment method and
 * puts the buyer's metered subscription on `charge_automatically` (Tier 2), creating
 * the subscription if they don't have one yet.
 *
 * Only a supplier_admin (for their own supplier node) or the platform_admin may do
 * this — resellers/clients are never billed by the platform, so they have no card.
 * Billing always lives on the supplier root (`orgPath[0]`).
 */
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve the target supplier org. Admin may pass an explicit orgId; everyone
  // else acts on their own supplier root.
  let orgId: string | null = null;
  if (caller.isAdmin) {
    const body = await req.json().catch(() => ({}));
    orgId = typeof body?.orgId === "string" ? body.orgId : caller.orgPath?.[0] ?? null;
  } else if (caller.role === "supplier_admin") {
    orgId = caller.orgPath?.[0] ?? caller.orgId ?? null;
  } else {
    return NextResponse.json(
      { error: "Only a supplier admin can set up billing" },
      { status: 403 },
    );
  }

  if (!orgId) {
    return NextResponse.json({ error: "No supplier org to bill" }, { status: 400 });
  }

  const org = (await getOrg(orgId)) as OrgDocument | null;
  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }
  if (org.type !== "supplier") {
    return NextResponse.json(
      { error: "Billing is only set up on the supplier (consolidated buyer) node" },
      { status: 400 },
    );
  }

  // Ensure a Stripe customer for the supplier (reuse the stored one).
  let customerId = org.billing?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.name || orgId,
      description: `Consolidated buyer — ${orgId}`,
      metadata: { orgId, role: "supplier" },
    });
    customerId = customer.id;
    await adminDb
      .collection(COLLECTIONS.orgs)
      .doc(orgId)
      .set(
        { billing: { stripeCustomerId: customerId } },
        { merge: true },
      );
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      payment_method_types: ["card"],
      customer: customerId,
      success_url: `${origin}/app/buy-credits?billing=setup_success`,
      cancel_url: `${origin}/app/buy-credits?billing=setup_canceled`,
      // The webhook keys off this to attach the PM + activate the subscription.
      metadata: { flow: "org_billing_setup", orgId },
      setup_intent_data: { metadata: { flow: "org_billing_setup", orgId } },
    });
    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error(`billing setup-session failed for ${orgId}:`, error?.message ?? error);
    return NextResponse.json(
      { error: error?.message || "Failed to create setup session" },
      { status: 500 },
    );
  }
}
