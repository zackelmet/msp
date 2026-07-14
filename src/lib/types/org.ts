import { Timestamp } from "firebase-admin/firestore";

/**
 * Fixed 3-level org tree for the consolidated-buying / white-label platform:
 *
 *   supplier → reseller → client
 *
 * (Luis/Acronis vocabulary: master → reseller → end client. We use "supplier"
 * for the top. Acronis also allows sub-resellers; we deliberately do NOT —
 * exactly 3 levels.)
 *
 * - supplier: buys pentest capacity in bulk and holds the single quota pool
 *   (e.g. Compulab). Always the root (path[0]). Billed post-paid on the
 *   consolidated consumption of its whole subtree.
 * - reseller: an MSP under a supplier. Owns white-label branding (logo/colors/
 *   footer) that drives its clients' reports + portal, and sets per-client
 *   quota caps (soft/hard).
 * - client: the end customer a pentest is launched for (the tree leaf). In
 *   today's app a client corresponds to a "target group".
 *
 * There can be MANY supplier-rooted trees. MSP Pentesting is itself a supplier
 * (for its own direct business), Compulab is another, etc. When a supplier
 * sells directly (no MSP in between) its clients sit under a "house" reseller
 * node representing the supplier itself — so the tree is always exactly 3 deep.
 * MSP Pentesting also OPERATES the platform: its staff are `platform_admin`
 * users who can see across every supplier tree, on top of MSPP's own supplier node.
 *
 * Every node carries a materialized `path` (root→self, inclusive), so any
 * subtree query is a single `array-contains` and tier/branding/pool resolution
 * walks the (at most 3-deep) ancestor chain without recursive reads.
 *
 * Design rationale: docs/api-v1.md + COMPULAB_PARTNERSHIP.md.
 */

export type OrgType = "supplier" | "reseller" | "client";

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
  /** Free-text footer for white-labeled reports (reseller address / contacts). */
  reportFooter?: string;
  /** Reseller opt-in: apply this branding to end-client reports + portal. */
  whiteLabelEnabled?: boolean;
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
  /** null only for a supplier (the root of its tree). */
  parentOrgId: string | null;
  /** Materialized ancestor path, root→self inclusive. path[0] is the supplier, path[last] === id. */
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

/** Depth of each level. supplier is the root pool-holder; client is the leaf. */
export const ORG_TYPE_DEPTH: Record<OrgType, number> = {
  supplier: 0,
  reseller: 1,
  client: 2,
};

/** The single legal child type for each level (client is a leaf → null). */
export const CHILD_TYPE: Record<OrgType, OrgType | null> = {
  supplier: "reseller",
  reseller: "client",
  client: null,
};

/**
 * Strict parent/child rule for the fixed 3-level tree: a node may only parent
 * the level immediately below it (supplier→reseller, reseller→client). No
 * level-skipping and no same-level nesting.
 */
export function canParent(parent: OrgType, child: OrgType): boolean {
  return CHILD_TYPE[parent] === child;
}
