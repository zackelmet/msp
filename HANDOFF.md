# MSPP Dashboard — Handoff

_Last updated: 2026-07-16_

> **See `docs/product-model.md` (Dev Roadmap section) for the prioritized dev plan** (P1
> run-real-pentests → P2 consolidated-buyer platform → P3 Acronis-north-star UX), set after the 2nd
> Luis/Compulab meeting. North-star UX teardown is in `docs/product-model.md` (North Star section).
> This file tracks the P2 Phase-1 build detail below.

## 📌 Session ledger — 2026-07-17 (two-tier payment model shipped)

**Tier-2 card-on-file billing + tier-up + dunning are LIVE in code** (commit `4ba12f0`; verified with a full
`next build` + a live setup-session structural test). Payment tiers apply to **supplier** nodes only (the billed
consolidated buyer). See `docs/product-model.md` "Payment posture" for the full spec.
- **Tier 2 activation:** `POST /api/billing/setup-session` (supplier_admin/admin) → Stripe Checkout `mode:setup`
  card collection → webhook `org_billing_setup` attaches the card as default PM and puts the metered sub on
  `charge_automatically` (creates it if none). `billing.paymentTier='auto'`. Billing page (`/app/buy-credits`)
  shows an **"Add payment method"** card to supplier admins not yet on auto, + card-on-file / suspended banners.
  Backed by `GET /api/billing/status`.
- **"Move up a tier":** `PUT /api/admin/orgs/[id]/payment-tier {tier:'net30'|'auto'}` (platform_admin) flips the
  sub's `collection_method` — `net30`=send_invoice/net-30 (Tier 1, vetted), `auto`=charge_automatically (needs a
  card, else 409). This is how a buyer graduates Tier 2 → Tier 1.
- **Dunning:** `invoice.payment_failed`→`billing.suspended=true`, `invoice.paid`→false. **NOT enforced at launch
  yet** (launch is still credit-gated — enforce with the credits→cap switch).
- **✅ Prod webhook CREATED + verified (2026-07-17).** The live Stripe account had **NO webhook endpoint at all**
  (the `whsec_` in env was orphaned → every webhook flow, incl. `checkout.session.completed` for credit purchases /
  manual orders, was dark in prod). Created endpoint **`we_1Tu8bNA2hEQYBBzSpIjemFE2`** at
  `https://msp-puce.vercel.app/api/stripe-webhook` with `checkout.session.completed` + `invoice.payment_failed` +
  `invoice.paid` + `payment_intent.*`. Rotated `STRIPE_WEBHOOK_SECRET` (Vercel prod+dev + `.env.local`), redeployed,
  and **verified a signed event returns HTTP 200** end-to-end. (Needed adding Webhook-Endpoints-Write to the
  restricted key.)
- **Compulab path:** currently send_invoice/net-30, **no card**. Luis adds a card on the Billing page → the flow
  flips his existing sub to auto-charge (Tier 2). Left for Luis. Customer `cus_UtbCy4uE44aRUW`.

## 📌 Session ledger — 2026-07-16 (metered usage reporting wired end-to-end)

**Completed pentests now meter the consolidated buyer.** Code shipped (NOT yet committed to `main` — see
"resume" — and the LIVE Stripe subscription is NOT yet created):
- **`OrgBilling` type** (`src/lib/types/org.ts`) gains `stripeSubscriptionId` / `stripeSubscriptionItemId` /
  `stripePriceId` — the supplier node's metered subscription handle.
- **Usage helper** (`src/lib/stripe/reportUsage.ts`): `reportPentestUsage(pentestId, userId, quantity)` resolves
  `user.orgPath[0]` → supplier → `billing.stripeSubscriptionItemId`, then `subscriptionItems.createUsageRecord`
  (`action:increment`, idempotencyKey `pentest-usage:<id>`). No-ops + logs if the buyer isn't subscribed — never
  fails the callback. Attribution verified: Luis's user doc has `orgPath:["org_compulab"]`.
- **Completion callback** (`/api/pentests` PATCH): on a genuinely `completed` pentest (not failed) and not already
  metered, reports usage (qty = `billableIps` or 1 — CIDRs already expand to one doc per host at launch) and sets a
  `usageReported`/`usageReportedAt`/`usageQuantity` doc flag. Double guard against double-billing (doc flag + Stripe
  idempotency key). Stripe/attribution errors are caught and logged, callback still 200s.
