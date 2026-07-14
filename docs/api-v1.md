# MSPP Provisioning API — `/api/v1` (proposed)

_Status: **draft / proposed** — not yet implemented. Last updated 2026-07-13._

Programmatic API for partners (suppliers, resellers/MSPs) to provision org trees, mint keys,
launch pentests, and pull results. Backs the Compulab consolidated-buying program. See
`COMPULAB_PARTNERSHIP.md` and `HANDOFF.md` for the design rationale.

---

## Conventions

- **Base URL:** `https://app.msppentesting.com/api/v1`
- **Auth:** `Authorization: Bearer mspp_live_<key>` (or `mspp_test_<key>` for the sandbox — no real
  scans, no billing). Dashboard UI keeps using Firebase ID tokens against the same handlers.
- **Format:** JSON in/out. UTC ISO-8601 timestamps.
- **Idempotency:** mutating calls accept `Idempotency-Key: <uuid>`; a repeated key returns the
  original result instead of acting twice (required for safe auto-provisioning retries).
- **Scoping:** a key is bound to an org node and may act on that node **and its subtree** only
  (authz = target org's `path` contains the key's `orgId`).
- **Pagination:** `?limit=` (default 50, max 200) + `?cursor=`; responses include `next_cursor`.
- **Errors:** standard HTTP + `{ "error": { "code", "message", "details"? } }`.
  - `401` bad/missing key · `403` out of scope · `402` quota exhausted (hard) · `409` idempotency/state
    conflict · `422` validation · `429` rate/concurrency limit.

---

## Org tree

Fixed 3-level tree: `supplier → reseller → client` (no sub-resellers). A supplier
selling direct uses a "house" reseller node so the tree is always exactly 3 deep.
Every node carries a materialized `path[]` (supplier→self).

### `POST /orgs`
Create a node anywhere in the tree.
```jsonc
// request
{
  "type": "reseller",                 // supplier | reseller | client
  "parentOrgId": "org_supplier",
  "name": "Acme MSP",
  "slug": "acme",                     // optional; used for portal subdomain
  "tierId": "tier_pro",               // optional; inherited from ancestor if omitted
  "branding": { "logoUrl": "...", "primaryColor": "#0b5" },  // optional; inherited if omitted
  "billing": { "mode": "inherited" }  // consolidated | direct | inherited
}
// 201
{ "id": "org_acme", "type": "reseller", "parentOrgId": "org_supplier",
  "path": ["org_msp","org_supplier","org_acme"], "status": "active" }
```

### `GET /orgs/{id}` · `GET /orgs/{id}/children` · `GET /orgs?subtreeOf={id}`
Fetch a node, its direct children, or the whole subtree.

### `PATCH /orgs/{id}`
Update `name`, `status` (`active|suspended`), `tierId`, `branding`, `billing`.

---

## Quota & allocations

Pool lives on the supplier (tree root), denominated in **per-SKU buckets**
(`ai_pentest`, `external`, `internal`, `manual`, …). Draw-down is shared across the subtree; child
**caps** are optional ceilings.

### `PUT /orgs/{id}/quota`  _(pool-holding node)_
```jsonc
{ "purchased": { "ai_pentest": 200, "external": 50 },
  "replenish": "monthly",            // monthly | one_time
  "policy": { "ai_pentest": "soft", "external": "hard" } }  // soft = allow overage & bill it
```

### `PUT /orgs/{id}/caps`  _(child node)_
```jsonc
{ "caps": { "ai_pentest": 40 }, "policy": { "ai_pentest": "hard" } }
```

### `GET /orgs/{id}/quota`
Current pool state for the subtree.
```jsonc
{ "purchased": { "ai_pentest": 200 }, "reserved": { "ai_pentest": 5 },
  "consumed": { "ai_pentest": 30 }, "available": { "ai_pentest": 165 } }
```

---

## API keys

### `POST /orgs/{id}/api-keys`
Mint a scoped key. Full secret returned **once**; only a SHA-256 hash + prefix are stored.
```jsonc
// request
{ "name": "Compulab provisioning", "scopes": ["orgs:write","pentests:write","usage:read"] }
// 201
{ "id": "key_123", "prefix": "mspp_live_a1b2", "secret": "mspp_live_a1b2c3…", "orgId": "org_supplier" }
```

