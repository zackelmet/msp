# MSP Pentesting — AI Penetration Testing Platform

AI-powered autonomous penetration testing platform. Next.js frontend with a serverless
backend and an external pentest engine. Multi-tenant control plane that launches AI pentests
and rolls usage up to a single consolidated-buyer invoice.

> **Product model (current source of truth):** the product has collapsed to **one product — an
> AI pentest, metered per live IP**. See **`docs/product-model.md`** for the authoritative build
> contract, strategy, roadmap, partnership notes, and product requirements. This README is the
> **technical hub** (setup, config, backend/engine, API spec). Content below marked **(historical)**
> describes earlier multi-SKU / specific-engine approaches that the per-IP pivot superseded; it is
> retained for its still-valid technical/architectural detail.

> **This README merges the former** `README.md`, `BACKEND_SETUP.md`, `PTAAS_SETUP.md`,
> `BUILD_SUMMARY.md`, `backend/README.md`, and `docs/api-v1.md` **into one technical hub.**

## Security Notice

This platform is for authorized security testing only. Ensure you have permission before testing
any target.

---

## Tech Stack

- **Frontend:** Next.js 14.2.15 (App Router), React, TypeScript, TailwindCSS, shadcn/ui
- **Backend:** Next.js API Routes + Firebase Admin SDK; external pentest engine (see below)
- **Database:** Firebase Firestore (project `msp-pentesting`) with security rules
- **Storage:** Firebase Storage / Cloud Storage for pentest reports
- **Payments:** Stripe (checkout + invoicing)
- **Authentication:** Firebase Auth (`Authorization: Bearer <firebase-id-token>` on API routes)
- **Hosting:** Vercel (`msppentesting` project → https://msppentesting.vercel.app)
- **AI / engine:** AI pentest engine — current candidate **Strix** (see Backend / Pentest Engine).
  (historical) Earlier designs used an Anthropic Claude Cloud Run agent and GCP scanner functions.

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── activity/          # Activity logging endpoints
│   │   ├── ai-pentest-launch/ # AI pentest launch (credit txn → Make.com per target)
│   │   ├── checkout/          # Stripe checkout sessions
│   │   ├── engagements/       # Client engagement management
│   │   ├── findings/          # Vulnerability findings CRUD
│   │   ├── manual-tests/      # Manual test logging
│   │   ├── pentests/          # Pentest create/status + PATCH results callback
│   │   ├── pentest-requests/  # Manual pentest request handling
│   │   └── v1/                # (planned) partner provisioning API — see spec below
│   ├── app/                   # Authenticated dashboard (results, launch, findings, clients)
│   ├── admin/                 # Platform-only admin console (isAdmin-gated)
│   └── pricing/               # Pricing & checkout page
├── components/
│   ├── admin/sections/        # PlatformSection (control plane), ReportEngineSection, etc.
│   ├── dashboard/             # Dashboard layout & navigation
│   └── nav/                   # Navbar components
├── lib/
│   ├── types/                 # org.ts, tier.ts, quota.ts, apiKey.ts, usage.ts, pentest.ts, user.ts
│   ├── org/                   # collections.ts, tree.ts, entitlement.ts, access.ts
│   ├── report-engine/         # types/cvss/storage/docx-template/pdf-template
│   ├── hooks/                 # React hooks for data fetching
│   └── firebase/              # firebaseAdmin.ts (adminDb/adminAuth/adminStorage), client config
└── scripts/
    ├── setupStripeProducts.js # Stripe product setup script
    └── migrateOrgs.js         # Org-tree migration (dry-run default; --commit)
```

> (historical) The original structure also exposed `/api/ai-pentest`, `/api/scans/**`, and
> `/app/ai-pentest` + `/app/scans` pages tied to GCP scanner runners. These were removed (roadmap
> P1.1, commit `63606c6`) since Make.com is the only live engine.

---

## Local Setup & Run

### Prerequisites
- Node.js + npm
- A Firebase project (`msp-pentesting`)
- Stripe account
- (backend/engine) Anthropic API key or engine credentials; Google Cloud SDK if deploying the
  Cloud Run backend

### Quick start (local)

```bash
npm install
cp .env.example .env.local   # then fill Firebase/Stripe creds (see Environment / Config)
npm run dev                  # → http://localhost:3000
```

### Development commands

```bash
npm install     # Install dependencies
npm run dev     # Run development server
npm run build   # Build for production
npm start       # Start production server
```

### 1. Firebase setup

```bash
firebase projects:create msp-pentesting
firebase use msp-pentesting
firebase init firestore
firebase init storage
```

- **Enable Authentication** (manual): https://console.firebase.google.com/project/msp-pentesting/authentication
  → enable Email/Password provider.
- **Create Service Account**:
  - https://console.cloud.google.com/iam-admin/serviceaccounts?project=msp-pentesting
  - Create service account → download JSON → base64 encode: `base64 -w 0 serviceaccount.json`
  - Add to `.env.local` as `FIREBASE_SERVICE_ACCOUNT_KEY`.
- **Deploy Firestore Rules**: `firebase deploy --only firestore:rules`

The gitignored `.env.local` holding `FIREBASE_SERVICE_ACCOUNT_KEY` lets Admin-SDK scripts (e.g.
`migrateOrgs.js`, `setupStripeProducts.js`) run directly from the checkout.

### 2. Stripe setup

1. Add Stripe keys to `.env.local`:
   ```
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_SECRET_KEY=sk_live_...
   ```
2. Create products & prices:
   ```bash
   npm install dotenv
   node scripts/setupStripeProducts.js
   ```
   Copy the price IDs the script outputs into `.env.local`.
3. Set up the webhook (production): create endpoint `/api/webhooks/stripe`; add its secret to
   `.env.local` as `STRIPE_WEBHOOK_SECRET`.

> (historical) `setupStripeProducts.js` created four SKUs — AI Pentest Single ($199), AI Pentest
> Monthly ($499/mo), Manual Basic ($2,000), Manual Advanced ($5,000). Under the per-IP pivot there
> is **one product** (AI pentest per live IP), billed post-paid to the consolidated buyer on actual
> consumption, with commercial Bronze/Silver/Gold rate tiers. The `/pricing` rework waits on real
> per-IP cost data. See `docs/product-model.md`.

### 3. Vercel deployment

```bash
vercel link
# add each env var (see Environment / Config):
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY
vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID
vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
vercel env add NEXT_PUBLIC_FIREBASE_APP_ID
vercel env add FIREBASE_SERVICE_ACCOUNT_KEY
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_WEBHOOK_SECRET
# ...Stripe price IDs, engine/webhook vars as needed

vercel --prod
```

### 4. GCP scanner functions (historical / optional)

> (historical) Early designs called out GCP scanner functions (Nmap, OpenVAS, ZAP) via
> `GCP_NMAP_FUNCTION_URL`, `GCP_OPENVAS_API_URL`, `GCP_ZAP_API_URL`, `GCP_WEBHOOK_SECRET`. **There
> are no GCP scanner runners in the live system** — the single real pipeline is Make.com (and Strix
> as the next engine candidate). Retained here only as a record of the earlier scanner-function plan.

---

## Environment / Config

Create `.env.local` with the following (webapp side):

```bash
# Firebase (Client)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (Server)
FIREBASE_SERVICE_ACCOUNT_KEY=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Stripe Price IDs (historical multi-SKU — collapsing to a single per-IP model)
NEXT_PUBLIC_STRIPE_PRICE_AI_SINGLE=
NEXT_PUBLIC_STRIPE_PRICE_AI_MONTHLY=
NEXT_PUBLIC_STRIPE_PRICE_MANUAL_BASIC=
NEXT_PUBLIC_STRIPE_PRICE_MANUAL_ADVANCED=

# Engine / launch pipeline
MAKE_WEBHOOK_URL=                     # Make.com scenario webhook (replaces hardcoded URLs)
BACKEND_WEBHOOK_URL=                  # (historical) Cloud Run backend /execute-pentest URL
GCP_WEBHOOK_SECRET=                   # shared secret between webapp and backend/Make callback
RESEND_API_KEY=                       # launch/notification emails

# GCP Scanner Functions (historical / optional — no live runners)
GCP_NMAP_FUNCTION_URL=
GCP_OPENVAS_API_URL=
GCP_ZAP_API_URL=

# Application
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Backend / engine environment (Cloud Run — historical Claude agent design)

```bash
ANTHROPIC_API_KEY=<set-in-secret-manager-or-env>   # Claude engine
GCP_WEBHOOK_SECRET=<shared with webapp — must match>
WEBAPP_API_URL=https://msppentesting.vercel.app/api/pentests   # results callback
GCS_BUCKET_NAME=msp-pentest-reports
GCP_PROJECT_ID=msp-ai-pentester
GCP_REGION=us-east1
PORT=8080                                            # backend server port (default)
# Optional, only if backend writes Firestore directly (it normally calls back via webhook):
FIREBASE_ADMIN_PROJECT_ID=msp-pentesting
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY=...
```

⚠️ `GCP_WEBHOOK_SECRET` must be the **same shared value** in both webapp and backend/engine env.

---

## Firestore Collections

### Core collections
- **users** — profiles, roles, and `credits`. `users` also carry `orgId` / `orgPath[]` / `role`
  (`platform_admin | supplier_admin | reseller_admin | client_user`) after the org migration.
- **orgs** — the multi-tenant org tree (`supplier → reseller → client`, materialized `path[]`).
- **tiers** — entitlement/rate templates.
- **quotaPools** / **orgCaps** — quota pool + per-child caps (soft/hard policy).
- **usageLedger** — append-only consumption ledger (billing substrate).
- **provisioningJobs** — queue records.
- **pentests** — pentest jobs + results, carry `{ resellerId, clientId }`.
- **findings** — vulnerability findings.
- **engagements** — client engagement tracking.
- **pentestRequests** — manual pentest requests.
- **activityLogs** — immutable (create-only) system activity.
- (historical) **scans**, **targets**, **aiPentestRuns** — from the scanner-runner era.

### Security rules
- User/org-scoped access control across all collections (read via the user's `orgPath`).
- Admin role checking; all privileged writes are server-side (Admin SDK).
- Activity logs are immutable (create-only).

### `pentests` document schema

```typescript
interface PentestDocument {
  id: string;
  userId: string;
  type: 'web_app' | 'external_ip';   // (historical) product-level type distinction; per-IP model
                                     // no longer distinguishes internal/external as products
  targetUrl: string;

  // Web app specific (optional)
  userRoles?: string;        // Newline-separated list, max 3
  endpoints?: string;        // Newline-separated list, max 10
  additionalContext?: string;

  // Status tracking
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;

  // Results
  results?: {
    report: string;           // Full markdown report
    executiveSummary?: string;
    findings?: number;
  };

  vulnerabilities?: Array<{
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    description: string;
    cve?: string;
    cvss?: number;
    remediation?: string;
    affectedEndpoint?: string;
  }>;
}
```

---

## Backend / Pentest Engine

**Live pipeline:** `/api/pentests` + `/api/ai-pentest-launch` fire a **Make.com** webhook per
target; Make runs the pentest and PATCHes results back to `/api/pentests` (secret-gated callback,
fully implemented). There are **no GCP scanner runners**.

**Next engine candidate:** **Strix** (github.com/usestrix/strix, Apache-2.0) — a CLI-only, Docker-
sandboxed AI pentester run as a backend job that ingests each run's `findings.sarif` / `run.json`
back into `/api/pentests` (mirrors the Make-webhook job pattern). Evaluation details live in
`HANDOFF.md` and the `strix-engine` memory.

The webhook/background-job architecture below was written for the (historical) Anthropic Claude
Cloud Run agent, but its **webhook flow, Firestore schema, endpoint contracts, and job pattern
remain the reference** for the current Make.com pipeline and the Strix integration.

### Architecture (webhook-based) — (historical Claude agent, pattern still current)

Single Cloud Run service that: receives a webhook at `POST /execute-pentest`, validates the
secret, returns `200 OK` immediately, spawns a background worker to run the pentest, calls the
engine (Claude API), generates a branded PDF report, uploads it to Cloud Storage, and sends
results back to the webapp via `PATCH /api/pentests`.

**Pentest flow:**
1. User submits pentest via `POST /api/pentests` (or `/api/ai-pentest-launch`).
2. Credit deducted; pentest doc created with `status: 'pending'`.
3. Webapp sends webhook to the engine with job details.
4. Engine confirms receipt (`200 OK`), sets status `in_progress`.
5. Agent performs the autonomous pentest with tool access.
6. Engine sends results back via `PATCH /api/pentests` with the completed report.
7. User views results at `/app/pentests/[id]` (auto-refreshes).

```
┌─────────────┐                    ┌──────────────┐
│   Webapp    │                    │   Backend    │
│  (Next.js)  │                    │  (Cloud Run) │
└─────────────┘                    └──────────────┘
      │  POST /api/pentests (create)       │
      │────────────────────────────────────▶
      │  Webhook: POST /execute-pentest    │
      │  {pentestId, type, targetUrl...}   │
      │────────────────────────────────────▶
      │  200 OK (receipt confirmed)        │
      │◀────────────────────────────────────
      │                                    │  Agent runs
      │                                    │  pentest w/ tools
      │  PATCH /api/pentests               │
      │  {results, vulnerabilities}        │
      │◀────────────────────────────────────
      │  200 OK                            │
      │────────────────────────────────────▶
```

### Backend endpoints

**`POST /execute-pentest`** (webhook receiver) — auth via `X-Webhook-Secret` matching
`GCP_WEBHOOK_SECRET`.

Request:
```json
{
  "pentestId": "abc123",
  "userId": "user_xyz",
  "type": "web_app" | "external_ip",
  "targetUrl": "https://example.com",
  "userRoles": "admin\\nuser\\nguest",       // optional (web_app)
  "endpoints": "/api/users\\n/api/auth\\n...", // optional (web_app)
  "additionalContext": "..."                  // optional
}
```
Immediate response:
```json
{ "success": true, "message": "Pentest job received", "pentestId": "abc123" }
```
Processing: verify secret → validate params → (optionally set `in_progress`) → queue agent job
(async, e.g. Cloud Tasks / Pub/Sub / thread) → return `200 OK` immediately.

**Results callback → `PATCH https://msppentesting.vercel.app/api/pentests`** — include
`X-Webhook-Secret`.
```json
{
  "pentestId": "abc123",
  "status": "completed" | "failed",
  "results": { "report": "# Full markdown report...", "executiveSummary": "...", "findings": 5 },
  "vulnerabilities": [
    { "title": "SQL Injection in /api/users", "severity": "critical", "description": "...",
      "cve": "CVE-2024-1234", "cvss": 9.8, "remediation": "...", "affectedEndpoint": "/api/users?id=1" }
  ],
  "error": "Error message if failed"   // optional
}
```
Response: `{ "success": true, "message": "Pentest results updated successfully" }`.

### Claude agent integration (historical engine)

> (historical) The Anthropic Claude Cloud Run agent is superseded as the chosen engine (current
> candidate: Strix). The prompt/tooling design below remains useful reference for any AI-agent engine.

**Model:** `claude-sonnet-4-5` or `claude-opus-4`.

**System prompt template:**
```
You are an expert penetration tester conducting an autonomous security assessment.

TARGET: {targetUrl}
TYPE: {pentestType}

{if web_app:}
USER ROLES: {userRoles}
API ENDPOINTS: {endpoints}
{endif}

ADDITIONAL CONTEXT: {additionalContext}

SCOPE:
{if web_app:}
- Test up to 3 user roles for privilege escalation
- Assess up to 10 API endpoints for vulnerabilities
- Focus on OWASP Top 10: injection, broken auth, XSS, SSRF, etc.
- Test authentication and authorization flows
- Check for API security issues
{else:}
- Perform network reconnaissance
- Scan for open ports and services
- Test for common misconfigurations
- Check firewall rules and security posture
- Identify vulnerable services
{endif}

DELIVERABLE:
Provide a comprehensive security report in JSON format with:
1. Executive summary
2. Detailed findings with severity ratings (critical/high/medium/low/info)
3. Step-by-step reproduction steps
4. Specific remediation guidance
5. CVE references where applicable

OUTPUT FORMAT: JSON
{
  "executiveSummary": "...",
  "report": "... (full markdown report) ...",
  "vulnerabilities": [
    { "title": "...", "severity": "critical|high|medium|low|info", "description": "...",
      "cve": "CVE-XXXX-XXXXX", "cvss": 7.5, "remediation": "...", "affectedEndpoint": "..." }
  ]
}
```

**Tool access:**
- *Web application testing:* HTTP client, browser automation (Playwright/Puppeteer), `sqlmap`,
  `nuclei`, `ffuf`, `jwt_tool`.
- *External IP testing:* `nmap`, `masscan`, `nikto`, `testssl.sh`, service-specific tools
  (e.g. `ssh-audit`).

**Error handling:** on failure set `status: 'failed'`, write `results.report` with the error, and
stamp `completedAt`.

**Sample worker structure (Python):**
```python
import anthropic
from google.cloud import firestore

db = firestore.Client()
client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

def process_pentest(pentest_id: str):
    pentest_ref = db.collection('pentests').document(pentest_id)
    pentest = pentest_ref.get().to_dict()
    pentest_ref.update({'status': 'in_progress'})
    try:
        system_prompt = build_system_prompt(pentest)
        response = client.messages.create(
            model="claude-sonnet-4-5-20250514",
            max_tokens=8192,
            system=system_prompt,
            messages=[{"role": "user", "content": f"Perform pentest on {pentest['targetUrl']}"}],
            tools=[ ... ],
        )
        results = parse_claude_response(response)
        pentest_ref.update({
            'status': 'completed',
            'results': results['results'],
            'vulnerabilities': results['vulnerabilities'],
            'completedAt': firestore.SERVER_TIMESTAMP,
        })
    except Exception as e:
        pentest_ref.update({
            'status': 'failed',
            'results': {'report': f'Error: {str(e)}'},
            'completedAt': firestore.SERVER_TIMESTAMP,
        })
```

### Backend file structure (Cloud Run reference)

```
backend/
├── main.py              # Flask app, webhook receiver
├── worker.py            # Agent + pentest execution
├── pdf_generator.py     # PDF creation with MSP branding
├── requirements.txt     # Python dependencies
└── Dockerfile           # Container definition
```

### Backend deployment (Cloud Run)

```bash
export ANTHROPIC_API_KEY="<set-in-secret-manager-or-env>"
export GCP_PROJECT_ID="msp-ai-pentester"

gcloud run deploy msp-pentest-backend \
  --source . \
  --region us-east1 \
  --allow-unauthenticated \
  --set-env-vars="GCP_WEBHOOK_SECRET=<set-a-shared-webhook-secret>" \
  --set-env-vars="ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" \
  --set-env-vars="WEBAPP_API_URL=https://msppentesting.vercel.app/api/pentests" \
  --set-env-vars="GCS_BUCKET_NAME=msp-pentest-reports" \
  --set-env-vars="GCP_PROJECT_ID=msp-ai-pentester" \
  --timeout=3600 --memory=2Gi --cpu=2

# After deploy, point the webapp at the new URL:
vercel env rm BACKEND_WEBHOOK_URL production
vercel env add BACKEND_WEBHOOK_URL production
# Value: https://your-service-url.run.app/execute-pentest
```

Test the webhook receiver:
```bash
curl -X POST https://your-service-url.run.app/execute-pentest \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: <set-a-shared-webhook-secret>" \
  -d '{"pentestId":"test123","userId":"user_abc","type":"web_app","targetUrl":"https://test.example.com"}'
```

### Security considerations
- **Rate limiting:** e.g. max 5 concurrent pentests/user, max 20/user/day; queue to avoid
  resource exhaustion.
- **Target validation:** verify target is internet-accessible; blacklist gov/.mil; require
  ownership proof (DNS TXT or file upload).
- **Legal compliance:** log all activity; disclaimer in user agreement; store consent records.
- **Resource limits:** max ~30 min per pentest; kill on timeout; circuit breaker for failing targets.

### Monitoring & logging
- Track: pentests/day, avg completion time, success/failure rate, engine (API) cost per pentest,
  vulnerabilities by severity.
- Log all agent requests/responses, start/end times, errors/timeouts (Cloud Logging or structured
  Firestore).

### Cost estimation
- Cloud Run: ~$0.10–0.50 per pentest (duration-dependent).
- Engine (Claude Sonnet 4): ~$3–10 per pentest. (historical per-token figures: external IP
  ~50K–100K tokens = $1.50–$3.00; web app ~200K–500K tokens = $6.00–$15.00.)
- Cloud Storage: ~$0.02/GB/month. Est. total **$3–11 per pentest**.
- (per-IP model) The real `cost / IP` — token cost to run one AI pentest on one IP — is **TBD and
  must be measured** on the chosen engine; the rate card stays a formula until then. See
  `docs/product-model.md`.

---

## Application API

### Create Pentest — `POST /api/pentests`
Auth: Firebase Bearer token (user derived from `verifyAuthToken`, not a client-supplied `userId`).
```json
{
  "type": "web_app" | "external_ip",
  "targetUrl": "https://example.com",
  "userRoles": "Admin\nUser\nGuest",
  "endpoints": "/api/users\n/api/posts",
  "additionalContext": "Backend uses PostgreSQL..."
}
```
Response: `{ "pentestId": "pentest-id", "message": "Pentest started successfully" }`

### Get Pentest Status — `GET /api/pentests/[id]`
Response: `{ "pentest": { "id": "...", "status": "completed", "results": {...}, "vulnerabilities": [...] } }`

### Update Pentest Results — `PATCH /api/pentests`
Engine callback (secret-gated) — see Backend / Pentest Engine.

### Checkout — `POST /api/checkout`
```json
{ "priceId": "price_xxx", "userId": "user123", "email": "user@example.com",
  "productType": "one-time" | "subscription" }
```
Creates a Stripe Checkout session (one-time or subscription) with success/cancel redirects and
user/product metadata.

### Pentest Requests — `/api/pentest-requests` (manual pentests)
`POST`:
```json
{ "userId": "user123", "userEmail": "user@example.com",
  "tier": "manual_basic" | "manual_advanced", "contactName": "John Doe",
  "companyName": "Acme Corp", "targetDomains": ["example.com"],
  "scopeDescription": "Test main web app..." }
```
`GET /api/pentest-requests?userId=user123&status=pending`
`PATCH`:
```json
{ "requestId": "req123", "updates": { "status": "approved" }, "adminUserId": "admin123" }
```

### Admin access
Admin users are gated on `isAdmin`. (historical) The original heuristic identified admins by email
containing `admin` or `hackeranalytics0`; role-based access now uses `role` on the user/org doc.
The `/admin` console is platform-only (Zack); distributor/reseller control-plane surfaces are
role-scoped in-app (`/app/clients`).

---

## `/api/v1` Provisioning API (proposed)

_Status: **draft / proposed** — not yet implemented. Last updated 2026-07-13._

Programmatic API for partners (suppliers, resellers/MSPs) to provision org trees, mint keys, launch
pentests, and pull results. Backs the Compulab consolidated-buying program. Design rationale in
`docs/product-model.md` (Compulab partnership + roadmap sections) and `HANDOFF.md`.

> (historical) This spec was authored under the **5-SKU model** (`ai_pentest | external | internal |
> manual`, per-SKU quota buckets). The per-IP pivot collapses metering to a **single `ip` meter**;
> multi-SKU fields below (`scanType`, per-SKU `purchased`/`policy`/`totals`) become one IP bucket.
> Endpoint shapes and the org-tree/quota/webhook design still hold. See `docs/product-model.md`.

### Conventions
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
  - `401` bad/missing key · `403` out of scope · `402` quota exhausted (hard) · `409`
    idempotency/state conflict · `422` validation · `429` rate/concurrency limit.

### Org tree
Fixed 3-level tree: `supplier → reseller → client` (no sub-resellers). A supplier selling direct
uses a "house" reseller node so the tree is always exactly 3 deep. Every node carries a materialized
`path[]` (supplier→self).

**`POST /orgs`** — create a node anywhere in the tree.
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

**`GET /orgs/{id}` · `GET /orgs/{id}/children` · `GET /orgs?subtreeOf={id}`** — fetch a node, its
direct children, or the whole subtree.

**`PATCH /orgs/{id}`** — update `name`, `status` (`active|suspended`), `tierId`, `branding`, `billing`.

### Quota & allocations
Pool lives on the supplier (tree root), denominated in **per-SKU buckets** (`ai_pentest`, `external`,
`internal`, `manual`, …). (historical: per the per-IP pivot this collapses to a single `ip` bucket.)
Draw-down is shared across the subtree; child **caps** are optional ceilings.

**`PUT /orgs/{id}/quota`** _(pool-holding node)_
```jsonc
{ "purchased": { "ai_pentest": 200, "external": 50 },
  "replenish": "monthly",            // monthly | one_time
  "policy": { "ai_pentest": "soft", "external": "hard" } }  // soft = allow overage & bill it
```

**`PUT /orgs/{id}/caps`** _(child node)_
```jsonc
{ "caps": { "ai_pentest": 40 }, "policy": { "ai_pentest": "hard" } }
```

**`GET /orgs/{id}/quota`** — current pool state for the subtree.
```jsonc
{ "purchased": { "ai_pentest": 200 }, "reserved": { "ai_pentest": 5 },
  "consumed": { "ai_pentest": 30 }, "available": { "ai_pentest": 165 } }
```

### API keys
**`POST /orgs/{id}/api-keys`** — mint a scoped key. Full secret returned **once**; only a SHA-256
hash + prefix are stored.
```jsonc
// request
{ "name": "Compulab provisioning", "scopes": ["orgs:write","pentests:write","usage:read"] }
// 201
{ "id": "key_123", "prefix": "mspp_live_a1b2", "secret": "mspp_live_a1b2c3…", "orgId": "org_supplier" }
```
**`GET /orgs/{id}/api-keys` · `DELETE /api-keys/{keyId}`** — list (prefix + metadata only) / revoke.

### Pentests
**`POST /pentests`** — launch. Runs walk-up entitlement (tier capability + pool/cap check), reserves
units, enqueues the job.
```jsonc
// request
{ "clientId": "org_client_x",
  "scanType": "ai_pentest",          // maps to a SKU (historical: single per-IP product now)
  "targets": ["example.com", "10.0.0.0/24"],
  "webhookUrl": "https://compulab.example/hooks/mspp",  // optional per-launch override
  "metadata": { "poNumber": "CL-4471" } }
// 202 (queued)
{ "id": "pt_789", "status": "queued", "clientId": "org_client_x",
  "sku": "ai_pentest", "units": 2, "reserved": true, "createdAt": "2026-07-13T…Z" }
// 402 if hard-blocked
{ "error": { "code": "quota_exhausted", "message": "ai_pentest pool exhausted", "details": { "available": 0 } } }
```
**`GET /pentests?clientId=&resellerId=&status=` · `GET /pentests/{id}`** — list (scoped to the key's
subtree) / fetch status + findings summary.
**`GET /pentests/{id}/report?format=pdf|json`** — branded report artifact (white-label cover from
the org's resolved branding).
**`POST /pentests/{id}/result`** _(internal — scanner runner → API)_ — HMAC-verified callback
(`X-MSPP-Signature`). Finalizes: moves `reserved → consumed`, writes findings, fires the outbound
`pentest.completed` webhook.

### Usage & reporting
**`GET /orgs/{id}/usage?from=&to=&groupBy=sku|child|day`** — rollup over the subtree from the
append-only usage ledger — the same data Compulab is invoiced on.
```jsonc
{ "from": "2026-07-01", "to": "2026-07-31",
  "totals": { "ai_pentest": 30, "external": 12 },
  "overage": { "ai_pentest": 0 },
  "byChild": [ { "orgId": "org_acme", "ai_pentest": 18 } ] }
```

### Outbound webhooks
Partner registers endpoints; MSPP POSTs signed events (`X-MSPP-Signature`, HMAC-SHA256, with retry).

**`POST /orgs/{id}/webhooks`**
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

### Endpoint summary
| Method & path | Purpose |
|---|---|
| `POST /orgs` · `GET /orgs/{id}` · `GET /orgs/{id}/children` · `PATCH /orgs/{id}` | Manage org tree |
| `PUT /orgs/{id}/quota` · `PUT /orgs/{id}/caps` · `GET /orgs/{id}/quota` | Pools & caps |
| `POST /orgs/{id}/api-keys` · `GET …` · `DELETE /api-keys/{id}` | Scoped keys |
| `POST /pentests` · `GET /pentests` · `GET /pentests/{id}` · `GET /pentests/{id}/report` | Launch & results |
| `POST /pentests/{id}/result` | Runner callback (internal, HMAC) |
| `GET /orgs/{id}/usage` | Consumption reporting / billing source |
| `POST /orgs/{id}/webhooks` | Outbound event subscriptions |

### Open items (pending Luis)
- Allocation model default (shared draw-down + caps vs strict envelope).
- Hard/soft defaults per SKU. · Pool replenishment (monthly commit vs one-time, rollover?).
- Whether client-level keys are exposed or reseller-scoped only.

---

## Build status (historical — Feb 2026 PTaaS snapshot)

> (historical) Snapshot from the multi-SKU PTaaS build (Feb 12–28, 2026). Superseded by the per-IP
> pivot for product/pricing, but the shipped app surfaces (pricing page, request form, results
> portal, admin requests, checkout + pentest-requests APIs, Firestore rules, dashboard nav) remain
> the codebase baseline. Dropped here: the four-tier pricing table and duplicated feature/user-flow
> prose (now covered by `docs/product-model.md`).

**Shipped:** Stripe products & checkout (4 tiers, live mode); pricing page; manual pentest request
form (`/app/request-pentest`); My Results portal (`/app/my-results`); admin requests dashboard
(`/admin/requests`) with status workflow (pending → reviewing → scoping → approved → in_progress →
completed / rejected); `/api/checkout` + `/api/pentest-requests` endpoints; `pentestRequest.ts`
types; `pentestRequests` collection; Firestore rules (user-scoped, admin-only status writes,
immutable activity logs); dashboard + navbar updates; PTaaS hero/branding.

**Remaining manual steps (from that era):** enable Firebase Email/Password auth; create + base64 the
service account for `FIREBASE_SERVICE_ACCOUNT_KEY`; set up the Stripe webhook; push env vars to
Vercel; implement real role-based access (was email-based); (optional) deploy GCP scanner functions.

---

## Support & License

- **License:** MIT (see LICENSE).
- **Support:** hackeranalytics0@gmail.com · GitHub: https://github.com/zackelmet/msp

Last updated: 2026-07-15
</content>
</invoke>
