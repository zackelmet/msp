import { Timestamp } from "firebase-admin/firestore";

/**
 * Consumable quota model for the consolidated-buying program.
 *
 * A pool is prepurchased on a node (usually the distributor) and drawn down
 * across its whole subtree. Child nodes may declare optional `caps` (ceilings)
 * on how much of the shared pool they can consume. Entitlement checks walk UP
 * the tree to the nearest pool-holding ancestor. See docs/api-v1.md.
 */

/**
 * Canonical billable units. Superset of the docs buckets (ai_pentest, external,
 * internal, manual) and the legacy `users.credits` keys (web_app, external_ip).
 */
export const SKUS = [
  "ai_pentest",
  "external",
  "internal",
  "web_app",
  "manual",
] as const;
export type SKU = (typeof SKUS)[number];

/** Per-SKU counts. Missing key === 0. */
export type SkuCounts = Partial<Record<SKU, number>>;

/** hard = block at the ceiling; soft = warn, allow overage, meter it for billing. */
export type QuotaPolicy = "hard" | "soft";
export type SkuPolicy = Partial<Record<SKU, QuotaPolicy>>;

export type ReplenishMode = "monthly" | "one_time";

/**
 * Pool document — lives on the purchasing (pool-holding) node.
 * `available = purchased - reserved - consumed` per SKU (see entitlement helper).
 * `allocated` is the sum of child caps (informational; caps don't move units).
 */
export interface QuotaPool {
  /** Org id that owns this pool (the pool-holding node). */
  orgId: string;
  purchased: SkuCounts;
  /** In-flight reservations for queued/running pentests (moved to consumed on finalize). */
  reserved: SkuCounts;
  /** Finalized draw-down. */
  consumed: SkuCounts;
  /** Sum of declared child caps, for visibility. Not an accounting balance. */
  allocated?: SkuCounts;
  replenish: ReplenishMode;
  policy: SkuPolicy;
  /** For monthly replenishment: the period reserved/consumed counters reset against. */
  periodStart?: Timestamp;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Optional ceiling a child node places on its own subtree's draw from an
 * ancestor pool. Stored on the child org (collection: orgCaps/{orgId}).
 */
export interface QuotaCaps {
  orgId: string;
  caps: SkuCounts;
  /** Per-SKU override of the pool policy for this node's subtree. */
  policy?: SkuPolicy;
  updatedAt: Timestamp;
}

/** Result of an entitlement check for a single launch. */
export interface EntitlementResult {
  allowed: boolean;
  sku: SKU;
  units: number;
  /** Pool node the draw resolves against. */
  poolOrgId?: string;
  available: number;
  policy: QuotaPolicy;
  /** true when allowed only because policy is soft and this exceeds the ceiling. */
  overage: boolean;
  reason?:
    "ok" | "no_pool" | "quota_exhausted" | "cap_exceeded" | "tier_forbids";
}
