import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { getStripeServerSide } from "./getStripeServerSide";
import { OrgDocument } from "@/lib/types/org";

/**
 * Metered per-IP usage reporting for completed AI pentests.
 *
 * Billing model (see docs/product-model.md): only the consolidated buyer — the
 * supplier at the root of the org tree — is subscribed and billed, post-paid, on
 * ACTUAL consumption across its subtree. Each completed pentest tests one live IP
 * (CIDRs are expanded to one doc per host at launch), so a completion reports a
 * usage record of `quantity` IPs against the supplier's metered subscription item.
 *
 * Attribution walks pentest.userId → user.orgPath[0] (the supplier) → the
 * supplier's billing.stripeSubscriptionItemId. If the buyer isn't subscribed yet
 * (no item id), this no-ops with a logged reason — a missing subscription must not
 * fail the results callback.
 */

export interface ReportUsageResult {
  reported: boolean;
  reason?: string;
  supplierOrgId?: string;
  subscriptionItemId?: string;
  quantity?: number;
}

/**
 * Report metered usage for one completed pentest.
 *
 * @param pentestId  Firestore pentest doc id (used as the Stripe idempotency key
 *                   so a retried callback can't double-bill).
 * @param userId     The launching user; resolves to the owning supplier org.
 * @param quantity   Billable live IPs for this pentest (defaults to 1).
 */
export async function reportPentestUsage(
  pentestId: string,
  userId: string,
  quantity = 1,
): Promise<ReportUsageResult> {
  if (!userId) return { reported: false, reason: "no userId on pentest" };
  if (quantity <= 0) return { reported: false, reason: "non-positive quantity" };

  // pentest.userId → supplier org (path root).
  const userSnap = await adminDb.collection("users").doc(userId).get();
  const orgPath: string[] = userSnap.data()?.orgPath ?? [];
  const supplierOrgId = orgPath[0];
  if (!supplierOrgId) {
    return { reported: false, reason: `user ${userId} has no orgPath (unmigrated)` };
  }

  const orgSnap = await adminDb.collection("orgs").doc(supplierOrgId).get();
  const org = orgSnap.data() as OrgDocument | undefined;
  const subscriptionItemId = org?.billing?.stripeSubscriptionItemId;
  if (!subscriptionItemId) {
    return {
      reported: false,
      reason: `supplier ${supplierOrgId} has no metered subscription item`,
      supplierOrgId,
    };
  }

  const stripe = await getStripeServerSide();
  await stripe.subscriptionItems.createUsageRecord(
    subscriptionItemId,
    { quantity, action: "increment" },
    // Idempotency: a Make retry of the same completion won't add usage twice.
    { idempotencyKey: `pentest-usage:${pentestId}` },
  );

  return {
    reported: true,
    supplierOrgId,
    subscriptionItemId,
    quantity,
  };
}
