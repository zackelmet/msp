import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { COLLECTIONS } from "./collections";
import { OrgDocument, OrgBranding, canParent } from "@/lib/types/org";
import { TierDocument } from "@/lib/types/tier";

/**
 * Org-tree read + resolution helpers.
 *
 * Everything keys off the materialized `path[]` (root→self). Subtree queries
 * are a single `array-contains`; ancestor resolution (tier, branding, pool)
 * walks `path` from self back toward the root and reads the nearest match.
 */

const orgs = () => adminDb.collection(COLLECTIONS.orgs);

export async function getOrg(orgId: string): Promise<OrgDocument | null> {
  const snap = await orgs().doc(orgId).get();
  return snap.exists ? (snap.data() as OrgDocument) : null;
}

/** Fetch every doc on an org's path in one batched read (root→self order). */
export async function getAncestors(org: OrgDocument): Promise<OrgDocument[]> {
  if (org.path.length === 0) return [];
  const refs = org.path.map((id) => orgs().doc(id));
  const snaps = await adminDb.getAll(...refs);
  return snaps.filter((s) => s.exists).map((s) => s.data() as OrgDocument);
}

/** Direct children of a node. */
export async function getChildren(orgId: string): Promise<OrgDocument[]> {
  const snap = await orgs().where("parentOrgId", "==", orgId).get();
  return snap.docs.map((d) => d.data() as OrgDocument);
}

/** Whole subtree rooted at orgId (inclusive), via the denormalized path. */
export async function getSubtree(orgId: string): Promise<OrgDocument[]> {
  const snap = await orgs().where("path", "array-contains", orgId).get();
  return snap.docs.map((d) => d.data() as OrgDocument);
}

/** True if `ancestorId` is on `org`'s path (i.e. org is in ancestor's subtree). */
export function isInSubtree(org: OrgDocument, ancestorId: string): boolean {
  return org.path.includes(ancestorId);
}

/**
 * Resolve the effective tier for an org: the tier of the nearest ancestor
 * (including self) that declares a `tierId`. Returns null if none on the path.
 */
export async function resolveTier(
  org: OrgDocument,
): Promise<TierDocument | null> {
  const chain = await getAncestors(org);
  // Walk self→root (path is root→self, so iterate reversed).
  for (let i = chain.length - 1; i >= 0; i--) {
    const node = chain[i];
    if (node.tierId) {
      const t = await adminDb
        .collection(COLLECTIONS.tiers)
        .doc(node.tierId)
        .get();
      if (t.exists) return t.data() as TierDocument;
    }
  }
  return null;
}

/**
 * Resolve white-label branding by inheriting nearest-ancestor values
 * field-by-field (self wins, then walks up toward the root).
 */
export async function resolveBranding(org: OrgDocument): Promise<OrgBranding> {
  const chain = await getAncestors(org);
  const out: OrgBranding = {};
  // root→self: later (closer to self) values overwrite earlier ones.
  for (const node of chain) {
    if (!node.branding) continue;
    for (const [k, v] of Object.entries(node.branding)) {
      if (v != null && v !== "") (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

/**
 * Nearest ancestor (including self) that owns a quota pool. Callers use this to
 * decide which pool a launch draws from. Returns the orgId or null.
 */
export async function resolvePoolOrgId(
  org: OrgDocument,
): Promise<string | null> {
  // path is root→self; the pool-holding node is usually high (distributor),
  // but a lower node may own its own pool. Prefer the *nearest* to self.
  for (let i = org.path.length - 1; i >= 0; i--) {
    const id = org.path[i];
    const pool = await adminDb.collection(COLLECTIONS.quotaPools).doc(id).get();
    if (pool.exists) return id;
  }
  return null;
}

/**
 * Validate + build the path for a new child under `parent`. Throws on an
 * illegal parent/child type relationship.
 */
export function buildChildPath(
  parent: OrgDocument,
  childId: string,
  childType: OrgDocument["type"],
): string[] {
  if (!canParent(parent.type, childType)) {
    throw new Error(
      `Illegal org nesting: ${parent.type} cannot parent ${childType}`,
    );
  }
  return [...parent.path, childId];
}
