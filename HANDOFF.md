# MSPP Dashboard — Handoff

_Last updated: 2026-07-14_

> **See `ROADMAP.md` for the prioritized dev plan** (P1 run-real-pentests → P2 consolidated-buyer
> platform → P3 Acronis-north-star UX), set after the 2nd Luis/Compulab meeting. North-star UX
> teardown in `docs/north-star-acronis.md`. This file tracks the P2 Phase-1 build detail below.

## ✅ P1 progress (2026-07-14 session)
- **P1.2 — pentest auth hardened (commit bd3ec9e).** `/api/pentests` POST+GET and `/api/pentests/[id]`
  GET no longer trust a client-supplied `userId` (the POST spends credits) — all three use
  `verifyAuthToken`; frontend callers now send the Firebase ID token as a Bearer header.
- **P1.1 — dead GCP scanner code removed (commit 63606c6).** Deleted `scannerClient.ts`, `/api/scans/**`,
  `/api/ai-pentest`, and the two nav-unlinked pages (`/app/ai-pentest`, `/app/scans`). Make.com is the
  only engine. `tsc` + `next build` clean. _Follow-up:_ `src/lib/gcp/storageClient.ts` also looks dead
  (no importers) — left in place, confirm before removing.
- **Next P1:** P1.3 (port AIP report-engine — largest missing subsystem), P1.5 (wire-or-retire
  `/api/launch-pentest`), P1.6 (env-ify hardcoded Make URL + verify the Make PATCH callback).

## ✅ Org model refactored: N-level → fixed 3-level (2026-07-14)

Decision by Zack (backed by the full Luis/Compulab call transcript). The Phase-1 org code was built
N-level (arbitrary depth, `distributor` above `reseller`); trimmed to a **fixed 3-level tree**:

```
supplier → reseller → client        (Luis/Acronis vocab: master → reseller → end client)
```

- **No sub-resellers.** A supplier selling direct uses a "house" reseller node → always exactly 3 deep.
- **Supplier holds the single quota pool** (`resolvePoolOrgId` is now just `path[0]`) and is billed
  **post-paid** on its subtree's **consolidated** consumption (one invoice; downstream MSPs never
  touch Stripe). One billing model only (Luis: "you should have only one").
- **MSP Pentesting is itself a supplier** (its own direct clients live under an MSPP "house" reseller)
  **and** operates the platform: `platform_admin` users see across every supplier tree. Compulab is a
  second supplier. Migration seeds `org_msp` (supplier) → `org_msp_house` (reseller) → `org_msp_direct_client`.
- **Soft/hard quotas per client** — Luis's Acronis "sell this client 2 servers" example:
  **hard** = block at the ceiling; **soft** = allow the overage, meter it as billable, notify of excess.
  Modeled by `QuotaPool.policy` + `QuotaCaps.policy` (per-SKU) + `usageLedger` `overage` entries.
- **White-label = reports + the end-client portal** (NOT necessarily the dashboard), driven by the
  **reseller's** logo / colors / footer contacts, with an on/off toggle (`OrgBranding.whiteLabelEnabled`).
- Roles: `platform_admin | supplier_admin | reseller_admin | client_user`.
- Renames: `tenant`→`client` (`tenantId`→`clientId`), `tenantsMax`→`clientsMax`, `isResellerAdmin`→
  `isPartnerAdmin` (rules). Touched: `types/{org,quota,usage,user,tier}`, `org/{tree,entitlement}`,
  `scripts/migrateOrgs.js`, `firestore.rules`, `docs/api-v1.md`. **tsc + build clean; nothing wired to
  live paths yet** (safe to iterate). Bridge insight for P3 UX: today's **"target group" ≈ a client**.

## 🟡 Control plane (Acronis north-star) — started (2026-07-14, commit e719439)
New **Platform** tab in the admin console: clients grid + drill-down (supplier→reseller→client,
breadcrumb to ascend), per-supplier quota-pool usage bars (soft/hard aware), white-label badge.
Read-only `/api/admin/orgs` (uid-cookie admin-gated). Shows empty state until the migration runs.
**Next on this:** editable provisioning screen — set soft/hard quotas + white-label settings inline.

## ⛔ One blocker to unblock everything Firebase-side (P2.0)
`.env.local` has `FIREBASE_SERVICE_ACCOUNT_KEY=` **empty**. Drop a real service-account JSON (Firebase
console → project `msp-pentesting` → Project settings → Service accounts → Generate new private key)
into that var (`.env.local` is gitignored). Then Claude can dry-run + `--commit` migrateOrgs and manage
Firebase directly. Without it the org tree stays empty and the Platform tab shows its empty state.

## ⏳ In progress: Phase 1 (data-model foundation) — BUILT, not yet migrated

