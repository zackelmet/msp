# Product Model — AI Pentest, per IP

_Locked 2026-07-15 (Zack). This is the build contract. It **supersedes the 5-SKU model**
(`ai_pentest | external | internal | web_app | manual`) and the tabbed offering-item
provisioning. Visual reference: the control-plane mockup (Acronis-modeled)._

## The one-line version

There is **one product**: an **AI pentest**, metered **per IP**. Everything the platform
sells, meters, caps, and bills flows through that single unit. The app is a thin
multi-tenant **control plane** (Acronis-style) that launches AI pentests and rolls usage
up to a single monthly invoice for the consolidated buyer.

## Product & metering

- **Product:** AI pentest (powered by the pentest engine — Strix candidate). No more
  separate web-app / external / internal / manual products.
- **Billable unit:** **one live IP.** A target can be entered as an IP, a hostname, a URL,
  or a CIDR range; on discovery it resolves to the **live hosts** actually reachable, and
  **each live host = 1 IP** consumed. A `/24` bills only for hosts that respond.
- **Every run counts, including re-tests.** Re-running a pentest against an IP already
  tested this cycle spends another IP. (Simplest to meter; revisit later if needed.)
- **Internal vs external** is no longer a product distinction. External (internet-facing)
  ships first. Internal pentests come later via a **downloadable agent** the client installs
  in their environment (Horizon3/NodeZero-style) — same product, same per-IP meter.

## Billing — post-paid, consolidated buyer only

- The platform invoices **only the consolidated buyer** (the top-level `supplier` — e.g.
  Compulab, and MSP Pentesting for its own direct business). **Resellers and end clients are
  never billed by the platform.** Downstream pricing is the buyer's own business, off-platform.
- Billing is **pure actual consumption**, settled **monthly, post-paid**. Sum the live IPs
  consumed across the buyer's entire subtree → one invoice.

## Commitment levels (the buyer's commercial tier)

- The consolidated buyer has **no ceiling.** They sit on a **plan tier** — a commercial rate
  tier, not a technical limit and not a floor. **Pay actual, no take-or-pay.**
