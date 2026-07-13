# North Star: Acronis Cyber Protect Cloud (UX + model reference)

_Last updated: 2026-07-13. Why: Luis (Compulab) provisions IT services (VMs, servers,
M365 licenses) through Acronis; its multi-tenant management portal is the model we emulate
for the consolidated-buyer pentest platform. See `COMPULAB_PARTNERSHIP.md`, `docs/api-v1.md`._

Acronis solves exactly our problem: a vendor sells capacity, partners (MSPs) resell it,
end customers consume it — through one "single pane of glass" **Management Portal**, with
per-service consoles hanging off it.

## Tenant hierarchy (maps to our org tree)

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
rich per-service consoles — rather than one monolith. For us: the org/quota/billing admin
surface vs. the existing pentest-execution dashboard.

## API-first posture

The whole portal is API-backed (developer.acronis.com):
- `/tenants` — CRUD tenants, set `kind`, parent, management mode.
- `/tenants/{id}/offering_items` — **PUT** enables items, switches editions, writes quota
  objects. Offering item JSON: `application_id`, `measurement_unit` (bytes/quantity), `edition`,
  `quota { value, overage, version }`. **Versioned quota objects** enable safe concurrent writes.
- OAuth2 client-credential API clients + Python SDK. Resellers wire this into their own
  billing/PSA to auto-provision on sale and auto-meter for invoicing.

→ Model the **API as source of truth, UI as one client of it** (already our `docs/api-v1.md`
direction). Adopt the `{value, overage, version}` quota shape and offering-items concept.

## Top patterns to copy (priority order)
1. Recursive partner tenancy + non-recursive billable Customer leaf.
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