- **Provisioning script** `scripts/subscribeCompulab.js` (dry-run default, `--commit` for LIVE): ensures a Stripe
  customer for `org_compulab`, creates a **send-invoice / net-30 metered subscription** to the per-IP price
  (`price_1TtV2oA2hEQYBBzSJw5Dsyrs`, resolved by lookup_key `ai_pentest_per_ip_metered_v1`), stores customer/sub/item
  ids on the org billing. Idempotent. **Dry-run passes.** `tsc --noEmit` clean.

**✅ Subscription LIVE + key rotated (2026-07-16):** Compulab is subscribed and metering is wired end-to-end.
- **Compulab metered subscription created:** customer `cus_UtbCy4uE44aRUW` (email `lc@compulab.pt`), subscription
  `sub_1TtoCwA2hEQYBBzSjggtptIM` (status active, **send_invoice / net-30**), metered item `si_UtbP95aNPnD40E` on
  `price_1TtV2oA2hEQYBBzSJw5Dsyrs`. All ids persisted to `org_compulab.billing`. A completed pentest by any user
  under Compulab now reports a usage record to `si_UtbP95aNPnD40E` (verified attribution: Luis `orgPath[0]=org_compulab`).
- **`rk_live_…` key ROTATED (leak resolved):** old key revoked; new restricted key (w/ Customers + Subscriptions +
  Usage Records write) set in **`.env.local:18`** AND **Vercel env `STRIPE_SECRET_KEY`** (Production + Development).
  Empty commit `3c1efc6` triggered a prod redeploy so the running deployment binds the new key (env changes only take
  effect on redeploy).
- Provisioning gotchas fixed in `subscribeCompulab.js`: persist customer id immediately (no orphan on retry) + set
  `email` on the customer (send_invoice requires it).

## 📌 Onboarding model — signups auto-enroll as parked resellers (2026-07-16)

**Decision (Zack): public signup STAYS OPEN, but no account is orphaned.** On signup a user is auto-enrolled as a
**reseller under MSP Pentesting** (`org_msp` supplier) and **parked** (0 credits → the credit-gated launch path blocks
spend) until Zack provisions them. Acronis is top-down/invite-only; we chose open-signup-then-park + an upsell path.
- **`POST /api/users/signup`** now creates `org_reseller_<uid>` (reseller, parent `org_msp`, `billing.mode:inherited`)
  and stamps the user `role:reseller_admin`, `orgPath:[org_msp, org_reseller_<uid>]`, `selfEnrolled:true`. Idempotent
  (early-returns if the user doc exists). **Verified end-to-end** on a dev server; test docs cleaned up. `tsc` clean.
- **Resend alert to Zack on every signup** — `newSignupOpsEmail` via `src/lib/email/send.ts`, sent to `OPS_EMAIL` else
  `zack@msppentesting.com`. **✅ Resend CONFIGURED (2026-07-16):** `RESEND_API_KEY` (reused from the AIP app),
  `EMAIL_FROM=MSP Pentesting <onboarding@resend.dev>` (generic sender — no verified domain), `OPS_EMAIL=zack@msppentesting.com`
  set in Vercel **prod + dev** and `.env.local`. Live send verified (HTTP 200). This also activates the previously-dark
  manual-order emails. **Green prod deploy = `ee812e6` (msp-4pzyf8dpe).**
- **⚠️ Build-verify lesson:** `tsc --noEmit` does NOT run ESLint; `next build` does. The onboarding banner shipped with
  raw apostrophes in JSX → `react/no-unescaped-entities` failed every deploy from `b791870`→`b4702e1` (prod stayed
  pinned to the last green Stripe-key build, so billing was unaffected). Fixed in `ee812e6`. **Verify UI/page changes
  with `next build`, not just `tsc`.**
- **Distributor upsell** — `DistributorUpsellBanner` (dismissible, per-browser) shows to `selfEnrolled` reseller_admins:
  "want your own billing as a distributor? email zack@msppentesting.com". `/api/auth/isAdmin` now returns `selfEnrolled`.
- **To activate a parked reseller:** grant credits / set quota in `/admin`. **To promote to a distributor** (their own
  supplier root), that's still a manual re-parent — no UI yet (the intended path for the email upsell).

**⏭️ Resume (2026-07-16):**
1. **First real completion is the true test** — on the next completed pentest under Compulab, confirm a usage record
   lands on `si_UtbP95aNPnD40E` (Stripe → subscription → usage) and the pentest doc gets `usageReported:true`.
3. **Distributor-promotion flow** — a UI/script to lift a parked reseller into its own supplier tree (today: manual).
4. Remaining from 2026-07-15: real pentest execution (scan/report side unwired), `/pricing` reskin, "Buy Credits"
   button rename, first-load nav-flash fix.

## 📌 Session ledger — 2026-07-15 (evening: Acronis portal + metered billing + launch verified)

