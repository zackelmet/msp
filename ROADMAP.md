# MSPP Platform — Dev Roadmap

_Last updated: 2026-07-13. Priority order set by Zack after the 2nd Luis (Compulab) meeting._

**The goal:** turn the MSPP dashboard into a **consolidated-buyer pentest platform** — a
distributor buys pentest capacity in bulk and allocates it down to MSPs and their clients —
with the product actually executing real pentests, and a provisioning UX modeled on Acronis.

Three priorities, in order. **P1 must land before P2 depth.**

---

## P1 — Make the product actually run pentests (parity with AIP)  ← FIRST

**Goal:** a launched pentest reaches a real engine and its results + report flow back into the
dashboard, exactly like the sibling **AIP** app.

**Reality check (from the AIP↔msp gap analysis + Zack):** AIP has no secret engine. There are **no
GCP/Cloud-Run scanner runners** — the **single real pipeline is Make.com**: `/api/pentests` +
`/api/ai-pentest-launch` → Make webhook → PATCH callback to `/api/pentests` (callback fully
implemented). Make.com runs the actual pentest workflow (tooling + human operators).

So P1 is **closing specific gaps on the Make.com pipeline + removing dead scanner code**, not
building an engine:

- [ ] **P1.1 — Remove dead GCP scanner code.** There are no runners, so `src/lib/gcp/scannerClient.ts`
      (`enqueueScanJob`), `src/app/api/scans/**` (incl. `scans/webhook`), and the orphaned
      `src/app/api/ai-pentest/route.ts` (whose `:178 // TODO: Trigger actual scan execution` never
      fires) are dead paths. Delete them (and any `GCP_*_SCANNER_URL` config), or repoint
      `/api/ai-pentest` at the Make.com flow if that batch UX is still wanted. Removing avoids
      confusion about a second "engine" that doesn't exist.
- [ ] **P1.2 — Harden pentest auth (security).** `src/app/api/pentests/route.ts` POST (:8) / GET
      (:123) and `pentests/[id]/route.ts` (:11) trust a **client-supplied `userId`**. These spend
      credits — switch to `verifyAuthToken` (already at `firebaseAdmin.ts:84`, used by
      `ai-pentest-launch`).
- [ ] **P1.3 — Automated report engine (largest missing subsystem).** msp has no
      `src/lib/report-engine/*`, no `/api/admin/report-engine/*`, no `parseFindingsBlock`. Port from
      AIP: `report-engine/{types,docx-template,pdf-template,cvss,storage}.ts`,
      `/api/admin/report-engine/{submit,finalize,reports/[reportId]}`, `findings/parseFindingsBlock.ts`,
      + admin UIs. Today msp can only manually upload a report (`admin/upload-report`).
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

---

## P2 — Consolidated-buyer platform  ← SECOND

**Goal:** distributor → reseller → tenant org tree, consumable quota pools, scoped API keys, a
provisioning API, and billing decoupled from provisioning. Design: `docs/api-v1.md`,
`COMPULAB_PARTNERSHIP.md`.

- [x] **Phase 1 — data-model foundation (built).** `src/lib/types/{org,tier,quota,apiKey,usage}.ts`,
      `src/lib/org/{collections,tree,entitlement}.ts`, `scripts/migrateOrgs.js`, updated
      `firestore.rules`, `users` extended with `orgId/orgPath/role`.
- [ ] **P2.0 — Run the migration on prod.** `node scripts/migrateOrgs.js --commit` (needs Firebase
      Admin creds available in the run environment — one-time enablement).
- [ ] **Phase 2 — API keys + auth.** Mint/verify `mspp_live_`/`mspp_test_` (store SHA-256 + prefix),
      scopes, and a **dual auth middleware** (API key OR Firebase token) shared by all handlers.
- [ ] **Phase 3 — Provisioning core.** `POST /api/v1/pentests`: entitlement check → `reserveQuota`
      → launch via the Make.com pipeline (optionally Cloud Tasks in front for retry/rate-limit) →
      HMAC callback → `consumeQuota` + `usageLedger`. Idempotency-Key support.
- [ ] **Phase 4 — Org + quota management endpoints** (`/api/v1/orgs`, `/quota`, `/caps`, `/usage`,
      `/api-keys`, `/webhooks`) + dashboard wiring.
- [ ] **Phase 5 — Billing decoupled from provisioning.** Metered usage → monthly rollup → single
      consolidated distributor invoice (Stripe Invoicing); downstream MSPs never touch Stripe.
      Signed outbound webhooks (`pentest.completed`, `report.ready`, `quota.*`).
- [ ] **Adopt Acronis quota model** (see P3): explicit **overage grace band** per SKU on
      `QuotaPool.policy`, and enforce the **parent-cap invariant** (a child's hard quota ≤ parent's)
      in `src/lib/org/entitlement.ts`. (Current cap check is a documented Phase-1 approximation.)

---

## P3 — Acronis-north-star UX  ← THIRD (informs P2's UI)

**Goal:** a control-plane admin surface modeled on the Acronis Cyber Protect Cloud Management
Portal. Full teardown in **`docs/north-star-acronis.md`**. Highest-value patterns to build:

- [ ] **Clients grid home** — flat tenant table at the current level; **click name to drill down,
      breadcrumb (top-left) to ascend**. No tree widget.
- [ ] **Per-tenant Overview** — one section per enabled service with current usage +
      a **"Manage service" jump button** into the pentest console. Manage all clients from one level.
- [ ] **Provisioning screen** — **service = tab, offering item = checkbox row, quota = inline
      editable link, overage field** — enablement and quota-setting on ONE screen.
- [ ] **Color-as-status usage grids** (under = normal, at/over = orange) for dense multi-tenant scan.
- [ ] **Usage rolls up the tree** into partner-level billing reports (snapshot + scheduled).
- [ ] **Two-tier console** — thin multi-tenant control plane that launches into the deep
      per-service pentest tooling, rather than one monolith.

---

## Shipped this session (heading to `main`)
- P2 Phase 1 data-model foundation (above).
- **Fix:** admin pages lost the sidebar — added `src/app/admin/layout.tsx` wrapping `DashboardLayout`.
- **Feat:** public API docs at `/docs/api` (sanitized — no partner names) + footer link.
- Docs: this roadmap, `docs/north-star-acronis.md`, updated `HANDOFF.md`.
