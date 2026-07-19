import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { COLLECTIONS } from "@/lib/org/collections";

export const dynamic = "force-dynamic";

async function isAdminUid(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  const doc = await adminDb.collection("users").doc(uid).get();
  return doc.data()?.isAdmin === true;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

/**
 * POST /api/admin/orgs/elevate   { userId }
 *
 * Elevate a self-serve reseller into a DISTRIBUTOR (platform_admin only — i.e.
 * Zack + Connor). Mirrors the Compulab shape: creates the user's own supplier
 * tree (supplier → house reseller → default client), promotes them to
 * supplier_admin of it, and deactivates their old self-enrolled reseller node.
 * Billing (Tier-2 card or net-30) is activated afterward via the Billing page /
 * the payment-tier endpoint. Idempotent-ish: refuses if already a supplier_admin.
 */
export async function PUT(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const callerUid = cookies().get("uid")?.value;
  if (!(await isAdminUid(callerUid))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: { userId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const u = userSnap.data() || {};
  if (u.role === "supplier_admin") {
    return NextResponse.json(
      { error: "User is already a distributor (supplier_admin)" },
      { status: 409 },
    );
  }

  const displayName = u.name || u.displayName || u.email || userId;
  const base = slugify(displayName) || "distributor";
  const supplierId = `org_supplier_${userId.slice(0, 10)}`;
  const houseId = `${supplierId}_house`;
  const clientId = `${supplierId}_client`;
  const ts = FieldValue.serverTimestamp();
  const orgs = adminDb.collection(COLLECTIONS.orgs);

  const batch = adminDb.batch();

  // Supplier root (the distributor / consolidated buyer).
  batch.set(orgs.doc(supplierId), {
    id: supplierId,
    type: "supplier",
    parentOrgId: null,
    path: [supplierId],
    name: displayName,
    slug: base,
    billing: { mode: "consolidated" },
    status: "active",
    createdAt: ts,
    createdBy: `system:elevate:${callerUid}`,
  });
  // House reseller (so the distributor can sell direct — the Acronis pattern).
  batch.set(orgs.doc(houseId), {
    id: houseId,
    type: "reseller",
    parentOrgId: supplierId,
    path: [supplierId, houseId],
    name: `${displayName} (Direct)`,
    slug: `${base}-house`,
    billing: { mode: "inherited" },
    status: "active",
    createdAt: ts,
    createdBy: `system:elevate:${callerUid}`,
  });
  // Default client under the house reseller.
  batch.set(orgs.doc(clientId), {
    id: clientId,
    type: "client",
    parentOrgId: houseId,
    path: [supplierId, houseId, clientId],
    name: `${displayName} Default Client`,
    slug: `${base}-client`,
    billing: { mode: "inherited" },
    status: "active",
    createdAt: ts,
    createdBy: `system:elevate:${callerUid}`,
  });

  // Promote the user to supplier_admin of their new tree.
  batch.set(
    userRef,
    {
      orgId: supplierId,
      orgPath: [supplierId],
      role: "supplier_admin",
      selfEnrolled: FieldValue.delete(),
      previousOrgId: u.orgId ?? null,
      elevatedAt: ts,
      elevatedBy: callerUid,
      updatedAt: ts,
    },
    { merge: true },
  );

  // Deactivate the old self-enrolled reseller node (kept for audit, not deleted).
  if (u.orgId && typeof u.orgId === "string" && u.orgId !== supplierId) {
    batch.set(
      orgs.doc(u.orgId),
      {
        status: "inactive",
        replacedBySupplierOrgId: supplierId,
        updatedAt: ts,
      },
      { merge: true },
    );
  }

  await batch.commit();

  return NextResponse.json({
    status: "success",
    supplierOrgId: supplierId,
    houseResellerOrgId: houseId,
    defaultClientOrgId: clientId,
    message: `${displayName} is now a distributor. Activate billing on their account (Tier-2 card or net-30).`,
  });
}
