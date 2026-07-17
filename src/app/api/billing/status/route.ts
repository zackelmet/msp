import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/org/access";
import { getOrg } from "@/lib/org/tree";

export const dynamic = "force-dynamic";

/**
 * GET /api/billing/status — the caller's supplier billing posture, for the Billing
 * page. Only a supplier_admin (or platform_admin) manages a payment method; billing
 * lives on the supplier root (`orgPath[0]`). Everyone else `isSupplier: false`.
 */
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isSupplierAdmin = caller.role === "supplier_admin" || caller.isAdmin;
  const supplierOrgId = isSupplierAdmin ? caller.orgPath?.[0] ?? caller.orgId : null;
  if (!supplierOrgId) {
    return NextResponse.json({ isSupplier: false });
  }

  const org = await getOrg(supplierOrgId);
  if (!org || org.type !== "supplier") {
    return NextResponse.json({ isSupplier: false });
  }

  const b = org.billing || {};
  return NextResponse.json({
    isSupplier: true,
    orgId: supplierOrgId,
    activated: !!b.stripeSubscriptionId,
    // null until a card is on file (Tier 2) or net terms are granted (Tier 1).
    paymentTier: b.paymentTier ?? null,
    suspended: b.suspended === true,
  });
}
