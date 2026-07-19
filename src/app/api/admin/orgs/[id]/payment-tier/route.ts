import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUid } from "@/lib/firebase/adminSession";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { COLLECTIONS } from "@/lib/org/collections";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export const dynamic = "force-dynamic";

async function isAdminUid(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  const doc = await adminDb.collection("users").doc(uid).get();
  return doc.data()?.isAdmin === true;
}

const NET_TERMS_DAYS = 30;

/**
 * PUT /api/admin/orgs/[id]/payment-tier   { tier: "net30" | "auto" }
 *
 * The "move a buyer up/down a payment tier" action (platform_admin only). Flips the
 * supplier's metered subscription collection method:
 *   - "net30" (Tier 1): send_invoice + net terms — a privilege for vetted distributors.
 *   - "auto"  (Tier 2): charge_automatically — requires a card on file.
 * See docs/product-model.md "Payment posture".
 */
export async function PUT(req: NextRequest, context: { params: { id: string } }) {
  const uid = await getVerifiedUid();
  if (!(await isAdminUid(uid))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const orgId = context.params.id;
  const orgRef = adminDb.collection(COLLECTIONS.orgs).doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  let body: { tier?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const tier = body.tier;
  if (tier !== "net30" && tier !== "auto") {
    return NextResponse.json(
      { error: "tier must be 'net30' or 'auto'" },
      { status: 400 },
    );
  }

  const billing = orgSnap.data()?.billing || {};
  const subscriptionId: string | undefined = billing.stripeSubscriptionId;
  if (!subscriptionId) {
    return NextResponse.json(
      { error: "Buyer has no subscription yet — activate billing first" },
      { status: 409 },
    );
  }

  try {
    if (tier === "net30") {
      await stripe.subscriptions.update(subscriptionId, {
        collection_method: "send_invoice",
        days_until_due: NET_TERMS_DAYS,
      });
    } else {
      // charge_automatically requires a default payment method on the customer/sub.
      const customerId = billing.stripeCustomerId as string | undefined;
      let hasCard = false;
      if (customerId) {
        const c = await stripe.customers.retrieve(customerId);
        hasCard =
          !c.deleted &&
          !!(c as Stripe.Customer).invoice_settings?.default_payment_method;
      }
      if (!hasCard) {
        return NextResponse.json(
          { error: "No card on file — the buyer must add a payment method before Tier 2" },
          { status: 409 },
        );
      }
      await stripe.subscriptions.update(subscriptionId, {
        collection_method: "charge_automatically",
      });
    }

    await orgRef.set(
      {
        billing: { paymentTier: tier, netTerms: tier === "net30" ? NET_TERMS_DAYS : billing.netTerms ?? null },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ status: "success", orgId, paymentTier: tier });
  } catch (error: any) {
    console.error(`payment-tier update failed for ${orgId}:`, error?.message ?? error);
    return NextResponse.json(
      { error: error?.message || "Failed to update payment tier" },
      { status: 500 },
    );
  }
}
