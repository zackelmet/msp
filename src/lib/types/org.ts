import { Timestamp } from "firebase-admin/firestore";

/**
 * Multi-tenant org tree for the consolidated-buying / white-label platform.
 *
 * Nodes form a general tree: platform → distributor → reseller → tenant.
 * Every node carries a materialized `path` (root→self, inclusive) so any
 * subtree query is a single `array-contains` and entitlement checks can walk
 * up the ancestor chain without recursive reads.
 *
 * Design rationale: docs/api-v1.md + COMPULAB_PARTNERSHIP.md.
 */

export type OrgType = "platform" | "distributor" | "reseller" | "tenant";

export type OrgStatus = "active" | "suspended";

/** How an org node is billed. Inherited nodes resolve up the tree. */
export type BillingMode = "consolidated" | "direct" | "inherited";

/** White-label config; resolved by inheriting the nearest ancestor value. */
export interface OrgBranding {
  logoUrl?: string;
  primaryColor?: string;
  /** Custom domain / subdomain slug for the portal, e.g. "acme". */
  cname?: string;
  reportCoverUrl?: string;
  emailSender?: string;
}

export interface OrgBilling {
  mode: BillingMode;
  /** Stripe customer id when mode === "direct" or "consolidated" on this node. */
  stripeCustomerId?: string;
  /** Net terms in days for consolidated invoicing (e.g. 30). */
  netTerms?: number;
}

export interface OrgDocument {
  id: string;
  type: OrgType;
  /** null only for the single platform root. */
  parentOrgId: string | null;
  /** Materialized ancestor path, root→self inclusive. path[0] is the platform root, path[last] === id. */
  path: string[];
  name: string;
  /** Optional; used for portal subdomain + human-friendly references. Unique among siblings. */
  slug?: string;

  /** Entitlement template. Inherited from the nearest ancestor when omitted. */
  tierId?: string;

  branding?: OrgBranding;
  billing: OrgBilling;

  status: OrgStatus;

  createdAt: Timestamp;
  updatedAt?: Timestamp;
  /** uid of the user (or "system"/api-key id) that created this node. */
  createdBy?: string;
}

/** Depth ordering used to validate parent/child type relationships. */
export const ORG_TYPE_DEPTH: Record<OrgType, number> = {
  platform: 0,
  distributor: 1,
  reseller: 2,
  tenant: 3,
};

/**
 * Allowed child types for each org type. The tree is flexible (a distributor
 * may sit directly above a tenant, or a reseller directly under the platform),
 * but a node can never parent something at or above its own level.
 */
export function canParent(parent: OrgType, child: OrgType): boolean {
  return ORG_TYPE_DEPTH[child] > ORG_TYPE_DEPTH[parent];
}