The multi-tenant org-tree foundation for the consolidated-buying platform is now
implemented in code (see "Phased plan" below — Phase 1 was "design agreed; not started").
Nothing is wired into live launch paths yet; the legacy `users.credits` + Make.com flow
is untouched. New code:

- **Types:** `src/lib/types/org.ts` (OrgDocument tree + `canParent`), `tier.ts`, `quota.ts`
  (SKU pool `{purchased,reserved,consumed}` + caps + hard/soft policy), `apiKey.ts`, `usage.ts`
  (append-only ledger). `user.ts` extended with `orgId` / `orgPath[]` / `role`.
- **Helpers:** `src/lib/org/collections.ts` (collection names), `tree.ts` (path/ancestor/subtree
  reads, `resolveTier`/`resolveBranding`/`resolvePoolOrgId`), `entitlement.ts`
  (`checkEntitlement`, transactional `reserveQuota`/`consumeQuota`/`releaseQuota`, `subtreeConsumed`).
  Money invariant: pool draws are transactional on the single pool doc and re-checked inside the tx.
- **Migration:** `scripts/migrateOrgs.js` — dry-run by default; `--commit` writes. Creates
  platform→reseller→tenant skeleton, seeds a Starter tier, attaches existing users to the default
  tenant, stamps pentests with `{resellerId,tenantId}`. Optional `--seed-pool=N`.
- **Rules:** `firestore.rules` — org-scoped read for `orgs`/`tiers`/`quotaPools`/`orgCaps`/
  `usageLedger`/`provisioningJobs` via the user's `orgPath`; all writes server-side (Admin SDK).

**Verified:** `tsc --noEmit` 0 errors, ESLint clean, prettier-formatted. **Not yet run** against
prod (no creds in checkout) — operator must run `node scripts/migrateOrgs.js --commit`.

**Known Phase-1 limitation:** cap checks count *consumed* usage, not in-flight reservations
(pool-level reservation still prevents overselling). Refine once allocation model is locked with Luis.

**Next:** Phase 2 — API-key mint/verify + dual (key-or-Firebase-token) auth middleware.

---

## Active initiative: Pentest Provisioning API (Distributor → Reseller → Tenant)

Building a first-class API for **provisioning and launching pentests** with a multi-level
multi-tenancy model and scoped programmatic API keys, replacing the current flat,
Make.com-driven launch flow.

### Product surface locked (2026-07-13)
- **API-first (hosted)** — versioned `/api/v1` + `mspp_live_` keys; partners hit our endpoints. Nothing shipped.
- **White-label portal** — per-org branded instances of the hosted app (subdomain/logo), same multi-tenant app.
- **NOT** a self-hosted app image (revisit only if a hard data-residency requirement surfaces).
- Proposed endpoint reference: **`docs/api-v1.md`**.

### Driver: Compulab consolidated buying program (2026-07-12)
Compulab (Luis Costa) wants to run a **consolidated buying program** — a distributor buying pentest
capacity in bulk and allocating it down to their MSPs and clients. This reshapes the design below.
Full deal notes + open questions in **`COMPULAB_PARTNERSHIP.md`**. Key impacts:
- **N-level org tree** (add a **distributor** level above reseller) — Compulab = distributor, MSPs =
  resellers, end customers = tenants. Model orgs as `{ id, parentOrgId, type }`, not hard-coded 3 levels.
- **Consumable quota pool**, not just monthly tier limits — `{ purchased, allocated, reserved, consumed }`
  per node; entitlement walks up the tree. Hard quota blocks; soft quota warns + allows metered overage.
- **Billing decoupled from provisioning** — one consolidated invoice to the distributor; downstream MSPs
  never touch Stripe. Meter usage → monthly rollup → distributor invoice.
- **Product surface = API-first (hosted) + white-label portal**, NOT a self-hosted app image (unless a
  hard data-residency requirement surfaces — open question for Luis).
- **Outbound webhooks** to partners (`pentest.completed`/`report.ready`, signed) — design currently has
  inbound runner callbacks only.

### Decisions locked (2026-07-10)
- **Hierarchy: 3-level org tree** — Platform → Reseller/MSP → Tenant (client) → pentests.
  _(Superseded 2026-07-12: go N-level to fit the Compulab distributor tier — see above.)_
- **Provisioning: launch via the Make.com pipeline** (the only real engine — there are **no GCP
  scanner runners**). Optionally put Cloud Tasks in front for retry / rate-limit / per-tier concurrency.
- **Auth: programmatic API keys** (`mspp_live_<key>`) scoped per tenant, alongside the
  existing Firebase ID-token auth for the dashboard UI.
- **Tier attaches at the reseller level**, cascades to tenants, per-tenant override allowed.
  _(Open: flip to per-tenant tier if desired — not yet confirmed.)_

---

## Current architecture (as-is, before this work)

