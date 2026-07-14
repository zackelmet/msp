import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { COLLECTIONS } from "@/lib/org/collections";
import { SKUS, SkuCounts, SkuPolicy } from "@/lib/types/quota";

export const dynamic = "force-dynamic";

async function isAdminUid(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  const doc = await adminDb.collection("users").doc(uid).get();
  return doc.data()?.isAdmin === true;
}

/**
 * PUT /api/admin/orgs/[id]/caps
 *
 * Sets a node's per-SKU quota ceilings (the amount of the shared supplier pool
 * its subtree may draw) plus the per-SKU soft/hard policy:
 *   - hard: block at the ceiling.
 *   - soft: allow the overage, meter it as billable, flag it.
 * Writes the QuotaCaps doc at orgCaps/{orgId} (merge). Caps are ceilings, not
 * balances — they don't move pool units.
 */
export async function PUT(
  req: NextRequest,
  context: { params: { id: string } },
) {
  const uid = cookies().get("uid")?.value;
  if (!(await isAdminUid(uid))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const orgId = context.params.id;
  const orgSnap = await adminDb.collection(COLLECTIONS.orgs).doc(orgId).get();
  if (!orgSnap.exists) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawCaps = (body as { caps?: Record<string, unknown> })?.caps ?? {};
  const rawPolicy = (body as { policy?: Record<string, unknown> })?.policy ?? {};

  // Only accept known SKU keys with sane values.
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
      {
        orgId,
        caps,
        policy,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  return NextResponse.json({ status: "success", orgId, caps, policy });
}
