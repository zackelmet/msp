import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { FieldValue, Timestamp, Transaction } from "firebase-admin/firestore";
import { COLLECTIONS } from "./collections";
import { resolvePoolOrgId, resolveTier } from "./tree";
import { OrgDocument } from "@/lib/types/org";
import {
  EntitlementResult,
  QuotaCaps,
  QuotaPolicy,
  QuotaPool,
  SKU,
  SkuCounts,
} from "@/lib/types/quota";
import { UsageLedgerEntry, UsageKind } from "@/lib/types/usage";

/**
 * Consumable-quota accounting against the org tree.
 *
 * Money-critical invariant: the pool can never be oversold. All draws
 * (reserve / consume / release) run in a Firestore transaction on the single
 * pool doc and re-check availability inside the transaction.
 *
 * `available(sku) = purchased - reserved - consumed`.
 *
 * Caps (per-child ceilings) are checked against the append-only usage ledger
 * for the capped subtree. NOTE: cap checks currently count *consumed* usage,
 * not in-flight reservations — a documented Phase-1 limitation, acceptable
 * because the pool-level reservation still prevents overselling real capacity.
 * Refine once the allocation model is locked with Luis (see docs/product-model.md).
 */

const n = (c: SkuCounts | undefined, sku: SKU): number => c?.[sku] ?? 0;

/** UTC year-month key, e.g. "2026-07", used for monthly pool replenishment. */
function currentMonthStart(): Timestamp {
  const now = new Date();
  return Timestamp.fromDate(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
  );
}

/** True if a monthly pool's period has rolled over and counters should reset. */
function needsReplenish(pool: QuotaPool, monthStart: Timestamp): boolean {
  return (
    pool.replenish === "monthly" &&
    (!pool.periodStart || pool.periodStart.toMillis() < monthStart.toMillis())
  );
}

async function getPool(poolOrgId: string): Promise<QuotaPool | null> {
  const snap = await adminDb
    .collection(COLLECTIONS.quotaPools)
    .doc(poolOrgId)
    .get();
  return snap.exists ? (snap.data() as QuotaPool) : null;
}

/**
 * Effective policy for an SKU: nearest ancestor cap override wins, else the
 * pool policy, else "hard".
 */
async function resolvePolicy(
  org: OrgDocument,
  pool: QuotaPool,
  sku: SKU,
): Promise<QuotaPolicy> {
  for (let i = org.path.length - 1; i >= 0; i--) {
    const capSnap = await adminDb
      .collection(COLLECTIONS.orgCaps)
      .doc(org.path[i])
      .get();
    if (capSnap.exists) {
      const caps = capSnap.data() as QuotaCaps;
      const p = caps.policy?.[sku];
      if (p) return p;
    }
  }
  return pool.policy?.[sku] ?? "hard";
}

/**
 * Nearest cap on `org`'s path for this SKU, plus that node's consumed usage in
 * the current period. Returns null when no cap applies.
 */
async function resolveCap(
  org: OrgDocument,
  sku: SKU,
): Promise<{ orgId: string; cap: number; consumed: number } | null> {
  for (let i = org.path.length - 1; i >= 0; i--) {
    const capSnap = await adminDb
      .collection(COLLECTIONS.orgCaps)
      .doc(org.path[i])
      .get();
    if (!capSnap.exists) continue;
    const caps = capSnap.data() as QuotaCaps;
    const cap = caps.caps?.[sku];
    if (cap == null) continue;
    const consumed = await subtreeConsumed(org.path[i], sku);
    return { orgId: org.path[i], cap, consumed };
  }
  return null;
}

/** Sum consumed (+overage, −release) units for an SKU across a subtree, this month. */
export async function subtreeConsumed(
  orgId: string,
  sku: SKU,
): Promise<number> {
  const monthStart = currentMonthStart();
  const snap = await adminDb
    .collection(COLLECTIONS.usageLedger)
    .where("path", "array-contains", orgId)
    .where("sku", "==", sku)
    .where("createdAt", ">=", monthStart)
    .get();
  let total = 0;
  for (const d of snap.docs) {
    const e = d.data() as UsageLedgerEntry;
    total += e.kind === "release" ? -e.units : e.units;
  }
  return total;
}

/**
 * Non-mutating entitlement check for a prospective launch. Resolves tier
 * capability + pool availability + caps and returns whether the launch is
 * allowed (and whether it would be billed as overage).
 */
export async function checkEntitlement(
  org: OrgDocument,
  sku: SKU,
  units: number,
): Promise<EntitlementResult> {
  const base: EntitlementResult = {
    allowed: false,
    sku,
    units,
    available: 0,
    policy: "hard",
    overage: false,
  };

  // 1. Tier capability
  const tier = await resolveTier(org);
  if (tier && !tier.skus.includes(sku)) {
    return { ...base, reason: "tier_forbids" };
  }

  // 2. Pool (always the supplier root)
  const poolOrgId = resolvePoolOrgId(org);
  if (!poolOrgId) return { ...base, reason: "no_pool" };
  const pool = await getPool(poolOrgId);
  if (!pool) return { ...base, reason: "no_pool" };

  const policy = await resolvePolicy(org, pool, sku);
  const available =
    n(pool.purchased, sku) - n(pool.reserved, sku) - n(pool.consumed, sku);

  // 3. Caps (subtree ceiling)
  const cap = await resolveCap(org, sku);
  const capExceeded = cap != null && cap.consumed + units > cap.cap;

  const withinPool = available >= units;
  const ok = withinPool && !capExceeded;

  if (ok) {
    return {
      ...base,
      allowed: true,
      poolOrgId,
      available,
      policy,
      reason: "ok",
    };
  }
  // Soft policy allows overage; hard blocks.
  if (policy === "soft") {
    return {
      ...base,
      allowed: true,
      poolOrgId,
      available,
      policy,
      overage: true,
      reason: capExceeded ? "cap_exceeded" : "quota_exhausted",
    };
  }
  return {
    ...base,
    poolOrgId,
    available,
    policy,
    reason: capExceeded ? "cap_exceeded" : "quota_exhausted",
  };
}

