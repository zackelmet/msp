# MSPP Dashboard — Handoff

_Last updated: 2026-07-14_

> **See `ROADMAP.md` for the prioritized dev plan** (P1 run-real-pentests → P2 consolidated-buyer
> platform → P3 Acronis-north-star UX), set after the 2nd Luis/Compulab meeting. North-star UX
> teardown in `docs/north-star-acronis.md`. This file tracks the P2 Phase-1 build detail below.

## 📌 Session ledger — 2026-07-14 (all on `main` unless noted)

| Commit | What |
|--------|------|
| `bd3ec9e` | **P1.2** pentest auth hardened (verifyAuthToken, no client `userId`) |
| `63606c6` | **P1.1** dead GCP scanner code + 2 orphan pages removed |
| `9c49578` | Admin **Requests** tab dark-themed to match console |
| `63daee9` | **Org model refactored N-level → fixed 3-level** (supplier→reseller→client) |
| _(prod)_ | **P2.0 migration RUN** on prod: seeded org tree + tier, attached 6 users, stamped 3 pentests |
| `e719439` | **Control plane** started — clients grid + drill-down (Platform tab) |
| `6cb7a7b` | **Report engine** ported from AIP (PDF v2) + reseller white-labeling → **Reports** tab |
| `8beccae` | **Control plane** editable provisioning — client soft/hard quota caps + white-label settings |
| _(VPS)_ | **PentAGI deployed** as the pentest engine on the Oracle VPS (see below) |

Firebase is now fully manageable from the checkout (`FIREBASE_SERVICE_ACCOUNT_KEY` in gitignored
`.env.local`, project `msp-pentesting`). tsc + eslint + `next build` green across all app commits.

## ⏭️ Tomorrow / next up
1. **PentAGI eval + hardening** — log in over the SSH tunnel and run a real flow to judge Groq quality;
   change default admin creds + mint an API token; fix the embedder (add an OpenAI key or local Ollama);
   consider `llama-3.3-70b-versatile` vs the reasoning-model `gpt-oss-120b`. (Details in the `pentagi-engine`
   memory + section below.)
2. **Wire PentAGI into the app** — design a job-submit/callback contract mirroring the Make webhook so a
   launched pentest can route to PentAGI's `POST /api/v1/flows` and its result flows back to `/api/pentests`.
3. **P1.5** wire-or-retire `/api/launch-pentest` (creates no doc, no callback → results never surface).
4. **P1.6** (Zack said "next session") env-ify hardcoded Make URL + verify the Make PATCH callback + make
   the launch flow fully autonomous for users.
5. Optional cleanup: `src/lib/gcp/storageClient.ts` looks dead (no importers) — confirm + remove.

## 🖥️ PentAGI engine — deployed 2026-07-14 (Oracle VPS, EVAL)
Chosen over Vulnetic. Running on `autojob-vps` (`147.224.173.192`, ubuntu, key
`/home/zack/Desktop/openclaw/ssh-key-2026-02-02.key`) at `/home/ubuntu/pentagi` — 4 containers
(pentagi/pgvector/scraper/pgexporter) **bound to 127.0.0.1** (not exposed). LLM = **Groq** via the
custom OpenAI-compatible provider (`LLM_SERVER_PROVIDER=groq`, model `openai/gpt-oss-120b`, key from the
box's `~/vuln-trends-engine/.env`). UI/REST/Swagger return 200. **Access:** `ssh -L 8443:localhost:8443
autojob-vps` → `https://localhost:8443`, login `admin@pentagi.com` / `admin` (change it). Caveats: embedder
needs a key (no Groq embeddings; vector-memory degraded, non-fatal); `gpt-oss-120b` is a reasoning model.
Full runbook in the `pentagi-engine` memory. NOT yet wired into the msp launch path.

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

## ✅ Control plane (Acronis north-star) — grid + editable provisioning (commits e719439, 8beccae)
**Platform** tab in the admin console: clients grid + drill-down (supplier→reseller→client, breadcrumb
to ascend), per-supplier quota-pool usage bars (soft/hard aware), white-label badge. Drilling into a
**client leaf** opens an editable provisioning panel: per-SKU **quota caps + soft/hard toggle** and the
parent reseller's **white-label settings**. Backed by `/api/admin/orgs` (read) + `PUT /api/admin/orgs/[id]/{caps,branding}`
(write, Admin-SDK + uid-cookie gated). Renders live now that the migration has run.
**Next on this:** per-client usage rollup views; wire branding auto-resolve into report generation.

## ✅ Report engine (AIP PDF v2) + reseller white-labeling — commit 6cb7a7b
Ported `src/lib/report-engine/{types,cvss,storage,docx-template,pdf-template}.ts` + `findings/parseFindingsBlock.ts`
+ `/api/admin/report-engine/{submit,finalize,reports/[reportId]}` + a dark **Reports** tab
(`ReportEngineSection`). `buildReportPdf` takes a `ReportBranding` (company/logo/color/footer) that
overrides the default MSPP identity when white-label is enabled. Deps added: `pdf-lib`, `docxtemplater`,
`pizzip`. Runtime-verified (valid branded PDFs). **TODO:** auto-resolve branding from `resellerId` →
`orgs/{resellerId}.branding` once the org tree is wired to launches.
**Next on this:** editable provisioning screen — set soft/hard quotas + white-label settings inline.

## ✅ P2.0 migration RUN on prod (2026-07-14)
`FIREBASE_SERVICE_ACCOUNT_KEY` (msp-pentesting service account) is now in the gitignored `.env.local`,
so Admin-SDK scripts run directly. `migrateOrgs.js --commit` applied: seeded `org_msp` (supplier) →
`org_msp_house` (reseller) → `org_msp_direct_client` (client) + Starter tier; attached 6 users
(role `client_user`, or `platform_admin` if isAdmin) to the default client; stamped 3 pentests with
`{resellerId, clientId}`. Idempotent (re-run = no-op). **No quota pool seeded** — real capacity is a
business decision; `node scripts/migrateOrgs.js --commit --seed-pool=N` adds a test AI-pentest pool
on the supplier (e.g. to give Luis trial credits). The Platform tab now renders this tree.

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
