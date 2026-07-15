import { NextRequest, NextResponse } from "next/server";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { COLLECTIONS } from "@/lib/org/collections";
import { getCaller, canManageOrgs } from "@/lib/org/access";
import { getSubtree } from "@/lib/org/tree";
import { OrgDocument } from "@/lib/types/org";

export const dynamic = "force-dynamic";

/**
 * GET /api/orgs — role-scoped control-plane data.
 *
 * A supplier_admin/reseller_admin sees only their own subtree; a platform_admin
 * (Zack) sees the whole tree. Same { orgs, pools, caps } shape as the /admin
 * endpoint so the PlatformSection UI is shared. Auth: Firebase Bearer token.
 */
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageOrgs(caller)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Visible org set: whole tree for platform admin, own subtree otherwise.
  let orgDocs: OrgDocument[];
  if (caller.isAdmin) {
    const snap = await adminDb.collection(COLLECTIONS.orgs).get();
    orgDocs = snap.docs.map((d) => d.data() as OrgDocument);
  } else if (caller.orgId) {
    orgDocs = await getSubtree(caller.orgId);
  } else {
    return NextResponse.json({
      orgs: [],
      pools: [],
      caps: [],
      self: { orgId: null, role: caller.role },
    });
  }
  const ids = orgDocs.map((o) => o.id);

  // Pools: admin → all; scoped → the supplier root of the caller's subtree.
  let poolDocs: DocumentSnapshot[];
  if (caller.isAdmin) {
    poolDocs = (await adminDb.collection(COLLECTIONS.quotaPools).get()).docs;
  } else {
    const self = orgDocs.find((o) => o.id === caller.orgId);
    const rootId = self?.path?.[0] ?? caller.orgId!;
    poolDocs = (
      await adminDb.getAll(
        adminDb.collection(COLLECTIONS.quotaPools).doc(rootId),
      )
    ).filter((s) => s.exists);
  }

  // Caps: only for orgs in view.
  let capDocs: DocumentSnapshot[];
  if (caller.isAdmin) {
    capDocs = (await adminDb.collection(COLLECTIONS.orgCaps).get()).docs;
  } else if (ids.length) {
    capDocs = (
      await adminDb.getAll(
        ...ids.map((id) => adminDb.collection(COLLECTIONS.orgCaps).doc(id)),
      )
    ).filter((s) => s.exists);
  } else {
    capDocs = [];
  }

  const orgs = orgDocs.map((d) => ({
    id: d.id,
    type: d.type ?? null,
    parentOrgId: d.parentOrgId ?? null,
    path: d.path ?? [],
    name: d.name ?? d.id,
    slug: d.slug ?? null,
    status: d.status ?? "active",
    tierId: d.tierId ?? null,
    branding: d.branding ?? null,
  }));

  const pools = poolDocs.map((s) => {
    const d = (s.data() ?? {}) as Record<string, unknown>;
    return {
      orgId: s.id,
      purchased: d.purchased ?? {},
      reserved: d.reserved ?? {},
      consumed: d.consumed ?? {},
      policy: d.policy ?? {},
      replenish: d.replenish ?? "one_time",
    };
  });

  const caps = capDocs.map((s) => {
    const d = (s.data() ?? {}) as Record<string, unknown>;
    return { orgId: s.id, caps: d.caps ?? {}, policy: d.policy ?? {} };
  });

  return NextResponse.json({
    orgs,
    pools,
    caps,
    self: { orgId: caller.orgId, role: caller.role },
  });
}
