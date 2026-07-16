/**
 * Subscribe the consolidated buyer (Compulab) to the metered per-IP AI-pentest
 * price, so completed pentests can report usage against it (post-paid, monthly).
 *
 * Billing model (docs/product-model.md): only the supplier at the tree root is
 * billed, on ACTUAL consumption across its subtree. This creates a send-invoice
 * (net-terms) subscription to the graduated metered price — no card on file, one
 * consolidated invoice per cycle — and stores the customer / subscription / item
 * ids on org_compulab.billing so /api/pentests can meter completions.
 *
 * Idempotent: reuses an existing customer/subscription item if already stored.
 *
 * SAFETY: dry-run by default. Pass --commit to create LIVE Stripe objects.
 * Needs FIREBASE_SERVICE_ACCOUNT_KEY + STRIPE_SECRET_KEY in .env.local.
 *
 *   node scripts/subscribeCompulab.js            # dry run, prints a plan
 *   node scripts/subscribeCompulab.js --commit   # apply (LIVE)
 */

require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const COMMIT = process.argv.slice(2).includes("--commit");

const SUPPLIER_ORG_ID = "org_compulab";
const PRICE_LOOKUP = "ai_pentest_per_ip_metered_v1";
const NET_TERMS_DAYS = 30;
// send_invoice subscriptions require an email on the customer to deliver the
// invoice. This is the consolidated buyer's billing contact (Luis / Compulab).
const BILLING_EMAIL = "lc@compulab.pt";

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

function log(action, detail) {
  console.log(`  ${COMMIT ? "✔" : "•"} ${action}: ${detail}`);
}

/** Find the per-IP metered price by lookup_key, falling back to the env id. */
async function resolvePrice() {
  const byLookup = await stripe.prices.list({
    lookup_keys: [PRICE_LOOKUP],
    active: true,
    limit: 1,
  });
  if (byLookup.data.length) return byLookup.data[0];

  const envId = process.env.NEXT_PUBLIC_STRIPE_PRICE_AI_PER_IP;
  if (envId) {
    const p = await stripe.prices.retrieve(envId);
    if (p && p.active) return p;
  }
  throw new Error(
    `metered price not found (lookup_key ${PRICE_LOOKUP} or NEXT_PUBLIC_STRIPE_PRICE_AI_PER_IP) — run setupStripePricing.js first`,
  );
}

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY missing");
  initAdmin();
  const db = admin.firestore();

  console.log(`\n=== subscribeCompulab (${COMMIT ? "COMMIT — LIVE" : "DRY RUN"}) ===\n`);

  const orgRef = db.collection("orgs").doc(SUPPLIER_ORG_ID);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    throw new Error(`${SUPPLIER_ORG_ID} not found — run setupCompulab.js --commit first`);
  }
  const org = orgSnap.data() || {};
  const billing = org.billing || {};

  if (billing.stripeSubscriptionItemId) {
    log("skip (subscribed)", `${SUPPLIER_ORG_ID} already has item ${billing.stripeSubscriptionItemId}`);
    console.log("\nNothing to do.\n");
    return;
  }

  const price = await resolvePrice();
  log("price", `${price.id} (${price.lookup_key || "no lookup_key"})`);

  // 1. Stripe customer (reuse stored id, else create) ----------------------
  let customerId = billing.stripeCustomerId;
  if (customerId) {
    log("skip (customer exists)", customerId);
  } else {
    log("create customer", `${org.name || "Compulab"} (send-invoice, net ${NET_TERMS_DAYS})`);
    if (COMMIT) {
      const customer = await stripe.customers.create({
        name: org.name || "Compulab",
        email: BILLING_EMAIL,
        description: `Consolidated buyer — ${SUPPLIER_ORG_ID}`,
        metadata: { orgId: SUPPLIER_ORG_ID, role: "supplier" },
      });
      customerId = customer.id;
      log("  →", customerId);
      // Persist immediately so a later failure (e.g. missing Subscriptions
      // Write scope) doesn't orphan the customer + duplicate it on re-run.
      await orgRef.update({
        "billing.stripeCustomerId": customerId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  // 2. Metered subscription (send-invoice / net terms) ---------------------
  log("create subscription", `metered per-IP, collection_method=send_invoice, days_until_due=${NET_TERMS_DAYS}`);
  let subscriptionId = "sub_DRYRUN";
  let subscriptionItemId = "si_DRYRUN";
  if (COMMIT) {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      collection_method: "send_invoice",
      days_until_due: NET_TERMS_DAYS,
      metadata: { orgId: SUPPLIER_ORG_ID, sku: "ai_pentest_per_ip" },
    });
    subscriptionId = subscription.id;
    subscriptionItemId = subscription.items.data[0].id;
    log("  →", `sub ${subscriptionId}, item ${subscriptionItemId}`);
  }

  // 3. Persist ids on the org billing --------------------------------------
  const billingUpdate = {
    "billing.stripeCustomerId": customerId || null,
    "billing.stripeSubscriptionId": subscriptionId,
    "billing.stripeSubscriptionItemId": subscriptionItemId,
    "billing.stripePriceId": price.id,
    "billing.netTerms": NET_TERMS_DAYS,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  log("update org", `${SUPPLIER_ORG_ID}.billing ← customer/subscription/item ids`);
  if (COMMIT) {
    await orgRef.update(billingUpdate);
    console.log(
      `\nDONE (LIVE). ${SUPPLIER_ORG_ID} subscribed — completions now meter to item ${subscriptionItemId}.\n`,
    );
  } else {
    console.log("\nDry run — re-run with --commit to create in LIVE Stripe.\n");
  }
}

main().catch((e) => {
  console.error("subscribeCompulab failed:", e.message || e);
  process.exit(1);
});
