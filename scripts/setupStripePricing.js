#!/usr/bin/env node
/**
 * Per-IP AI-pentest METERED billing (post-paid, monthly, graduated).
 *
 * Creates one Product + one metered recurring Price with graduated tiers:
 *   1-100 IPs   $10.00 / IP
 *   101-1000    $8.00  / IP
 *   1001+       $6.00  / IP
 *
 * usage_type=metered + aggregate_usage=sum → nothing charged up front; each
 * cycle Stripe sums reported usage (IPs consumed) and invoices post-paid at the
 * graduated rates. The app reports a usage record per IP when a pentest completes.
 * Only the consolidated buyer (supplier) is subscribed/billed.
 *
 * SAFETY: dry-run by default. Pass --commit to create LIVE objects.
 * Needs STRIPE_SECRET_KEY in the environment.
 *
 *   node scripts/setupStripePricing.js            # dry run
 *   node scripts/setupStripePricing.js --commit   # create (LIVE)
 */

require("dotenv").config({ path: ".env.local" });
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const COMMIT = process.argv.includes("--commit");

const PRODUCT_NAME = "AI Pentest (per IP)";
const PRICE_LOOKUP = "ai_pentest_per_ip_metered_v1";
const TIERS = [
  { up_to: 100, unit_amount: 1000 }, // $10.00 / IP  (1-100)
  { up_to: 1000, unit_amount: 800 }, // $8.00  / IP  (101-1000)
  { up_to: "inf", unit_amount: 600 }, // $6.00 / IP  (1001+)
];

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY missing");
  console.log(`\n=== setupStripePricing (${COMMIT ? "COMMIT — LIVE" : "DRY RUN"}) ===\n`);

  // Idempotency: bail if the price already exists (lookup_key).
  const existing = await stripe.prices.list({
    lookup_keys: [PRICE_LOOKUP],
    active: true,
    limit: 1,
  });
  if (existing.data.length) {
    const p = existing.data[0];
    console.log(`• price already exists: ${p.id} (lookup_key ${PRICE_LOOKUP})`);
    console.log(`  product: ${p.product} — nothing to do.\n`);
    return;
  }

  // Product (find by name, else create).
  const products = await stripe.products.list({ active: true, limit: 100 });
  let product = products.data.find((p) => p.name === PRODUCT_NAME);
  if (product) {
    console.log(`• product exists: ${product.id} (${PRODUCT_NAME})`);
  } else {
    console.log(`${COMMIT ? "✔" : "•"} create product "${PRODUCT_NAME}"`);
    if (COMMIT) {
      product = await stripe.products.create({
        name: PRODUCT_NAME,
        description:
          "AI-driven penetration test, billed per live IP tested. Post-paid monthly on actual consumption.",
      });
      console.log(`  → ${product.id}`);
    }
  }

  // Graduated metered price.
  console.log(`${COMMIT ? "✔" : "•"} create graduated metered price (monthly, sum, post-paid):`);
  console.log("    1-100 = $10.00/IP · 101-1000 = $8.00/IP · 1001+ = $6.00/IP");
  if (COMMIT) {
    const price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      nickname: "AI Pentest — per IP (graduated, metered)",
      lookup_key: PRICE_LOOKUP,
      billing_scheme: "tiered",
      tiers_mode: "graduated",
      tiers: TIERS,
      recurring: {
        interval: "month",
        usage_type: "metered",
        aggregate_usage: "sum",
      },
    });
    console.log(`  → ${price.id}`);
    await stripe.products
      .update(product.id, { default_price: price.id })
      .catch(() => {});
    console.log(
      `\nDONE (LIVE). Add to Vercel env: NEXT_PUBLIC_STRIPE_PRICE_AI_PER_IP=${price.id}\n`,
    );
  } else {
    console.log("\nDry run — re-run with --commit to create in LIVE Stripe.\n");
  }
}

main().catch((e) => {
  console.error("setupStripePricing failed:", e.message || e);
  process.exit(1);
});
