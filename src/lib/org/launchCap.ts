import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { COLLECTIONS } from "./collections";

/**
 * Downstream spend-control enforcement for the METERED path.
 *
 * A distributor sets a per-cycle IP cap on its downstream clients/resellers
 * (see docs/product-model.md "Quotas"): hard = block the whole launch at the
 * ceiling; soft = allow + meter the overage as billable. The consolidated buyer
 * (the supplier/distributor itself) has NO cap — caps only exist below it.
 *
 * Consumption is counted from the launcher's subtree's pentest docs this cycle
 * (`orgPath` array-contains the org), summing `billableIps`. Only launched-and-not-
 * failed pentests count (in-flight + completed) so a burst can't outrun the cap.
 */

export interface LaunchCapCheck {
  allowed: boolean;
  /** null = no cap set on this node → unlimited. */
  policy: "hard" | "soft" | null;
  cap: number | null;
  consumed: number;
  needed: number;
  /** soft cap exceeded → the launch runs but the excess is billable overage. */
  overage: boolean;
  reason: string;
}

/** Start of the current UTC month (the metered billing cycle). */
function monthStartMillis(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

/** Sum billable IPs launched this cycle across an org's subtree (from pentests). */
async function consumedThisCycle(orgId: string): Promise<number> {
  // Single-field array-contains is auto-indexed; date is filtered in memory to
  // avoid a composite index.
  const snap = await adminDb
    .collection("pentests")
    .where("orgPath", "array-contains", orgId)
    .get();
  const start = monthStartMillis();
  let total = 0;
  for (const d of snap.docs) {
    const p = d.data();
    if (p.status === "failed") continue;
    const created = p.createdAt;
    const ms =
      created && typeof created.toMillis === "function"
        ? created.toMillis()
        : 0;
    if (ms >= start) {
      total += typeof p.billableIps === "number" ? p.billableIps : 1;
    }
  }
  return total;
}

/**
 * Check a prospective launch of `needed` IPs by `orgId` against its IP cap.
 * No cap on the node → allowed (unlimited). Hard cap exceeded → blocked. Soft
 * cap exceeded → allowed with `overage`.
 */
export async function checkLaunchCap(
  orgId: string | null | undefined,
  needed: number,
): Promise<LaunchCapCheck> {
  const base = { needed, overage: false };
  if (!orgId) {
    return { ...base, allowed: true, policy: null, cap: null, consumed: 0, reason: "no_org" };
  }

  const capDoc = await adminDb.collection(COLLECTIONS.orgCaps).doc(orgId).get();
  const data = capDoc.data();
  const cap: number | undefined = data?.caps?.ip;
  const policy: "hard" | "soft" = data?.policy?.ip === "soft" ? "soft" : "hard";

  if (cap == null || cap < 0) {
    return { ...base, allowed: true, policy: null, cap: null, consumed: 0, reason: "no_cap" };
  }

  const consumed = await consumedThisCycle(orgId);
  const exceeded = consumed + needed > cap;

  if (!exceeded) {
    return { ...base, allowed: true, policy, cap, consumed, reason: "ok" };
  }
  if (policy === "soft") {
    return { ...base, allowed: true, policy, cap, consumed, overage: true, reason: "soft_overage" };
  }
  return { ...base, allowed: false, policy, cap, consumed, reason: "hard_cap_exceeded" };
}
