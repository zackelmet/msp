/**
 * Set up Compulab (Luis Costa) as a consolidated buyer on the platform.
 *
 * Fixed 3-level model: supplier → reseller → client. Compulab is a *distributor*,
 * which in our model = a **supplier** (top-level consolidated buyer holding the
 * commercial relationship). A supplier selling direct uses a "house" reseller, so
 * Luis is both distributor (supplier) and reseller (the house node), mirroring how
 * MSP Pentesting itself is set up (org_msp → org_msp_house → client).
 *
 * What it does (idempotent):
 *   1. Creates the Compulab supplier root, its house reseller, and a default client.
 *   2. Promotes Luis (uid below, lc@compulab.pt) to supplier_admin of Compulab.
 *   3. Grants Luis one AI-pentest credit so he can launch a test (live credit path).
 *
 * SAFETY: dry-run by default. Pass --commit to write. Needs FIREBASE_SERVICE_ACCOUNT_KEY
 * in .env.local (project msp-pentesting).
 *
 *   node scripts/setupCompulab.js            # dry run, prints a plan
 *   node scripts/setupCompulab.js --commit   # apply
 */

require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");

const COMMIT = process.argv.slice(2).includes("--commit");

const IDS = {
  supplier: "org_compulab", // Compulab as distributor/supplier (consolidated buyer)
  reseller: "org_compulab_house", // house reseller for Compulab's direct sales
  client: "org_compulab_client", // default client under the house reseller
  tier: "tier_starter", // reuse the existing Starter tier
};
const LUIS_UID = "vHxug1vvJLQGbXtdIRDEtiE89bl1"; // lc@compulab.pt

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw || !raw.trim().startsWith("{")) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY missing/invalid in .env.local");
  }
  const sa = JSON.parse(raw);
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const plan = [];
function log(action, detail) {
  plan.push({ action, detail });
  console.log(`  ${COMMIT ? "✔" : "•"} ${action}: ${detail}`);
}

async function ensureDoc(db, coll, id, data, label) {
  const ref = db.collection(coll).doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    log("skip (exists)", `${coll}/${id} — ${label}`);
    return ref;
  }
  log("create", `${coll}/${id} — ${label}`);
  if (COMMIT) await ref.set(data, { merge: true });
  return ref;
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const ts = admin.firestore.FieldValue.serverTimestamp();

  console.log(`\n=== setupCompulab (${COMMIT ? "COMMIT" : "DRY RUN"}) ===\n`);

  // 1. Compulab org tree ---------------------------------------------------
  await ensureDoc(db, "orgs", IDS.supplier, {
    id: IDS.supplier,
    type: "supplier",
    parentOrgId: null,
    path: [IDS.supplier],
    name: "Compulab",
    slug: "compulab",
    billing: { mode: "consolidated" },
    status: "active",
    createdAt: ts,
    createdBy: "system:setupCompulab",
  }, "Compulab supplier root (distributor / consolidated buyer)");

  await ensureDoc(db, "orgs", IDS.reseller, {
    id: IDS.reseller,
    type: "reseller",
    parentOrgId: IDS.supplier,
    path: [IDS.supplier, IDS.reseller],
    name: "Compulab (Direct)",
    slug: "compulab-house",
    tierId: IDS.tier,
    billing: { mode: "inherited" },
    status: "active",
    createdAt: ts,
    createdBy: "system:setupCompulab",
  }, "Compulab house reseller (direct sales)");

  await ensureDoc(db, "orgs", IDS.client, {
    id: IDS.client,
    type: "client",
    parentOrgId: IDS.reseller,
    path: [IDS.supplier, IDS.reseller, IDS.client],
    name: "Compulab Default Client",
    slug: "compulab-default-client",
    billing: { mode: "inherited" },
    status: "active",
    createdAt: ts,
    createdBy: "system:setupCompulab",
  }, "Compulab default client");

  // 2. Promote Luis to supplier_admin of Compulab + 3. grant 1 AI credit ---
  const userRef = db.collection("users").doc(LUIS_UID);
  const snap = await userRef.get();
  if (!snap.exists) {
    log("WARN", `users/${LUIS_UID} not found — cannot attach Luis or grant credit`);
  } else {
    const u = snap.data() || {};
    log("update", `users/${LUIS_UID} (${u.email || "?"}) → supplier_admin @ ${IDS.supplier}, prev role=${u.role || "-"} org=${u.orgId || "-"}`);
    log("credit", `users/${LUIS_UID}.credits.ai_pentest → 1 (was ${u.credits && u.credits.ai_pentest != null ? u.credits.ai_pentest : "unset"})`);
    if (COMMIT) {
      await userRef.set({
        orgId: IDS.supplier,
        orgPath: [IDS.supplier],
        role: "supplier_admin",
        credits: { ai_pentest: 1 }, // merge — preserves any existing credit keys
        updatedAt: ts,
      }, { merge: true });
    }
  }

  console.log(`\n${COMMIT ? "Applied" : "Would apply"} ${plan.length} step(s). ${COMMIT ? "" : "Re-run with --commit to write.\n"}`);
  process.exit(0);
}

main().catch((e) => { console.error("setupCompulab failed:", e); process.exit(1); });
