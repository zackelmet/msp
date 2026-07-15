import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { COLLECTIONS } from "@/lib/org/collections";
import { getCaller, canManageOrgs } from "@/lib/org/access";
import { getSubtree, getOrg, isInSubtree, buildChildPath } from "@/lib/org/tree";
import { OrgDocument, OrgType, canParent } from "@/lib/types/org";

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

/**
 * POST /api/orgs — create a new org node (reseller or client) under a parent the
 * caller owns. Enforces the fixed 3-level nesting (supplier→reseller→client) and
 * subtree scoping. Body: { name, type: "reseller"|"client", parentOrgId }.
 */
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageOrgs(caller)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { name?: unknown; type?: unknown; parentOrgId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = body.type as OrgType;
  const parentOrgId =
    typeof body.parentOrgId === "string" ? body.parentOrgId : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (type !== "reseller" && type !== "client") {
    return NextResponse.json(
      { error: "Type must be reseller or client" },
      { status: 400 },
    );
  }
  if (!parentOrgId) {
    return NextResponse.json(
      { error: "parentOrgId is required" },
      { status: 400 },
    );
  }

  const parent = await getOrg(parentOrgId);
  if (!parent) {
    return NextResponse.json({ error: "Parent org not found" }, { status: 404 });
  }
  if (!caller.isAdmin) {
    if (!caller.orgId || !isInSubtree(parent, caller.orgId)) {
      return NextResponse.json(
        { error: "You can only add under your own subtree" },
        { status: 403 },
      );
    }
  }
  if (!canParent(parent.type, type)) {
    return NextResponse.json(
      { error: `A ${parent.type} cannot contain a ${type}` },
      { status: 400 },
    );
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const id = `org_${slug || type}_${randomUUID().slice(0, 6)}`;
  const path = buildChildPath(parent, id, type);

  const doc = {
    id,
    type,
    parentOrgId,
    path,
    name,
    slug: slug || null,
    billing: { mode: "inherited" as const },
    status: "active" as const,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: caller.uid,
  };
  await adminDb.collection(COLLECTIONS.orgs).doc(id).set(doc);

  return NextResponse.json({
    status: "success",
    org: { ...doc, createdAt: null },
  });
}
