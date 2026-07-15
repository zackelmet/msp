import { Timestamp } from "firebase-admin/firestore";

/**
 * Consumable quota model for the consolidated-buying program.
 *
 * The pool is prepurchased on the SUPPLIER (tree root, path[0]) and drawn down
 * across its whole subtree (resellers + clients). Reseller/client nodes may
 * declare optional per-SKU `caps` (ceilings) on how much of the shared pool
 * their subtree may consume. Entitlement checks resolve the pool at the
 * supplier root and the nearest cap on the path. See docs/api-v1.md.
 *
 * Soft vs hard (Luis's Acronis example — "sell this client 2 servers"):
 *   - hard: block at the ceiling — the client simply cannot exceed it.
 *   - soft: allow the overage, meter it as billable, and flag it so the
 *     partner is notified of the excess usage.
 */

/**
 * Canonical billable unit. The product collapsed to a SINGLE meter — one live IP
 * tested by an AI pentest (see docs/product-model.md). Superseded the old 5-SKU
 * set (ai_pentest/external/internal/web_app/manual). Kept as a one-element set so
 * the pool/caps/policy record shapes below are unchanged.
 */
export const SKUS = ["ip"] as const;
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
