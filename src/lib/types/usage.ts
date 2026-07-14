import { Timestamp } from "firebase-admin/firestore";
import { SKU } from "./quota";

/**
 * Append-only usage ledger. Every finalized (or overage) draw against a pool
 * writes one immutable entry. This is the single source of truth that the
 * `GET /orgs/{id}/usage` rollup and consolidated supplier invoices read
 * from — never mutate or delete rows.
 */

export type UsageKind = "consume" | "overage" | "release";

export interface UsageLedgerEntry {
  id: string;
  /** Pool node the draw resolved against (the supplier root). */
  poolOrgId: string;
  /** Client the pentest was launched for (the tree leaf). */
  clientId: string;
  /** Full org path at launch time (supplier→client) for subtree rollups. */
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
