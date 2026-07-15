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
