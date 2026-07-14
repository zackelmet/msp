import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { COLLECTIONS } from "@/lib/org/collections";

export const dynamic = "force-dynamic";

async function isAdminUid(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  const doc = await adminDb.collection("users").doc(uid).get();
  return doc.data()?.isAdmin === true;
}

/**
 * GET /api/admin/orgs
 * Returns the whole org tree (flat) plus quota pools, for the platform control
 * plane. Fixed 3-level model: supplier → reseller → client. The UI builds the
 * drill-down from `parentOrgId` / `path`. Empty until migrateOrgs has run.
 */
export async function GET(_req: NextRequest) {
  const uid = cookies().get("uid")?.value;
  if (!(await isAdminUid(uid))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [orgSnap, poolSnap, capSnap] = await Promise.all([
    adminDb.collection(COLLECTIONS.orgs).get(),
    adminDb.collection(COLLECTIONS.quotaPools).get(),
    adminDb.collection(COLLECTIONS.orgCaps).get(),
  ]);

  const orgs = orgSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      type: d.type ?? null,
      parentOrgId: d.parentOrgId ?? null,
      path: d.path ?? [],
      name: d.name ?? doc.id,
      slug: d.slug ?? null,
      status: d.status ?? "active",
      tierId: d.tierId ?? null,
      branding: d.branding ?? null,
      billing: d.billing ?? null,
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
    };
  });

  const pools = poolSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      orgId: doc.id,
      purchased: d.purchased ?? {},
      reserved: d.reserved ?? {},
      consumed: d.consumed ?? {},
      policy: d.policy ?? {},
      replenish: d.replenish ?? "one_time",
    };
  });

  const caps = capSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      orgId: doc.id,
      caps: d.caps ?? {},
      policy: d.policy ?? {},
    };
  });

  return NextResponse.json({ orgs, pools, caps });
}