**The app is now shaped like the Acronis *supplier portal*, selling pentests per IP.** All on `main`, deployed:
- **Lean Acronis sidebar** (b8965a1, b8a5d74, 9cabe92): control-plane roles get **Platform · Overview · Reports ·
  Billing**; **Settings / Take a tour / Trust + Safety / Support** moved into the **account dropdown**. `New Pentest`
  removed from the supplier nav (launch is a per-client action). Client-users keep a simpler nav.
- **Platform = its own page** (`/app/clients`, b8a5d74): tenant tree (supplier→reseller→client) with drill-down, a
  per-tenant **Overview panel** (IP quota + New pentest + Set quota), and **"+ New Reseller/Client"** create (89db498;
  `POST /api/orgs`, subtree-scoped). `/app/dashboard` redirects control-plane roles here. Same UI for supplier &
  reseller — only the accessible drill depth differs (root grid = top of caller's subtree, e36a7d5).
- **Overview page** (`/app/monitoring`, b8a5d74) rewritten to real control-plane stats (clients / resellers / IPs
  consumed / quota) from scoped `/api/orgs` — legacy target-group / scheduled-test content removed.
- **Nav gating fixes:** platform_admin (Zack) now also gets the control plane (88ef4df); **role cached across page
  navigations** to kill the old-nav flash (6f8491d). _First load after a hard refresh may still blink once — proper
  cure is moving `DashboardLayout` into an `/app` route-group layout (not done)._
- **Metered billing is LIVE** (79a985b): Stripe product `prod_UtHcudkugcC8gg` + graduated **metered** price
  `price_1TtV2oA2hEQYBBzSJw5Dsyrs` — **$10 / $8 / $6 per IP** (bands 100 / 1k / 1k+), post-paid, `aggregate_usage=sum`,
  no base fee. Price id in Vercel env `NEXT_PUBLIC_STRIPE_PRICE_AI_PER_IP`. Script `scripts/setupStripePricing.js`
  (dry-run default). **Billing page** (`/app/buy-credits`, 9c4aeba) rewritten to this model (this-cycle IPs + estimated
  graduated invoice + rate card).
- **Docs consolidated 12 → 3** (3190d87): `README.md` (technical hub), `docs/product-model.md` (product/strategy hub —
  now holds model + north-star + roadmap + Compulab + PRD), `HANDOFF.md` (this ledger). Superseded content flagged
  historical, not deleted.
- **✅ Luis launch VERIFIED** (smoke test, not committed): authed AS Luis → `POST /api/ai-pentest-launch` → **HTTP 200,
  `launched:1`, Make webhook fired (`dispatchFailures:0`)**, credit spent. Test pentest deleted; **Luis back to exactly
  1 credit** (confirmed). His single distributor account (`supplier_admin @ org_compulab`) launches end-to-end — that
  house-reseller node is his MSP hat, so one login = distributor + reseller + manages the client (the Acronis way).
- **Local-dev fix (uncommitted, `.env.local` only):** `firebaseAdmin.ts` reads `FIREBASE_ADMIN_{PROJECT_ID,CLIENT_EMAIL,
  PRIVATE_KEY}`; `.env.local` only had `FIREBASE_SERVICE_ACCOUNT_KEY`. Derived those three into `.env.local` (gitignored)
  so the local dev server can verify tokens. Prod was always fine.

**⏭️ Resume tomorrow:**
1. **Wire the metered subscription + usage reporting** (task #9 tail): subscribe the consolidated buyer (Compulab) to
   `price_1TtV2oA2hEQYBBzSJw5Dsyrs`; report a usage record per live IP on pentest completion
   (`subscriptionItems.createUsageRecord`). Ties into #2.
2. **Real pentest execution** (task #10): make the engine actually run the pentest + callback results to `/api/pentests`
   (Make.com fires today with `dispatchFailures:0`; the scan/report side is unwired). Strix eval needs a paid model — see
   `strix-engine` memory.
3. **`/pricing` public page** — reskin to the per-IP metered model (still shows old manual tiers).
4. **Cleanups:** sidebar **"Buy Credits" button** still says that + links to the post-paid Billing page → remove/rename
   (wired to onboarding tour `data-tour="buy-credits-btn"`). Reports/Billing pages could use an Acronis reskin. First-load
   nav-flash architectural fix (route-group layout). Archive legacy Stripe prices once per-IP flow is wired.
5. **Roll the restricted Stripe key** (`rk_live_…`) — it appeared in a tool output this session.

## 📌 Product-model pivot — 2026-07-15 (locked w/ Zack) → see `docs/product-model.md`

**The 5-SKU model collapses to ONE product: an AI pentest, metered per live IP.** Full spec +
build checklist in **`docs/product-model.md`** (the build contract). Headlines:
- Bill **only the consolidated buyer**, post-paid monthly, on **actual consumption**. Buyer has **no
  ceiling** — a **commitment plan tier** sets rate, IPs past the tier threshold are **discounted**, pay actual.
- **Soft/hard IP caps are downstream spend controls**: hard = **block the whole launch** (+ raise-cap path),
  soft = run + meter overage. Every run incl. re-tests counts.
- **Launch + scope pages merge** into one paste-targets "New AI pentest" page (live per-IP scope estimate).
- MSP launches by default; **per-client self-serve** toggle exposes launch in the white-label portal.
- Manual pentest = quiet on-request link (no SKU). Future: **downloadable agent** for internal pentests.
- Acronis-modeled control-plane **mockup built** this session (claude.ai/code artifact, product dark theme).

**In flight (started this session):** `docs/product-model.md` written; capturing the model + kicking off the
code collapse (`src/lib/types/quota.ts` SKUs → single IP meter, merge launch+scope, reframe landing copy).

**Partner onboarded — Compulab / Luis (prod, 2026-07-15):** `scripts/setupCompulab.js` (idempotent, dry-run
default) created the Compulab org tree `org_compulab` (supplier/distributor) → `org_compulab_house` (reseller)
→ `org_compulab_client`, promoted Luis (`lc@compulab.pt`, uid `vHxug1…`) from MSPP client → **supplier_admin
of Compulab**, and granted **`credits.ai_pentest: 1`** (live launch path). Folds cleanly into the future `ip`
meter. Note: role-based UI gating isn't wired yet (admin console still gates on the legacy `isAdmin` boolean),
so this is structural data — Luis's portal experience is unchanged until the role gating ships.

**✅ Role-scoped control plane shipped (2026-07-15, commit d64ed42):** distributors/resellers now get the
Acronis control plane **in-app at `/app/clients`**, scoped to their own subtree — drill down + set clients'
quotas without the admin page. `/admin` stays Zack-only. New: `src/lib/org/access.ts` (`getCaller`, Bearer-
verified), `GET /api/orgs` (subtree-scoped; whole tree for platform_admin), `PUT /api/orgs/[id]/{caps,branding}`
(strict-descendant / self-or-descendant enforcement), `PlatformSection` reused via `apiBase`+`getAuthHeaders`,
role-gated "Clients" nav. Verified: `subtree(org_compulab)` isolates Compulab from MSPP; tsc + next build green.
Test: log in as Luis (`lc@compulab.pt`) → Clients tab → drills only Compulab's subtree.

**✅ More shipped 2026-07-15:** (a) **SKU quota collapse** — `types/quota.ts` `SKUS`→`["ip"]`, PlatformSection
provisioning now one IP cap (commit 4f5f1a5); (b) **legacy launch pages retired** → redirect to
`/app/ai-pentest-launch` (9b45bb5); (c) **clients grid = home** — supplier_admin/reseller_admin land on the
scoped control plane at `/app/dashboard` (Acronis, commit bc257b0). Strix eval done (Gemini free tier; quick
≈$0.085/target, deep needs paid tier — see `strix-engine` memory). Luis email **drafted + held** in the
"MSP Pentesting Form - Compulab" thread (Gmail draft, not sent) — awaiting a more Acronis-like dashboard first.

**⏭️ Dashboard→Acronis (in progress, Zack chose "clients-grid-as-home first"):** item 1 (grid-as-home) DONE;
NEXT = **per-tenant Overview page** (drill into a client → IP usage + recent pentests + manage/launch), then
nav/shell realign + color-as-status. This is what gates telling Luis to actually use it.

**Credit collapse (B) — still staged (the deep one; Stripe recurring deferred until Strix cost data):** two credit systems exist — System A (org quota pools,
`types/quota.ts` SKUs; NOT wired to launches) and **System B** (`users.credits.{web_app,external_ip,ai_pentest}`,
the LIVE Stripe/launch path). Collapsing System B needs a **backfill migration** (mirror
`scripts/backfillUserCreditSchema.js`: `credits.ip = web_app+external_ip+ai_pentest`) + a rename across
signup/bootstrap/checkout/stripe-webhook/pentests/ai-pentest-launch/update-credits/all-users. Do NOT rush it —
it's the money path. `/pricing` rework waits on real per-IP tier numbers.

## 📌 Session ledger — 2026-07-15 (engine pivot: PentAGI → Strix)

| Where | What |
|-------|------|
| _(VPS)_ | **PentAGI fully torn down** (containers + volumes + images + files removed). Groq key preserved in `vuln-trends-engine/.env`; autojob-applier PM2 stack untouched. |
| _(VPS)_ | **Strix installed** as the new candidate engine (`strix` 1.1.0 via pipx; FOSS AI pentester, github.com/usestrix/strix, Apache-2.0). arm64 works via pip (binary installer is x86-only); sandbox image has an arm64 manifest. |
| _(VPS)_ | **Groq↔Strix wired + 2 bugs fixed** — injected LiteLLM optional deps; added a `.pth`-loaded tool-schema shim (Groq strict-validates tool schemas). Each run emits **`findings.sarif`** (machine-readable → good for `/api/pentests` ingest). |
| _(VPS)_ | **Eval PAUSED (Zack's call)** on a hard blocker: Groq free `on_demand` tier caps TPM at **8K** (gpt-oss-120b) / 12K (llama-3.3-70b), but Strix's first request is **~29K tokens** → scan aborts before any completion. Needs Groq **Dev tier** or a **frontier key** (Strix's recommended path) to proceed. |

Box is left clean + resumable — runbook in `/home/ubuntu/strix/RESUME-STRIX.md`; details in the
`strix-engine` memory. Juice Shop test target is stopped (`docker start juiceshop` to resume).

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
1. **Unblock the Strix eval (decision pending)** — pick one: upgrade Groq to Dev tier (pay-go, keeps cheap
   `gpt-oss-120b`) OR add a frontier key (Claude/GPT — Strix's recommended path, true quality ceiling). Then
   `docker start juiceshop` + `SCAN_MODE=quick bash /home/ubuntu/strix/run-eval.sh eval_run1` and judge the
   `findings.sarif` quality. (Full runbook: `/home/ubuntu/strix/RESUME-STRIX.md` + `strix-engine` memory.)
2. **Wire Strix into the app** — Strix is CLI-only (no REST API), so the contract = a backend worker spawns
   `strix -n --target … --instruction …` as a job and ingests the run's `findings.sarif`/`run.json` back into
   `/api/pentests` (mirrors the Make-webhook job pattern). Design once the eval confirms Strix is good enough.
3. **P1.5** wire-or-retire `/api/launch-pentest` (creates no doc, no callback → results never surface).
4. **P1.6** (Zack said "next session") env-ify hardcoded Make URL + verify the Make PATCH callback + make
   the launch flow fully autonomous for users.
5. Optional cleanup: `src/lib/gcp/storageClient.ts` looks dead (no importers) — confirm + remove.

## 🖥️ Pentest engine — Strix candidate (Oracle VPS, EVAL PAUSED 2026-07-15)
**PentAGI was torn down and replaced by Strix** (github.com/usestrix/strix, Apache-2.0) — chosen 2026-07-15.
On `autojob-vps` (`147.224.173.192`, ubuntu, key `/home/zack/Desktop/openclaw/ssh-key-2026-02-02.key`):
`strix` 1.1.0 installed via pipx at `/home/ubuntu/.local/bin/strix`; helpers + runbook in `/home/ubuntu/strix/`.
CLI-only (headless `strix -n`), Docker-sandboxed, LLM via LiteLLM. Two fixes are in place and required:
injected LiteLLM optional deps + a `.pth`-loaded tool-schema shim (`strix_groq_shim.py`, drops empty
`required:[]` — Groq strict-validates). Runs emit **`findings.sarif`** + `run.json` (machine-readable).
**Blocker:** Groq free `on_demand` tier = 8K TPM (gpt-oss-120b) but Strix's first request is ~29K tokens →
scan can't start. Resume needs a Groq Dev-tier upgrade or a frontier-model key. Full runbook:
`/home/ubuntu/strix/RESUME-STRIX.md` + the `strix-engine` memory. NOT yet wired into the msp launch path.

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
  `scripts/migrateOrgs.js`, `firestore.rules`, the `/api/v1` spec (now in `README.md`). **tsc + build clean; nothing wired to
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
- Proposed endpoint reference: **`README.md` (`/api/v1` Provisioning API section)**.

### Driver: Compulab consolidated buying program (2026-07-12)
Compulab (Luis Costa) wants to run a **consolidated buying program** — a distributor buying pentest
capacity in bulk and allocating it down to their MSPs and clients. This reshapes the design below.
Full deal notes + open questions in **`docs/product-model.md` (Compulab Partnership Notes section)**. Key impacts:
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
  `/api/ai-pentest` are dead code slated for removal (roadmap P1.1 — `docs/product-model.md`).
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
