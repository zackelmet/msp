/**
 * Phase 1 migration — backfill the flat, user-centric data model into the
 * multi-tenant org tree used by the consolidated-buying platform.
 *
 * What it does (idempotent):
 *   1. Creates the platform root org, a default reseller, and a default tenant.
 *   2. Seeds a "Starter" tier and attaches it to the default reseller.
 *   3. Attaches every existing user to the default tenant (orgId/orgPath/role).
 *   4. Stamps every existing pentest with { resellerId, tenantId }.
 *   5. (optional) Seeds a soft quota pool on the reseller for testing.
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
  platform: "org_platform",
  reseller: "org_default_reseller",
  tenant: "org_default_tenant",
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

  // 1. Org tree skeleton --------------------------------------------------
  await ensureDoc(
    db,
    "orgs",
    IDS.platform,
    {
      id: IDS.platform,
      type: "platform",
      parentOrgId: null,
      path: [IDS.platform],
      name: "MSP Pentesting",
      slug: "platform",
      billing: { mode: "consolidated" },
      status: "active",
      createdAt: ts,
      createdBy: "system:migrateOrgs",
    },
    "platform root",
  );

  await ensureDoc(
    db,
    "orgs",
    IDS.reseller,
    {
      id: IDS.reseller,
      type: "reseller",
      parentOrgId: IDS.platform,
      path: [IDS.platform, IDS.reseller],
      name: "Default Reseller",
      slug: "default",
      tierId: IDS.tier,
      billing: { mode: "direct" },
      status: "active",
      createdAt: ts,
      createdBy: "system:migrateOrgs",
    },
    "default reseller",
  );

  await ensureDoc(
    db,
    "orgs",
    IDS.tenant,
    {
      id: IDS.tenant,
      type: "tenant",
      parentOrgId: IDS.reseller,
      path: [IDS.platform, IDS.reseller, IDS.tenant],
      name: "Default Tenant",
      slug: "default-tenant",
      billing: { mode: "inherited" },
      status: "active",
      createdAt: ts,
      createdBy: "system:migrateOrgs",
    },
    "default tenant (existing users land here)",
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
      scanners: ["nmap", "zap"],
      limits: { pentestsPerMonth: 0, concurrentJobs: 2, tenantsMax: 0 },
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

  // 3. Optional soft quota pool on the reseller --------------------------
  if (SEED_POOL > 0) {
    const poolRef = db.collection("quotaPools").doc(IDS.reseller);
    const exists = (await poolRef.get()).exists;
    if (exists) {
      log("skip (exists)", `quotaPools/${IDS.reseller}`);
    } else {
      log(
        "create",
        `quotaPools/${IDS.reseller} — soft ai_pentest=${SEED_POOL}`,
      );
      if (COMMIT)
        await poolRef.set({
          orgId: IDS.reseller,
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
    const role = d.isAdmin ? "platform_admin" : "tenant_user";
    userUpdated++;
    if (COMMIT) {
      await doc.ref.set(
        {
          orgId: IDS.tenant,
          orgPath: [IDS.platform, IDS.reseller, IDS.tenant],
          role,
          updatedAt: ts,
        },
        { merge: true },
      );
    }
  }
  log(
    "users",
    `${userUpdated} attached to default tenant, ${userSkipped} skipped (already have orgId)`,
  );

  // 5. Stamp pentests -----------------------------------------------------
  const ptSnap = await db.collection("pentests").get();
  let ptUpdated = 0,
    ptSkipped = 0;
  for (const doc of ptSnap.docs) {
    const d = doc.data() || {};
    if (d.tenantId && d.resellerId && !FORCE) {
      ptSkipped++;
      continue;
    }
    ptUpdated++;
    if (COMMIT) {
      await doc.ref.set(
        { resellerId: IDS.reseller, tenantId: IDS.tenant, updatedAt: ts },
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
