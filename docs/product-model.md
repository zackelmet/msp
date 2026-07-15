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

- The consolidated buyer has **no ceiling.** Instead they sit on a **plan tier**
  (Bronze/Silver/Gold-style). The tier is a **commercial rate tier, not a technical limit
  and not a floor.**
- **Pay actual, no take-or-pay:** commit to Gold's 500 but use 300 → pay for 300.
- **Volume threshold + overage discount:** each tier has a monthly IP **volume threshold**;
  IPs consumed **past the threshold are discounted** (marginal IPs get cheaper — rewards
  growth, nudges up a tier). Consumption is unlimited; there is no block at the buyer level.
- **Monthly.** **Price-only** for now (tiers don't gate features/support yet).
- _Open (does not block UI/data model): whether the base per-IP rate also drops at higher
  tiers, or the tier is purely where the overage discount begins. Pricing-sheet detail; set
  the numbers later._

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
  multi-scan-type framing); keep existing styling.
- **Provisioning at the buyer level** — a `planTier` selector (later; not client-provisioning).
