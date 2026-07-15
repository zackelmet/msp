import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { COLLECTIONS } from "@/lib/org/collections";
import { SKUS, SkuCounts, SkuPolicy } from "@/lib/types/quota";
import { getCaller, canManageOrgs } from "@/lib/org/access";
import { getOrg, isInSubtree } from "@/lib/org/tree";

export const dynamic = "force-dynamic";

/**
 * PUT /api/orgs/[id]/caps — role-scoped version of the admin caps write.
 *
 * A supplier_admin/reseller_admin may only set caps on a STRICT DESCENDANT in
 * their own subtree (your own cap is set by your parent). platform_admin may set
 * any. Auth: Firebase Bearer token. Sets per-SKU ceilings + soft/hard policy.
 */
export async function PUT(
  req: NextRequest,
  context: { params: { id: string } },
) {
  const caller = await getCaller(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageOrgs(caller)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgId = context.params.id;
  const target = await getOrg(orgId);
  if (!target) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  if (!caller.isAdmin) {
    const inSubtree =
      !!caller.orgId &&
      isInSubtree(target, caller.orgId) &&
      target.id !== caller.orgId;
    if (!inSubtree) {
      return NextResponse.json(
        { error: "You can only set quotas on your own clients" },
        { status: 403 },
      );
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawCaps = (body as { caps?: Record<string, unknown> })?.caps ?? {};
  const rawPolicy = (body as { policy?: Record<string, unknown> })?.policy ?? {};

  const caps: SkuCounts = {};
  const policy: SkuPolicy = {};
  for (const sku of SKUS) {
    const v = rawCaps[sku];
    if (v !== undefined && v !== null && v !== "") {
      const num = Number(v);
      if (Number.isNaN(num) || num < 0) {
        return NextResponse.json(
          { error: `Invalid cap for ${sku}: must be a non-negative number` },
          { status: 400 },
        );
      }
      caps[sku] = Math.floor(num);
    }
    const p = rawPolicy[sku];
    if (p === "soft" || p === "hard") {
      policy[sku] = p;
    } else if (p !== undefined && p !== null && p !== "") {
      return NextResponse.json(
        { error: `Invalid policy for ${sku}: must be 'soft' or 'hard'` },
        { status: 400 },
      );
    }
  }

  await adminDb
    .collection(COLLECTIONS.orgCaps)
    .doc(orgId)
    .set(
      { orgId, caps, policy, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

  return NextResponse.json({ status: "success", orgId, caps, policy });
}