### `GET /orgs/{id}/api-keys` · `DELETE /api-keys/{keyId}`
List (prefix + metadata only) / revoke.

---

## Pentests

### `POST /pentests`
Launch. Runs walk-up entitlement (tier capability + pool/cap check), reserves units, enqueues the job.
```jsonc
// request
{ "clientId": "org_client_x",
  "scanType": "ai_pentest",          // maps to a SKU
  "targets": ["example.com", "10.0.0.0/24"],
  "webhookUrl": "https://compulab.example/hooks/mspp",  // optional per-launch override
  "metadata": { "poNumber": "CL-4471" } }
// 202 (queued)
{ "id": "pt_789", "status": "queued", "clientId": "org_client_x",
  "sku": "ai_pentest", "units": 2, "reserved": true, "createdAt": "2026-07-13T…Z" }
// 402 if hard-blocked
{ "error": { "code": "quota_exhausted", "message": "ai_pentest pool exhausted", "details": { "available": 0 } } }
```

### `GET /pentests?clientId=&resellerId=&status=` · `GET /pentests/{id}`
List (scoped to the key's subtree) / fetch status + findings summary.

### `GET /pentests/{id}/report?format=pdf|json`
Branded report artifact (white-label cover applied from the org's resolved branding).

### `POST /pentests/{id}/result`  _(internal — scanner runner → API)_
HMAC-verified callback (`X-MSPP-Signature`). Finalizes: moves `reserved → consumed`, writes findings,
fires the outbound `pentest.completed` webhook.

---

## Usage & reporting

### `GET /orgs/{id}/usage?from=&to=&groupBy=sku|child|day`
Rollup over the subtree from the append-only usage ledger — the same data Compulab is invoiced on.
```jsonc
{ "from": "2026-07-01", "to": "2026-07-31",
  "totals": { "ai_pentest": 30, "external": 12 },
  "overage": { "ai_pentest": 0 },
  "byChild": [ { "orgId": "org_acme", "ai_pentest": 18 } ] }
```

---

## Outbound webhooks

Partner registers endpoints; MSPP POSTs signed events (`X-MSPP-Signature`, HMAC-SHA256, with retry).

### `POST /orgs/{id}/webhooks`
```jsonc
{ "url": "https://compulab.example/hooks/mspp",
  "events": ["pentest.completed","report.ready","quota.soft_exceeded"] }
```

**Event types:** `pentest.queued` · `pentest.completed` · `pentest.failed` · `report.ready` ·
`quota.soft_exceeded` · `quota.exhausted`.
```jsonc
// example delivery
{ "type": "pentest.completed", "id": "evt_…", "createdAt": "…",
  "data": { "pentestId": "pt_789", "clientId": "org_client_x", "sku": "ai_pentest",
            "findingsCount": 14, "reportUrl": "…" } }
```

---

## Endpoint summary

| Method & path | Purpose |
|---|---|
| `POST /orgs` · `GET /orgs/{id}` · `GET /orgs/{id}/children` · `PATCH /orgs/{id}` | Manage org tree |
| `PUT /orgs/{id}/quota` · `PUT /orgs/{id}/caps` · `GET /orgs/{id}/quota` | Pools & caps |
| `POST /orgs/{id}/api-keys` · `GET …` · `DELETE /api-keys/{id}` | Scoped keys |
| `POST /pentests` · `GET /pentests` · `GET /pentests/{id}` · `GET /pentests/{id}/report` | Launch & results |
| `POST /pentests/{id}/result` | Runner callback (internal, HMAC) |
| `GET /orgs/{id}/usage` | Consumption reporting / billing source |
| `POST /orgs/{id}/webhooks` | Outbound event subscriptions |

---

## Open items (pending Luis)
- Allocation model default (shared draw-down + caps vs strict envelope).
- Hard/soft defaults per SKU. · Pool replenishment (monthly commit vs one-time, rollover?).
- Whether client-level keys are exposed or reseller-scoped only.