- **Stack:** Next.js 14.2.15 (App Router), Firebase (Firestore + Admin SDK), Stripe.
  Data model in `src/lib/types/*`.
- **Tenancy:** none. Flat + user-centric — everything (`pentests`, `scans`, `findings`,
  `engagements`) keys off a single `userId`. `users` doc has `credits` + `isAdmin`.
  Vestigial `PlanTier = "free" | "paid"` in `src/lib/types/user.ts` (unused).
- **Launch paths:**
  - `src/app/api/launch-pentest/route.ts` — Stripe-session-gated → Make.com webhook.
  - `src/app/api/ai-pentest-launch/route.ts` — Firebase auth → credit transaction
    (`credits.ai_pentest`, 1/target) → Make.com per target → callback to `/api/pentests`.
- **Provisioning engine:** **Make.com only** — `/api/pentests` + `/api/ai-pentest-launch` fire a
  Make webhook; Make runs the pentest and PATCHes results back to `/api/pentests` (secret-gated).
  There are **no GCP scanner runners**; `src/lib/gcp/scannerClient.ts` + `/api/scans/**` +
  `/api/ai-pentest` are dead code slated for removal (ROADMAP P1.1).
- **Auth helper:** `verifyAuthToken(req)` → userId (`src/lib/firebase/firebaseAdmin.ts`,
  exports `adminDb`, `adminAuth`, `adminStorage`). All API routes use `Authorization: Bearer <firebase-id-token>`.
- **Relevant deps already installed:** `@google-cloud/tasks` (UNUSED — available for the
  new queue), `@google-cloud/storage`, `firebase-admin`, `stripe`.
- No API-key infra and no Cloud Tasks usage exist yet.

---

## Target design

### 1. Firestore model — flat top-level collections + denormalized path
Avoids deep subcollections (better for collection-group queries + rules):
```
tiers/{tierId}              ← entitlement templates
resellers/{resellerId}      ← MSP/partner account, has tierId
tenants/{tenantId}          ← client org; carries resellerId (path = resellerId/tenantId)
apiKeys/{keyId}             ← SHA-256 hash + prefix, scoped to reseller OR tenant
pentests/{pentestId}        ← + { resellerId, tenantId }
provisioningJobs/{jobId}    ← queue records, + { resellerId, tenantId }
```
- Every pentest/job/finding carries `{ resellerId, tenantId }` → one indexed query scopes any level.
- `users` gain `resellerId`, optional `tenantId`, and `role`
  (`platform_admin | reseller_admin | tenant_user`).

### 2. Tier (entitlement template)
```ts
interface Tier {
  id: string; name: string;               // "Starter" | "Pro" | "Enterprise"
  limits: { pentestsPerMonth: number; concurrentJobs: number; tenantsMax: number };
  skus: SKU[];  // which SKUs this tier may launch (ai_pentest | external | internal | web_app | manual)
  features: { apiAccess: boolean; scheduledScans: boolean; whiteLabel: boolean };
}
```
Assigned to reseller, cascades to tenants (per-tenant override allowed). Checked before enqueue.

### 3. API keys
`mspp_live_<random>`. Store only SHA-256 hash + prefix. Scope = reseller (all tenants) or single tenant.
Auth middleware resolves key → `{ resellerId, tenantId?, scopes }`; sits next to Firebase-token auth so
dashboard + headless callers share route handlers.

### 4. Provisioning flow (via Make.com)
```
POST /api/v1/pentests → entitlement check → create pentest+job docs
                      → launch via Make.com webhook (optionally Cloud Tasks in front)
                      → Make callback POST /api/v1/pentests/{id}/result (HMAC-verified)
```
An optional Cloud Tasks queue in front of the Make launch gives retry / rate-limit / per-tier
concurrency control. (No GCP scanner runners exist.)

### 5. New endpoints (`/api/v1`, key-or-token auth)
- `POST /resellers`, `POST /resellers/{id}/tenants` — provision org tree
- `POST /tenants/{id}/api-keys` — mint scoped keys
- `POST /pentests` — launch (targets, scanType) → entitlement check → queue
- `GET /pentests?tenantId=`, `GET /pentests/{id}` — status/results
- `POST /pentests/{id}/result` — HMAC callback from runner

---

## Phased plan
1. **Data model + migration** — tier/reseller/tenant types; backfill existing users under a
   default reseller/tenant; update `firestore.rules`.
2. **API-key infra** — mint / verify / scope + dual (key or Firebase-token) auth middleware.
3. **Provisioning core** — `/api/v1/pentests` + Cloud Tasks queue + HMAC callback + entitlement enforcement.
4. **Org management endpoints** + dashboard wiring.

**Status:** Phase 1 **built** (types, org/entitlement helpers, migration script, rules) —
see the "In progress" section at the top. Pending: run migration against prod, then start Phase 2.
