import { Timestamp } from "firebase-admin/firestore";
import { SKU } from "./quota";

/**
 * Tier = entitlement template attached to an org node (usually a reseller),
 * cascading down the subtree with per-node override allowed. Assigned via
 * `orgs/{id}.tierId`; resolved by walking up to the nearest ancestor with one.
 *
 * A tier governs *capability* (which SKUs/features, rate limits). The
 * consumable pool (quota.ts) governs *volume*. They are independent checks.
 */

export interface TierLimits {
  /** Per-org rate limit (distinct from the consumable pool). 0 = unlimited. */
  pentestsPerMonth: number;
  concurrentJobs: number;
  /** Max direct child tenants a reseller may create. 0 = unlimited. */
  tenantsMax: number;
}

export interface TierFeatures {
  apiAccess: boolean;
  scheduledScans: boolean;
  whiteLabel: boolean;
  outboundWebhooks: boolean;
}

export interface TierDocument {
  id: string;
  name: string; // "Starter" | "Pro" | "Enterprise"
  /** SKUs this tier is permitted to launch at all. */
  skus: SKU[];
  limits: TierLimits;
  features: TierFeatures;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
