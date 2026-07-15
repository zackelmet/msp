import { adminDb, verifyAuthToken } from "@/lib/firebase/firebaseAdmin";

/**
 * Caller identity + role scoping for the in-app control plane.
 *
 * Unlike the /admin endpoints (which trust the `uid` cookie), these resolve the
 * caller from a verified Firebase ID token, then read their org/role from the
 * user doc. Supplier/reseller admins manage only their own subtree; the platform
 * admin (Zack, isAdmin) manages the whole tree.
 */

export type OrgRole =
  | "platform_admin"
  | "supplier_admin"
  | "reseller_admin"
  | "client_user";

export interface Caller {
  uid: string;
  orgId: string | null;
  orgPath: string[];
  role: OrgRole | null;
  isAdmin: boolean;
}

/** Verify the Bearer token and load the caller's org/role from their user doc. */
export async function getCaller(req: Request): Promise<Caller | null> {
  const uid = await verifyAuthToken(req);
  if (!uid) return null;
  const snap = await adminDb.collection("users").doc(uid).get();
  const d = snap.data() ?? {};
  return {
    uid,
    orgId: d.orgId ?? null,
    orgPath: d.orgPath ?? [],
    role: (d.role as OrgRole) ?? null,
    isAdmin: d.isAdmin === true,
  };
}

/** Roles allowed to manage the control plane (their own subtree). */
export function canManageOrgs(c: Caller): boolean {
  return (
    c.isAdmin || c.role === "supplier_admin" || c.role === "reseller_admin"
  );
}