- **Tiers = monthly IP volume bands; higher volume → lower per-IP rate** (locked 2026-07-15):

  | Tier | Monthly IP volume | Markup over cost | Price / IP |
  |------|-------------------|------------------|-----------|
  | Bronze | up to 100 | +150% | cost × 2.5 |
  | Silver | ~1,000 | +120% | cost × 2.2 |
  | Gold | ~10,000 | +100% | cost × 2.0 |

  "Markup" = **margin over our per-IP cost**, i.e. `price = cost × (1 + markup)`. Bigger buyers
  get a cheaper per-IP rate — the volume discount and the nudge up a tier. (This is markup, not
  gross margin; gross margin can't exceed 100%.)
- **`cost / IP` = the token cost to run one AI pentest on one IP** — engine + model dependent,
  and **TBD: must be measured** (run a real pentest on the chosen engine, count tokens × model
  price). Until then the rate card is a *formula*, not dollars. Pricing the `/pricing` page waits
  on this number.
- **Monthly. Price-only** (tiers don't gate features yet).

## Quotas — spend controls downstream (NOT prepaid buckets)

- Quotas exist **below** the buyer, as the buyer's tool to ration consumption among its
  resellers/clients. They are **spend controls / ceilings**, not something anyone pre-buys.
- **Per client: a soft or hard IP cap per cycle.**
  - **Hard cap → block the whole launch.** If a launch would exceed the client's remaining
    hard cap, block it entirely (no partial runs — a half-run pentest report is a liability)
    and surface a **"raise cap"** path (the Acronis parent-lifts-quota flow the buyer knows).
  - **Soft cap → run it all,** meter the excess as billable overage on the buyer's invoice,
    and notify.
- **Parent-cap invariant:** a child's hard cap can't exceed the parent's remaining capacity.

## Launch + scope — one page

- The separate **manual-launch** page and **scoping** page **collapse into one** "New AI
  pentest" page.
- Input: a single **paste box** for targets — IPs, hostnames, URLs, CIDR ranges, one per line.
- Live **per-IP scope estimate** against the client's remaining hard cap as they type. If it
  would exceed a **hard** cap: block + offer raise-cap. A **soft** cap: allow + flag overage.
- Options: optional credentials (authenticated), optional exclusions, email-on-complete.
- Final bill settles on **discovery** (live hosts found), not the raw scope entered.

## Access — who launches

- **MSP launches by default:** reseller/supplier admins launch from the control plane on
  behalf of clients.
- **Per-client self-serve toggle:** when on, that client's end users can launch their own AI
  pentests from the **white-label portal**, within their hard cap. Off = MSP-launched only.

## Roles & surfaces — admin console vs. in-app control plane (locked 2026-07-15)

- **The `/admin` console is platform-only (Zack).** It stays gated on the `isAdmin` boolean —
  MSPP-internal, cross-tenant (all suppliers). **Not a partner surface.** (Needs its own updates
  later, separately.)
- **Distributors (`supplier_admin`) and resellers (`reseller_admin`) get the Acronis control
  plane IN THEIR OWN PORTAL,** scoped to their own subtree — NOT the admin page. They drill down
  the clients grid and **set soft/hard IP quotas on their clients themselves.** This is the core
  Acronis "manage-from-one-level" experience and the **next major UI build**: lift the control
  plane (today `PlatformSection` under `/admin`) into a role-scoped app surface that shows only
  the signed-in user's subtree, with quota-setting for their descendants.
- **Clients (`client_user`)** see their own overview + reports, and can launch only if their
  reseller enabled per-client self-serve.

## Manual pentests — quiet, on request

- Human-delivered manual pentests are **not a SKU, not a meter, not a nav item.** They surface
  as a low-key **"Request a manual pentest →"** link on a client's overview and on finished
  reports, routing to an internal ops queue. Toggleable per reseller. AI is unambiguously the
  product; manual is the high-touch upsell for top clients.

## Control-plane UX (Acronis north-star — unchanged intent)

The rest of the app keeps the Acronis Management Portal shape (see `docs/north-star-acronis.md`):
flat **clients grid** at the current level, click-to-drill / breadcrumb-to-ascend, per-tenant
**Overview** (now: one AI-pentest usage hero + recent pentests), color-as-status usage, and a
thin control plane that launches into the deep pentest tooling.

## What this changes in code (build checklist)

- **`src/lib/types/quota.ts`** — collapse `SKUS`/`Sku` to a single `ip` meter. `QuotaPool`,
  `Cap`, and `policy` shapes go from per-SKU records to a single IP quota `{ cap, overage,
  policy }`. Buyer gets a `planTier` + no ceiling; clients get the soft/hard IP cap.
- **`src/lib/org/entitlement.ts`** — reserve/consume/check quota keyed on the single IP meter;
  hard = block-whole-launch, soft = allow + meter overage; parent-cap invariant on IP cap.
- **Launch + scope pages** — merge into one paste-targets "New AI pentest" page; per-IP scope
  estimate; POST to the pentest launch API with a target list.
- **`src/components/admin/sections/PlatformSection.tsx`** — drop the local `SKUS`/`SKU_LABEL`
  and the multi-SKU provisioning; provisioning becomes one IP cap + overage + hard/soft, plus
  the client-access toggles (self-serve, manual) and white-label. Buyer summary shows plan
  tier + consumption (no ceiling).
- **Landing page** — offering copy reframed to the single AI-pentest-per-IP product (drop the
  multi-scan-type framing); keep existing styling. _(done 2026-07-15)_
- **`users.credits`** — collapse `{web_app, external_ip, ai_pentest}` → a single `ip` credit
  across signup/bootstrap/checkout/stripe-webhook/pentests/ai-pentest-launch/update-credits/
  all-users + `UsersSection`. **No backfill migration needed** — there are no real users yet, so
  this is a **forward schema change** (change the code; the handful of test users can be reset).
- **Role-scoped control plane (NEXT MAJOR UI BUILD)** — lift `PlatformSection` out of `/admin`
  into an in-app surface visible to `supplier_admin`/`reseller_admin`, **scoped to the signed-in
  user's subtree**, where they drill down and set their clients' soft/hard IP caps. The `/admin`
  console stays Zack-only (`isAdmin`).
- **`planTier`** on the supplier org (Bronze/Silver/Gold) — drives the rate card; buyer-level
  selector later.

---

> **The sections below are the product/strategy hub**, appended from the former
> `docs/north-star-acronis.md`, `ROADMAP.md`, `COMPULAB_PARTNERSHIP.md`, and `Pentester.md`.
> The **per-IP product model above is authoritative**; where an appended section still describes
> the earlier 5-SKU / multi-engagement / N-level design, it is flagged **(historical)** and kept
> for its still-valid strategy, UX, and requirements detail.

---

# North Star: Acronis Cyber Protect Cloud (UX + model reference)

_Originally `docs/north-star-acronis.md`, last updated 2026-07-13. Why: Luis (Compulab) provisions
IT services (VMs, servers, M365 licenses) through Acronis; its multi-tenant management portal is the
model we emulate for the consolidated-buyer pentest platform._

Acronis solves exactly our problem: a vendor sells capacity, partners (MSPs) resell it, end
customers consume it — through one "single pane of glass" **Management Portal**, with per-service
consoles hanging off it.

## Tenant hierarchy (maps to our org tree)

> (historical shape) Acronis uses a **recursive** tenant tree (below). Our locked model is a
> **fixed 3-level** `supplier → reseller → client` tree (see the product model above and the
> roadmap P2). Keep the semantics; ignore the unlimited-depth nesting.

Recursive tenant tree, four node types — **not** a fixed 3-level scheme:

- **Partner** — resells; can contain child Partners, Customers, Folders. Partner-under-partner
  nesting = distributor → sub-distributor → MSP. Effectively unlimited depth.
- **Folder** — organizational-only grouping node (no consumption). By region / tier / etc.
- **Customer** — the end-buyer company; the node that actually **consumes**. Can contain Units,
  **cannot** contain other Customers (the one non-recursive rule).
- **Unit** — sub-division of a customer (dept/location/device group); Units can nest.
- **User** — accounts inside Customer/Unit tenants; roles assigned per service.

→ Our `OrgDocument` (`platform|distributor|reseller|tenant` + materialized `path[]`) already
matches this. Consider adding a **folder**-style org-only grouping node later.

## Quota semantics to copy (this is the heart of "buy in bulk, allocate down")

- **Per-level quota semantics:** soft quotas for allocation at partner/reseller levels;
  hard/enforced quotas at the consuming (customer/user) level; Units inherit, no own quota.
- **Parent-cap invariant:** a child's total hard quota **cannot exceed the parent's**. Enforce
  this in our cap logic (`src/lib/org/entitlement.ts`).
- **Overage as an explicit grace band:** hard quota = `value + overage`; service works up to the
  sum, then blocks. Separates "the plan" from "how far we let them burst before cutoff." Our
  `QuotaPool.policy` (soft/hard) should grow an explicit `overage` band per SKU to match.
- **Color-as-status in grids:** usage figure black = under quota, orange = at/over. Cheap,
  scannable across many tenants.
- **Usage rolls UP the tree** into partner-level consolidated billing (current snapshot +
  scheduled reports). This is the invoicing substrate → our append-only `usageLedger`.

## Provisioning UX (the screen to build)

> (historical, partly superseded) The per-IP pivot collapses to **one product**, so the
> multi-service tabs / multi-offering-item checkbox rows below reduce to a single AI-pentest
> service with **one IP cap + overage + hard/soft** per client. The inline-quota-link and
> one-screen-enablement patterns still apply.

Enable services + set quotas on the **same** screen (create/edit tenant → "Configure services"):
1. **Service = tab** (Backup, DR, M365, … → for us: AI Pentest, External, Internal, Manual).
2. **Edition / billing mode** per service (per-workload vs per-GB → for us: per-target SKU).
3. **Offering item = checkbox row** (a feature bundle scoped to a workload type). Uncheck →
   removes that capability for the tenant and all children.
4. **Quota = inline editable "Unlimited" link** on the row; click to enter a number. Blank = unlimited.
5. **Overage field** (customer/user level) converts a soft quota into an enforced hard one.

→ Pattern: **service = tab, offering item = checkbox row, quota = inline link on that row.**
Enablement and quota-setting are one screen, not two workflows.

## Dashboard / navigation patterns

- **Left vertical nav:** Overview/Monitoring (Usage + Operations), Clients, Users, Reports,
  Audit log, Settings.
- **Clients grid = home:** flat table of tenants at the current level. **Click name to drill
  down; breadcrumb (top-left) to ascend.** No separate tree widget.
- **Per-tenant Overview:** one section per enabled service, each with current usage + a
  **"Manage service" jump button** into that service's deep console. Manage all clients from
  one level; drill only when needed.
- **Operations dashboard:** customizable widgets (status, scores, alerts/activity), exportable.

## Two-tier console architecture (key architectural bet)

A thin multi-tenant **control plane** (accounts, quotas, billing, reports) that **launches into**
rich per-service consoles — rather than one monolith. For us: the org/quota/billing admin surface
vs. the existing pentest-execution dashboard.

## API-first posture

The whole portal is API-backed (developer.acronis.com):
- `/tenants` — CRUD tenants, set `kind`, parent, management mode.
- `/tenants/{id}/offering_items` — **PUT** enables items, switches editions, writes quota
  objects. Offering item JSON: `application_id`, `measurement_unit` (bytes/quantity), `edition`,
  `quota { value, overage, version }`. **Versioned quota objects** enable safe concurrent writes.
- OAuth2 client-credential API clients + Python SDK. Resellers wire this into their own
  billing/PSA to auto-provision on sale and auto-meter for invoicing.

→ Model the **API as source of truth, UI as one client of it** (the `/api/v1` spec now lives in
`README.md`). Adopt the `{value, overage, version}` quota shape and offering-items concept.

## Top patterns to copy (priority order)
1. Recursive partner tenancy + non-recursive billable Customer leaf. _(we use fixed 3-level)_
2. Per-level quota semantics with the parent-cap invariant.
3. Offering-item = checkbox row + inline quota link; service = tab; one screen.
4. Soft vs hard quota with an explicit overage grace band.
5. Color-as-status usage grids.
6. Two-tier console (control plane launches into per-service tooling).
7. Aggregated per-tenant Overview + "Manage service" jump button.
8. Breadcrumb tenant switcher (click to descend, breadcrumb to ascend).
9. Usage rolls up the tree into partner billing reports.
10. API-first provisioning with offering-items-as-JSON + versioned quotas.

## Source docs
Management Portal admin guide + Partner's guide PDFs (annotated UI screenshots), tenant/offering-item/
quota help pages, and the Account Management API docs (developer.acronis.com/doc/account-management/v2).
Full URL list captured in the research thread; pull the two PDF guides for pixel-level screens.

---

# Dev Roadmap

_Originally `ROADMAP.md`, last updated 2026-07-13. Priority order set by Zack after the 2nd Luis
(Compulab) meeting._

**The goal:** turn the MSPP dashboard into a **consolidated-buyer pentest platform** — a supplier
buys pentest capacity in bulk and allocates it down to reseller MSPs and their clients — with the
product actually executing real pentests, and a provisioning UX modeled on Acronis.

Three priorities, in order. **P1 must land before P2 depth.**

## P1 — Make the product actually run pentests (parity with AIP)  ← FIRST

**Goal:** a launched pentest reaches a real engine and its results + report flow back into the
dashboard, exactly like the sibling **AIP** app.

**Reality check (from the AIP↔msp gap analysis + Zack):** AIP has no secret engine. There are **no
GCP/Cloud-Run scanner runners** — the **single real pipeline is Make.com**: `/api/pentests` +
`/api/ai-pentest-launch` → Make webhook → PATCH callback to `/api/pentests` (callback fully
implemented). Make.com runs the actual pentest workflow (tooling + human operators).

So P1 is **closing specific gaps on the Make.com pipeline + removing dead scanner code**, not
building an engine:

- [x] **P1.1 — Remove dead GCP scanner code. (done — commit 63606c6)** Deleted `scannerClient.ts`
      (`enqueueScanJob` + `GCP_*_SCANNER_URL`), `/api/scans/**` (incl. `scans/webhook`), the orphaned
      `/api/ai-pentest/route.ts`, and their two nav-unlinked pages (`/app/ai-pentest`, `/app/scans`).
      Full retirement chosen (Zack) since Make.com is the only engine. `tsc` + `next build` clean.
      _Follow-up:_ `src/lib/gcp/storageClient.ts` also has zero importers — likely dead too, left in
      place (out of the confirmed P1.1 scope); confirm before removing.
- [x] **P1.2 — Harden pentest auth (security). (done — commit bd3ec9e)** `/api/pentests` POST+GET and
      `/api/pentests/[id]` GET now derive the user from `verifyAuthToken`, not a client-supplied
      `userId`. Frontend callers (`new-pentest`, pentest-detail) send the Firebase ID token as a
      Bearer header. `tsc`/ESLint clean.
- [ ] **P1.3 — Automated report engine (largest missing subsystem).** msp has no
      `src/lib/report-engine/*`, no `/api/admin/report-engine/*`, no `parseFindingsBlock`. Port from
      AIP: `report-engine/{types,docx-template,pdf-template,cvss,storage}.ts`,
      `/api/admin/report-engine/{submit,finalize,reports/[reportId]}`, `findings/parseFindingsBlock.ts`,
      + admin UIs. Today msp can only manually upload a report (`admin/upload-report`).
      _(Note: report engine has since been ported — commit 6cb7a7b; see `HANDOFF.md`.)_
- [ ] **P1.4 — Parity polish.** Port `normalizePentestStatus` (AIP `lib/pentests/status.ts`) and
      launch emails (`lib/email/resend.ts` `sendPentestLaunchedEmails`, call after doc creation).
- [ ] **P1.5 — Wire or retire `/api/launch-pentest`.** Currently fires a different Make webhook,
      creates **no** Firestore doc and has **no** callback → results can never reach the dashboard.
      Make it create a `pentests` doc + `callbackUrl`/secret (like `ai-pentest-launch`), or retire it.
- [ ] **P1.6 — Config + external plumbing (TRUE BLOCKER).** Replace hardcoded Make URLs
      (`pentests/route.ts:77`, `ai-pentest-launch/route.ts:11`) with `MAKE_WEBHOOK_URL`. Confirm envs:
      `MAKE_WEBHOOK_URL`, the callback secret used by the PATCH route, `NEXT_PUBLIC_SITE_URL`,
      `RESEND_API_KEY`. **Verify the Make.com scenario actually PATCHes results back** with the
      webhook-secret header. Without it, launches sit at `pending` forever.
- [ ] **P1.7 — (later) Scheduled pentests.** msp stores `scheduled-tests` but has no cron
      dispatcher. Port AIP `/api/schedules/run` + `CRON_SECRET` (fires the same Make webhook) when
      continuous testing is needed.

## P2 — Consolidated-buyer platform  ← SECOND

**Goal:** **fixed 3-level** `supplier → reseller → client` org tree (no sub-resellers), consumable
quota pools, scoped API keys, a provisioning API, and billing decoupled from provisioning. Design:
the `/api/v1` spec in `README.md` + the Compulab notes below.

> **Model locked (2026-07-14, Zack + Luis transcript):** exactly 3 levels. **Supplier** holds the
> single quota pool and is billed post-paid on its subtree's consolidated consumption. **MSP
> Pentesting is itself a supplier** (for its own direct business, via a "house" reseller) *and*
> operates the platform (`platform_admin` sees all suppliers); **Compulab** is another supplier.
> **Soft/hard quotas per client** (Luis's Acronis "sell 2 servers" example): hard = block at the
> ceiling; soft = allow overage, meter it as billable, notify. **White-label = reports + end-client
> portal** driven by the reseller's logo/colors/footer, with an on/off toggle. Roles:
> `platform_admin | supplier_admin | reseller_admin | client_user`.

- [x] **Phase 1 — data-model foundation (built, refactored to 3-level 2026-07-14).**
      `src/lib/types/{org,tier,quota,apiKey,usage}.ts`, `src/lib/org/{collections,tree,entitlement}.ts`,
      `scripts/migrateOrgs.js`, updated `firestore.rules`, `users` extended with `orgId/orgPath/role`.
      N-level tree trimmed to fixed supplier→reseller→client; `resolvePoolOrgId` is now `path[0]`;
      `tenant`→`client` throughout. Nothing wired to live launch paths yet. tsc + build clean.
- [ ] **P2.0 — Run the migration on prod.** `node scripts/migrateOrgs.js --commit` (needs Firebase
      Admin creds available in the run environment — one-time enablement). _(since run — see HANDOFF.)_
- [ ] **Phase 2 — API keys + auth.** Mint/verify `mspp_live_`/`mspp_test_` (store SHA-256 + prefix),
      scopes, and a **dual auth middleware** (API key OR Firebase token) shared by all handlers.
- [ ] **Phase 3 — Provisioning core.** `POST /api/v1/pentests`: entitlement check → `reserveQuota`
      → launch via the Make.com pipeline (optionally Cloud Tasks in front for retry/rate-limit) →
      HMAC callback → `consumeQuota` + `usageLedger`. Idempotency-Key support.
- [ ] **Phase 4 — Org + quota management endpoints** (`/api/v1/orgs`, `/quota`, `/caps`, `/usage`,
      `/api-keys`, `/webhooks`) + dashboard wiring.
- [ ] **Phase 5 — Billing decoupled from provisioning.** Metered usage → monthly rollup → single
      consolidated supplier invoice (Stripe Invoicing); downstream MSPs never touch Stripe.
      Signed outbound webhooks (`pentest.completed`, `report.ready`, `quota.*`).
- [ ] **Adopt Acronis quota model** (see P3): explicit **overage grace band** per SKU on
      `QuotaPool.policy`, and enforce the **parent-cap invariant** (a child's hard quota ≤ parent's)
      in `src/lib/org/entitlement.ts`. (Current cap check is a documented Phase-1 approximation.)
      _(historical: "per SKU" → single IP meter under the per-IP model above.)_

## P3 — Acronis-north-star UX  ← THIRD (informs P2's UI)

**Goal:** a control-plane admin surface modeled on the Acronis Cyber Protect Cloud Management
Portal. Full teardown in the North Star section above. Highest-value patterns to build:

- [ ] **Clients grid home** — flat tenant table at the current level; **click name to drill down,
      breadcrumb (top-left) to ascend**. No tree widget.
- [ ] **Per-tenant Overview** — one section per enabled service with current usage +
      a **"Manage service" jump button** into the pentest console. Manage all clients from one level.
- [ ] **Provisioning screen** — **service = tab, offering item = checkbox row, quota = inline
      editable link, overage field** — enablement and quota-setting on ONE screen.
      _(historical: collapses to one AI-pentest service with a single IP cap under the per-IP model.)_
- [ ] **Color-as-status usage grids** (under = normal, at/over = orange) for dense multi-tenant scan.
- [ ] **Usage rolls up the tree** into partner-level billing reports (snapshot + scheduled).
- [ ] **Two-tier console** — thin multi-tenant control plane that launches into the deep
      per-service pentest tooling, rather than one monolith.

## Shipped (roadmap-era session note)
- P2 Phase 1 data-model foundation (above).
- **Fix:** admin pages lost the sidebar — added `src/app/admin/layout.tsx` wrapping `DashboardLayout`.
- **Feat:** public API docs at `/docs/api` (sanitized — no partner names) + footer link.
- Docs: roadmap, North Star teardown, updated `HANDOFF.md`.

---

# Compulab — Consolidated Buying Program (Partnership Notes)

_Originally `COMPULAB_PARTNERSHIP.md`, last updated 2026-07-12._

**Contact:** Luis Costa, COMPULAB (Lisbon). First call 2026-07-10; follow-up to be booked.
**Ask:** enable the MSPP platform for Compulab's **consolidated buying program** for pentests —
white-labeled, multi-tiered, multi-tenant across their partners, resellers, and clients, with API
provisioning and hard/soft quotas.

## The "app image" question — reframed

Three different things get conflated; only one is what Compulab actually needs:

1. **API-first (hosted)** — expose versioned `/api/v1` + `mspp_live_` keys; Compulab's systems hit
   *our* endpoints to provision MSPs, launch pentests, pull results. Nothing ships to them.
   **This is what "API connections for automatic provisioning" means, and it's already our design.**
2. **White-label portal** — each MSP gets a branded instance of our dashboard at their own
   subdomain/logo. Still our hosted multi-tenant app, just themed per-org. (Likely the "app people use" image.)
3. **App image (self-hosted appliance / Docker/OVA)** — partners run our software *in their own cloud*.
   Genuinely different, much heavier product: offline licensing, update channel, packaging scanner
   runners, support burden. Only justified by a hard data-residency / air-gap requirement.

**Recommendation: do #1 + #2, not #3.** The API *is* the partner surface; the white-label portal is the
human surface. Don't distribute an appliance unless Compulab explicitly requires the software to run
inside their infrastructure — that's a direct question for Luis, not an assumption to build on.

## Where "consolidated buying" breaks the current design

Compulab is a **distributor sitting *above* the MSPs** — they buy capacity in bulk and allocate it
down. Luis said "your partners, resellers **and** their clients" = three layers under Compulab.

> (historical) Points 1 below argued for an **N-level** tree with a distributor node. The model was
> **locked to a fixed 3-level** `supplier → reseller → client` tree (2026-07-14; Compulab =
> supplier). The quota-pool and billing points (2–3) remain current.

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
   This is the "hard and soft quota systems you outlined." _(Under the per-IP model above, billing is
   pure post-paid consumption; downstream quotas are spend-control caps, not prepaid buckets.)_

3. **Decouple billing from provisioning.** Consolidated = **one invoice to Compulab**, net terms, for
   the pool. Downstream MSPs never touch Stripe. Current Stripe-per-user-credits flow is the wrong
   shape — want usage metering → monthly rollup → single distributor invoice (Stripe Invoicing or a
   usage export they reconcile).

## Additional ideas to raise

- **Outbound webhooks** — auto-provisioning is bidirectional; push `pentest.completed` / `report.ready`
  (signed) to Compulab instead of polling. Current design only has *inbound* runner callbacks.
- **Test-mode keys** (`mspp_test_`) — build integration without launching/paying for real scans.
- **Per-node usage/reporting endpoint** — "consumption across all my MSPs this month" is table stakes.
- **Idempotency keys** on `POST /pentests` — automated callers retry; avoid dup launches billed to the pool.
- **White-label config on the org node** (logo, colors, CNAME, report cover, email sender), inherits down.

## Questions to pin down with Luis (next call)

1. Does anything need to run **inside their infrastructure**, or is a hosted API + keys acceptable?
   (Kills or confirms the app-image path.)
2. Who owns the **customer relationship and billing** — Compulab consolidated, or MSPs pay us directly?
   (Confirms the pool/invoice model.) _(Answered: Compulab consolidated, post-paid — see product model.)_
3. Exact **quota semantics** — pool at Compulab level, sub-allocated per MSP? Overage allowed or hard-blocked?
4. White-label at the **Compulab brand**, per-MSP brand, or both?

---

# Product Requirements: AI Pentesting Agent (PRD)

_Originally `Pentester.md` (Feb 2026). Integrated here as the AI-pentest-agent PRD. Still-valid
product requirements are kept; anything superseded by the single-product per-IP model is flagged
**(historical)**._

## Overview & vision

An AI-powered autonomous pentesting agent that combines Claude's reasoning with the full arsenal of
Kali Linux security tools. It performs comprehensive penetration tests, writes professional reports,
and democratizes security testing for organizations that can't afford traditional pentesting.

**Vision:** become the "first security hire" for startups and the go-to compliance solution for
organizations needing professional penetration testing — making enterprise-grade testing accessible,
affordable, and continuous.

## Target market

**Primary segments:** Startups & SMBs (need testing, can't afford $10k–50k pentests); internal
security teams augmenting their workflow; **MSPs** offering assessments to multiple clients (the
consolidated-buyer motion); compliance-driven orgs (SOC 2, ISO 27001, PCI-DSS).

**Personas:** Sam (startup CTO, needs SOC 2 pentest, ≤$5k budget, wants actionable findings);
Maria (security engineer, automates quarterly assessments, needs management-ready reports); David
(MSP security lead, 20+ SMB clients, needs standardized/repeatable testing + client-ready reports).

## Core functionality (still current)

**Autonomous agent:** Claude-powered agentic system with reasoning + tool use; full Kali toolset via
Docker/VM; serverless backend; isolated, ephemeral execution environment per engagement.

**Agent capabilities:** reconnaissance (OSINT, subdomain enum, port scan, service detection);
vulnerability identification (web-app scanning, network vuln assessment, misconfig detection);
exploitation (automated exploitation of common vulns, with consent); limited post-exploitation
(privilege-escalation testing, exfiltration simulation); professional report generation.

**Agent loop:** Plan → Execute → Analyze → Decide → Report → Iterate. Sandboxed command execution
with timeouts/resource limits, output parsing to structured data, error handling + retries. Claude
does test planning, tool selection, result analysis (real vs false positive), cross-tool attack-chain
reasoning, exploitation decisions, and report writing.

**Tooling (phased):**
- *Phase 1 (MVP):* `nmap`, `nikto`/OWASP ZAP, `sqlmap`, `dirb`/`gobuster`, `nuclei`, custom LLM analysis.
- *Phase 2:* Metasploit, Burp Suite, Nessus/OpenVAS, Hydra, Wireshark.

## Report generation (still current)

**Components:** executive summary (business impact), methodology (OWASP/PTES/custom), findings by
severity (Critical/High/Medium/Low/Info), evidence (screenshots, command output, PoC), specific
remediation, appendices (tools, scope, timeline).

**Export formats:** PDF (client-ready), HTML (interactive), JSON (API integration), Markdown.

## Engagement types & pricing

> (historical) The tiered engagement types and per-engagement/subscription pricing below are
> **superseded** by the single-product-per-IP model (one AI pentest, metered per live IP, post-paid
> to the consolidated buyer, Bronze/Silver/Gold rate tiers — see the product model above). Retained
> for the depth/scope definitions and go-to-market context.

- **Quick Scan** (15–30 min, $50–100): external + web-surface scan, basic vuln ID, summary report.
- **Standard Pentest** (2–4 hrs, $500–1000): full recon, network + web testing, limited exploitation.
- **Comprehensive Pentest** (8–24 hrs, $2000–5000): full PTES, multiple attempts, phishing sim,
  post-exploitation, executive + technical reports.
- **Continuous Monitoring** (subscription): weekly/monthly automated testing, change/regression
  detection, posture tracking.
- (historical) Pay-per-engagement: Quick $99 / Standard $999 / Comprehensive $4,999. Subscriptions:
  Starter $299/mo (5), Professional $999/mo (20 + monitoring), Enterprise custom (unlimited +
  white-label + API).

## Positioning (still current)

- **vs traditional pentesting:** ~90% cost reduction, same-day vs weeks/months, repeatable/continuous,
  no scheduling conflicts.
- **vs automated scanners:** AI intelligence (not just signatures), full pentest methodology (not just
  scanning), professional reports (not just CVE lists), contextual analysis.

**Launch strategy:** Beta (3 mo, 20–50 design partners, free/discounted, focus report quality/UX) →
Early Access (6 mo, invite-only, 50% off annual, compliance use cases, build Jira/Slack/GitHub
integrations) → GA (public, full pricing, self-service onboarding, scaled marketing).

## UX workflow (still current)

1. **Define scope** — enter target (URL/IP/domain), set in/out-of-scope, choose engagement type,
   upload authorization. _(per-IP model: single paste-box for targets; bill on discovered live hosts.)_
2. **Configure test** — compliance framework (OWASP/PCI/SOC2), risk tolerance (passive/active/
   aggressive), depth, schedule.
3. **Authorization** — legal disclaimer, ownership/permission verification, payment.
4. **Execution** — real-time progress, agent-reasoning transparency, ETA, pause/stop.
5. **Review results** — findings summary, severity breakdown, interactive evidence browser, downloads.
6. **Remediation tracking** — mark findings fixed, request retest, track posture over time.

## Technical architecture (reference)

**Backend (serverless):** API Gateway entry; Cloud Functions/Run orchestration (Node.js/Python);
agent runtime = Docker containers with Kali tools; async job queue (Cloud Tasks/SQS); storage =
object store (GCS/S3) for reports/artifacts, Firestore/DynamoDB for metadata, Redis for agent state.
Security: isolated ephemeral containers, network egress controls (outbound only to target), audit
logging, encrypted findings storage, RBAC.

**Frontend:** Next.js/React SPA — scope definition, real-time progress monitoring, report viewer,
historical-engagement dashboard, live agent logs, interactive findings explorer, CI/CD integration APIs.

**Proposed stack:** Node.js (orchestration) + Python (tools); GCP Cloud Run (containerized); Cloud
Tasks queue; Firestore (metadata) + GCS (artifacts); Kali Linux Docker image; Next.js 14 App Router
+ Tailwind + shadcn/ui; React Query + Zustand; Firebase Auth; Claude API; LangChain or custom agent
loop; GCP primary / AWS fallback; Terraform; GitHub Actions; Cloud Monitoring + Sentry; gVisor
container isolation; GCP Secret Manager; SOC 2 Type II (future).

> (historical/current-engine note) The Kali-Docker Cloud Run agent above is one design; the current
> live pipeline is **Make.com**, and the next AI-agent engine candidate is **Strix** (see `README.md`
> → Backend / Pentest Engine and `HANDOFF.md`).

## Success metrics

- **Product:** engagement completion rate (>95%), avg duration by type, false-positive rate (<10%),
  Critical/High findings per engagement, user-rated report quality.
- **Business:** MRR, CAC, LTV, NRR, engagements/customer/month.
- **User:** time-to-first-engagement, repeat rate, report download rate, remediation-tracking
  adoption, NPS.

## Risks & mitigations

- **Agent stuck / low-quality results** → human-in-the-loop fallback, strict timeouts, quality checks.
- **False positives overwhelm users** → AI filtering, confidence scores, feedback loop.
- **Excessive infra cost/engagement** → container optimization, spot instances, per-engagement cost limits.
- **Unauthorized targeting** → strong verification, legal disclaimers, IP blocking for abuse.
- **Findings misused** → watermarked reports, access controls, audit trails.
- **Liability for missed vulns** → clear SLA limits, "best effort" positioning, insurance.
- **Pentester community pushback** → position as "first pass" / continuous-monitoring, not a
  replacement for expert pentests.
- **Auditors reject AI pentests** → partner with compliance firms, get endorsements, offer human review.

## Competitive landscape

- **Traditional firms** — expert, custom, auditor-accepted; but expensive, slow, not continuous.
  Our edge: speed, cost, repeatability.
- **Automated scanners (Qualys, Rapid7, Tenable)** — fast, broad, established; but high false
  positives, no intelligence, generic reports. Our edge: AI analysis, pro reports, methodology.
- **Hybrid platforms (Cobalt.io, Bugcrowd)** — human expertise, marketplace; but $5k–20k, scheduling
  delays. Our edge: lower cost, instant results, fully automated.
- **Bug bounty (HackerOne, Bugcrowd)** — crowd-sourced, pay-for-results; but unpredictable, needs
  bounty management, not compliance-friendly. Our edge: predictable, pro reports, compliance-focused.

## Open questions (PRD-era)

1. Verify proof of ownership/authorization at scale?
2. Right balance of automation vs human oversight?
3. Manual pentest as premium add-on? _(Answered: yes — quiet on-request upsell; see product model.)_
4. Handling findings needing human judgment (business-logic flaws)?
5. Minimum viable report quality for compliance acceptance?
6. Build our own tool orchestration or use existing frameworks (Faraday, Dradis)?
7. Differentiation from Cobalt.io / Bugcrowd / hybrid platforms?
