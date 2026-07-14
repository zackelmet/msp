/**
 * Phase 1 migration — backfill the flat, user-centric data model into the
 * multi-tenant org tree used by the consolidated-buying platform.
 *
 * Fixed 3-level model: supplier → reseller → client. MSP Pentesting is itself
 * the supplier for its own direct business; direct clients sit under a "house"
 * reseller node beneath it. The single quota pool lives on the supplier.
 *
 * What it does (idempotent):
 *   1. Creates the MSPP supplier root, its house reseller, and a default client.
 *   2. Seeds a "Starter" tier and attaches it to the house reseller.
 *   3. Attaches every existing user to the default client (orgId/orgPath/role).
 *   4. Stamps every existing pentest with { resellerId, clientId }.
 *   5. (optional) Seeds a soft quota pool on the SUPPLIER for testing.
 *
 * SAFETY: dry-run by default. Pass --commit to write. Run against prod with
 * Firebase Admin credentials present in the environment (this repo keeps them
 * in Vercel, not in the checked-out .env.local).
 *
 *   node scripts/migrateOrgs.js                 # dry run, prints a plan
 *   node scripts/migrateOrgs.js --commit        # apply
 *   node scripts/migrateOrgs.js --commit --seed-pool=200   # + soft ai_pentest pool
 *   node scripts/migrateOrgs.js --commit --force           # re-stamp users that already have orgId
 */

require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const FORCE = args.includes("--force");
const seedPoolArg = args.find((a) => a.startsWith("--seed-pool="));
const SEED_POOL = seedPoolArg ? parseInt(seedPoolArg.split("=")[1], 10) : 0;

// Stable ids so the migration is idempotent.
const IDS = {
  supplier: "org_msp", // MSP Pentesting as supplier (holds the pool)
  reseller: "org_msp_house", // house reseller for MSPP direct sales
  client: "org_msp_direct_client", // default client; existing users land here
  tier: "tier_starter",
};

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw && raw.trim().startsWith("{")) {
    const sa = JSON.parse(raw);
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    return;
  }
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
    process.env.FIREBASE_PRIVATE_KEY ||
    ""
  ).replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
    return;
  }
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
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

  console.log(
    `\n=== migrateOrgs (${COMMIT ? "COMMIT" : "DRY RUN"}${FORCE ? " +force" : ""}${
      SEED_POOL ? ` +seed-pool=${SEED_POOL}` : ""
    }) ===\n`,
  );

  // 1. Org tree skeleton (supplier → reseller → client) -------------------
  await ensureDoc(
    db,
    "orgs",
    IDS.supplier,
    {
      id: IDS.supplier,
      type: "supplier",
      parentOrgId: null,
      path: [IDS.supplier],
      name: "MSP Pentesting",
      slug: "msp",
      billing: { mode: "consolidated" },
      status: "active",
      createdAt: ts,
      createdBy: "system:migrateOrgs",
    },
    "MSPP supplier root (holds the pool)",
  );

  await ensureDoc(
    db,
    "orgs",
    IDS.reseller,
    {
      id: IDS.reseller,
      type: "reseller",
      parentOrgId: IDS.supplier,
      path: [IDS.supplier, IDS.reseller],
      name: "MSP Pentesting (Direct)",
      slug: "house",
      tierId: IDS.tier,
      billing: { mode: "inherited" },
      status: "active",
      createdAt: ts,
      createdBy: "system:migrateOrgs",
    },
    "house reseller (MSPP direct sales)",
  );

  await ensureDoc(
    db,
    "orgs",
    IDS.client,
    {
      id: IDS.client,
      type: "client",
      parentOrgId: IDS.reseller,
      path: [IDS.supplier, IDS.reseller, IDS.client],
      name: "Default Client",
      slug: "default-client",
      billing: { mode: "inherited" },
      status: "active",
      createdAt: ts,
      createdBy: "system:migrateOrgs",
    },
    "default client (existing users land here)",
  );

  // 2. Starter tier -------------------------------------------------------
  await ensureDoc(
    db,
    "tiers",
    IDS.tier,
    {
      id: IDS.tier,
      name: "Starter",
      skus: ["ai_pentest", "external", "web_app", "manual"],
      limits: { pentestsPerMonth: 0, concurrentJobs: 2, clientsMax: 0 },
      features: {
        apiAccess: true,
        scheduledScans: false,
        whiteLabel: false,
        outboundWebhooks: false,
      },
      createdAt: ts,
    },
    "Starter tier",
  );

  // 3. Optional soft quota pool on the SUPPLIER --------------------------
  if (SEED_POOL > 0) {
    const poolRef = db.collection("quotaPools").doc(IDS.supplier);
    const exists = (await poolRef.get()).exists;
    if (exists) {
      log("skip (exists)", `quotaPools/${IDS.supplier}`);
    } else {
      log(
        "create",
        `quotaPools/${IDS.supplier} — soft ai_pentest=${SEED_POOL}`,
      );
      if (COMMIT)
        await poolRef.set({
          orgId: IDS.supplier,
          purchased: { ai_pentest: SEED_POOL },
          reserved: {},
          consumed: {},
          replenish: "one_time",
          policy: { ai_pentest: "soft" },
          createdAt: ts,
        });
    }
  }

  // 4. Attach users -------------------------------------------------------
  const usersSnap = await db.collection("users").get();
  let userUpdated = 0,
    userSkipped = 0;
  for (const doc of usersSnap.docs) {
    const d = doc.data() || {};
    if (d.orgId && !FORCE) {
      userSkipped++;
      continue;
    }
    const role = d.isAdmin ? "platform_admin" : "client_user";
    userUpdated++;
    if (COMMIT) {
      await doc.ref.set(
        {
          orgId: IDS.client,
          orgPath: [IDS.supplier, IDS.reseller, IDS.client],
          role,
          updatedAt: ts,
        },
        { merge: true },
      );
    }
  }
  log(
    "users",
    `${userUpdated} attached to default client, ${userSkipped} skipped (already have orgId)`,
  );

  // 5. Stamp pentests -----------------------------------------------------
  const ptSnap = await db.collection("pentests").get();
  let ptUpdated = 0,
    ptSkipped = 0;
  for (const doc of ptSnap.docs) {
    const d = doc.data() || {};
    if (d.clientId && d.resellerId && !FORCE) {
      ptSkipped++;
      continue;
    }
    ptUpdated++;
    if (COMMIT) {
      await doc.ref.set(
        { resellerId: IDS.reseller, clientId: IDS.client, updatedAt: ts },
        { merge: true },
      );
    }
  }
  log(
    "pentests",
    `${ptUpdated} stamped, ${ptSkipped} skipped (already stamped)`,
  );

  console.log(
    `\n${COMMIT ? "Applied" : "Would apply"} ${plan.length} step(s). ${
      COMMIT ? "" : "Re-run with --commit to write.\n"
    }`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("migrateOrgs failed:", e);
  process.exit(1);
});
