import { Timestamp } from "firebase-admin/firestore";
import { SKU } from "./quota";

/**
 * Append-only usage ledger. Every finalized (or overage) draw against a pool
 * writes one immutable entry. This is the single source of truth that the
 * `GET /orgs/{id}/usage` rollup and consolidated distributor invoices read
 * from — never mutate or delete rows.
 */

export type UsageKind = "consume" | "overage" | "release";

export interface UsageLedgerEntry {
  id: string;
  /** Pool node the draw resolved against. */
  poolOrgId: string;
  /** Tenant the pentest was launched for. */
  tenantId: string;
  /** Full org path at launch time (root→tenant) for subtree rollups. */
  path: string[];
  sku: SKU;
  units: number;
  kind: UsageKind;
  /** true when this consumption exceeded a soft ceiling (billable overage). */
  overage: boolean;
  pentestId: string;
  /** Idempotency-Key of the originating request, when supplied. */
  idempotencyKey?: string;
  createdAt: Timestamp;
}
