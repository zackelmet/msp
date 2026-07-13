# Compulab — Consolidated Buying Program (Partnership Notes)

_Last updated: 2026-07-12_

**Contact:** Luis Costa, COMPULAB (Lisbon). First call 2026-07-10; follow-up to be booked.
**Ask:** enable the MSPP platform for Compulab's **consolidated buying program** for pentests —
white-labeled, multi-tiered, multi-tenant across their partners, resellers, and clients, with API
provisioning and hard/soft quotas.

---

## The "app image" question — reframed

Three different things get conflated; only one is what Compulab actually needs:

1. **API-first (hosted)** — expose versioned `/api/v1` + `mspp_live_` keys; Compulab's systems hit
   *our* endpoints to provision MSPs, launch pentests, pull results. Nothing ships to them.
   **This is what "API connections for automatic provisioning" means, and it's already our HANDOFF design.**
2. **White-label portal** — each MSP gets a branded instance of our dashboard at their own
   subdomain/logo. Still our hosted multi-tenant app, just themed per-org. (Likely the "app people use" image.)
3. **App image (self-hosted appliance / Docker/OVA)** — partners run our software *in their own cloud*.
   Genuinely different, much heavier product: offline licensing, update channel, packaging scanner
   runners, support burden. Only justified by a hard data-residency / air-gap requirement.

**Recommendation: do #1 + #2, not #3.** The API *is* the partner surface; the white-label portal is the
human surface. Don't distribute an appliance unless Compulab explicitly requires the software to run
inside their infrastructure — that's a direct question for Luis, not an assumption to build on.

---

## Where "consolidated buying" breaks the current design

Compulab is a **distributor sitting *above* the MSPs** — they buy capacity in bulk and allocate it
down. Luis said "your partners, resellers **and** their clients" = three layers under Compulab.

1. **Add a distributor level (or go N-level).** Current tree is `Platform → Reseller/MSP → Tenant`.
   Model orgs as a tree instead: `{ id, parentOrgId, type: platform|distributor|reseller|tenant }`.
   Compulab = distributor, MSPs = resellers, end customers = tenants. Cheapest to do **now** vs.
   retrofitting. Flat-collection + denormalized-path approach still works — carry the full ancestor path.

2. **Model quota as a consumable pool, not just a monthly tier limit.** Compulab prepurchases a pool
   (e.g. 200 AI pentests) and allocates sub-quotas per MSP. `pentestsPerMonth` is a per-org *rate*
   limit — a different concept. Want `{ purchased, allocated, reserved, consumed }` at each node;
   entitlement check walks *up* the tree.
   - **Hard quota** = block provisioning at the ceiling.
   - **Soft quota** = warn + allow overage, metered for billing.
   This is the "hard and soft quota systems you outlined."

3. **Decouple billing from provisioning.** Consolidated = **one invoice to Compulab**, net terms, for
   the pool. Downstream MSPs never touch Stripe. Current Stripe-per-user-credits flow is the wrong
   shape — want usage metering → monthly rollup → single distributor invoice (Stripe Invoicing or a
   usage export they reconcile).

---

## Additional ideas to raise

- **Outbound webhooks** — auto-provisioning is bidirectional; push `pentest.completed` / `report.ready`
  (signed) to Compulab instead of polling. Current design only has *inbound* runner callbacks.
- **Test-mode keys** (`mspp_test_`) — build integration without launching/paying for real scans.
- **Per-node usage/reporting endpoint** — "consumption across all my MSPs this month" is table stakes.
- **Idempotency keys** on `POST /pentests` — automated callers retry; avoid dup launches billed to the pool.
- **White-label config on the org node** (logo, colors, CNAME, report cover, email sender), inherits down.

---

## Questions to pin down with Luis (next call)

1. Does anything need to run **inside their infrastructure**, or is a hosted API + keys acceptable?
   (Kills or confirms the app-image path.)
2. Who owns the **customer relationship and billing** — Compulab consolidated, or MSPs pay us directly?
   (Confirms the pool/invoice model.)
3. Exact **quota semantics** — pool at Compulab level, sub-allocated per MSP? Overage allowed or hard-blocked?
4. White-label at the **Compulab brand**, per-MSP brand, or both?
