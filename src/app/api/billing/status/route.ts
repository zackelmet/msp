import { NextRequest, NextResponse } from "next/server";
import { getCaller } from "@/lib/org/access";
import { getOrg } from "@/lib/org/tree";
import { OrgBilling } from "@/lib/types/org";

export const dynamic = "force-dynamic";

/**
 * GET /api/billing/status — the caller's billing posture.
 *
 * `metered`/`suspended` reflect the caller's SUPPLIER root (`orgPath[0]`) and are
 * returned for ANY role, because the launch page uses `metered` to decide whether
 * to gate on credits — and every user in a distributor's subtree launches metered,
 * not just the supplier_admin. The supplier-management fields (`isSupplier`,
 * `activated`, `paymentTier`) are only meaningful for a supplier_admin managing
 * the payment method.
 */
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supplierOrgId = caller.orgPath?.[0] ?? null;
  const supplier = supplierOrgId ? await getOrg(supplierOrgId) : null;
  const b: Partial<OrgBilling> =
    supplier?.type === "supplier" ? supplier.billing || {} : {};

  // Same signal the launch gate + metering use, for any role.
  const metered = !!b.stripeSubscriptionItemId;
  const isSupplierAdmin = caller.role === "supplier_admin" || caller.isAdmin;

  return NextResponse.json({
    metered,
    suspended: b.suspended === true,
    isSupplier: isSupplierAdmin && supplier?.type === "supplier",
    orgId: supplierOrgId,
    activated: metered,
    paymentTier: b.paymentTier ?? null,
  });
}