/**
 * Reserve `units` of an SKU against the resolved pool, transactionally. Applies
 * monthly replenishment reset if the period rolled over. Throws on a hard-block
 * exhaustion. Returns the pool org id the reservation landed on.
 */
export async function reserveQuota(
  org: OrgDocument,
  sku: SKU,
  units: number,
): Promise<{ poolOrgId: string; overage: boolean }> {
  const poolOrgId = resolvePoolOrgId(org);
  if (!poolOrgId) throw new Error("NO_POOL");
  const policy = await (async () => {
    const p = await getPool(poolOrgId);
    if (!p) throw new Error("NO_POOL");
    return resolvePolicy(org, p, sku);
  })();

  const poolRef = adminDb.collection(COLLECTIONS.quotaPools).doc(poolOrgId);
  const monthStart = currentMonthStart();

  return adminDb.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(poolRef);
    if (!snap.exists) throw new Error("NO_POOL");
    const pool = snap.data() as QuotaPool;

    const reset = needsReplenish(pool, monthStart);
    const reserved = reset ? {} : { ...(pool.reserved ?? {}) };
    const consumed = reset ? {} : { ...(pool.consumed ?? {}) };

    const available =
      n(pool.purchased, sku) - n(reserved, sku) - n(consumed, sku);
    const overage = available < units;
    if (overage && policy === "hard") {
      throw new Error("QUOTA_EXHAUSTED");
    }

    reserved[sku] = n(reserved, sku) + units;

    const update: Partial<QuotaPool> & Record<string, unknown> = {
      reserved,
      updatedAt: FieldValue.serverTimestamp() as unknown as Timestamp,
    };
    if (reset) {
      update.consumed = consumed;
      update.periodStart = monthStart;
    }
    tx.update(poolRef, update);
    return { poolOrgId, overage };
  });
}

/**
 * Finalize a reservation: move `units` from reserved → consumed and append an
 * immutable usage-ledger entry (the invoice source of truth).
 */
export async function consumeQuota(params: {
  poolOrgId: string;
  clientId: string;
  path: string[];
  sku: SKU;
  units: number;
  pentestId: string;
  overage: boolean;
  idempotencyKey?: string;
}): Promise<void> {
  const poolRef = adminDb
    .collection(COLLECTIONS.quotaPools)
    .doc(params.poolOrgId);
  const ledgerRef = adminDb.collection(COLLECTIONS.usageLedger).doc();

  await adminDb.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(poolRef);
    if (!snap.exists) throw new Error("NO_POOL");
    const pool = snap.data() as QuotaPool;

    const reserved = { ...(pool.reserved ?? {}) };
    const consumed = { ...(pool.consumed ?? {}) };
    // Clamp reserved at 0 — never go negative if a reservation was already released.
    reserved[params.sku] = Math.max(0, n(reserved, params.sku) - params.units);
    consumed[params.sku] = n(consumed, params.sku) + params.units;

    tx.update(poolRef, {
      reserved,
      consumed,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const entry: Omit<UsageLedgerEntry, "createdAt"> & { createdAt: unknown } =
      {
        id: ledgerRef.id,
        poolOrgId: params.poolOrgId,
        clientId: params.clientId,
        path: params.path,
        sku: params.sku,
        units: params.units,
        kind: (params.overage ? "overage" : "consume") as UsageKind,
        overage: params.overage,
        pentestId: params.pentestId,
        ...(params.idempotencyKey
          ? { idempotencyKey: params.idempotencyKey }
          : {}),
        createdAt: FieldValue.serverTimestamp(),
      };
    tx.set(ledgerRef, entry);
  });
}

/**
 * Release a reservation without consuming it (e.g. the launch failed before the
 * scan started). Decrements reserved and writes a `release` ledger entry.
 */
export async function releaseQuota(params: {
  poolOrgId: string;
  clientId: string;
  path: string[];
  sku: SKU;
  units: number;
  pentestId: string;
}): Promise<void> {
  const poolRef = adminDb
    .collection(COLLECTIONS.quotaPools)
    .doc(params.poolOrgId);
  const ledgerRef = adminDb.collection(COLLECTIONS.usageLedger).doc();

  await adminDb.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(poolRef);
    if (!snap.exists) throw new Error("NO_POOL");
    const pool = snap.data() as QuotaPool;

    const reserved = { ...(pool.reserved ?? {}) };
    reserved[params.sku] = Math.max(0, n(reserved, params.sku) - params.units);

    tx.update(poolRef, {
      reserved,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(ledgerRef, {
      id: ledgerRef.id,
      poolOrgId: params.poolOrgId,
      clientId: params.clientId,
      path: params.path,
      sku: params.sku,
      units: params.units,
      kind: "release" as UsageKind,
      overage: false,
      pentestId: params.pentestId,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}
