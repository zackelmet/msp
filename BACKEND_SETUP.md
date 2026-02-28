# Backend Setup: Anthropic Claude Pentest Agent

## Quick Start Summary

**Webapp → Backend Communication:**
- Webapp sends webhook to `POST /execute-pentest` when pentest is created
- Backend confirms receipt (200 OK), processes asynchronously
- Backend calls `PATCH /api/pentests` with results when complete

**Key Endpoints:**
1. **Backend receives job**: `POST /execute-pentest` (from webapp)
2. **Backend returns results**: `PATCH https://msppentesting.vercel.app/api/pentests` (to webapp)

**Authentication**: Both endpoints require `X-Webhook-Secret` header

**Webhook Secret (CRITICAL):**
```
GCP_WEBHOOK_SECRET=9e33b83b7ae6aeda980df8152927aba5551ecd5e718b6bd475bde3902ad6ecd3
```
⚠️ **Use this exact value in your backend environment variables to authenticate requests**

**After Backend Deployment:**
Update Vercel env var `BACKEND_WEBHOOK_URL` with your Cloud Run URL:
```bash
vercel env rm BACKEND_WEBHOOK_URL production
vercel env add BACKEND_WEBHOOK_URL production
# Value: https://your-actual-backend.run.app/execute-pentest
```

---

## Overview
This document outlines the specifications for integrating Anthropic Claude agentic systems to perform autonomous penetration testing for MSP Pentesting platform.

## Architecture (Webhook-Based)

### Pentest Flow
1. **User submits pentest** via `/api/pentests` (POST)
2. **Credit is deducted** and pentest document created with `status: 'pending'`
3. **Webapp sends webhook** to backend with pentest job details
4. **Backend receives webhook**, confirms receipt, updates status to `in_progress`
5. **Claude agent performs** autonomous pentesting with tool access
6. **Backend sends results** back to webapp via PATCH `/api/pentests` with completed report
7. **User views results** at `/app/pentests/[id]` (auto-refreshes)

### Communication Flow

```
┌─────────────┐                    ┌──────────────┐
│   Webapp    │                    │   Backend    │
│  (Next.js)  │                    │  (Cloud Run) │
└─────────────┘                    └──────────────┘
      │                                    │
      │  POST /api/pentests                │
      │  (Create pentest)                  │
      │────────────────────────────────────▶
      │                                    │
      │  Webhook: POST /execute-pentest    │
      │  {pentestId, type, targetUrl...}   │
      │────────────────────────────────────▶
      │                                    │
      │  200 OK (Receipt confirmed)        │
      │◀────────────────────────────────────
      │                                    │
      │                                    │  Claude Agent
      │                                    │  runs pentest
      │                                    │  with tools
      │                                    │
      │  PATCH /api/pentests               │
      │  {results, vulnerabilities}        │
      │◀────────────────────────────────────
      │                                    │
      │  200 OK                            │
      │────────────────────────────────────▶
```

---

## Firestore Schema

### Collection: `pentests`

```typescript
interface PentestDocument {
  id: string;
  userId: string;
  type: 'web_app' | 'external_ip';
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

## Backend Implementation

### 1. Webhook Receiver Endpoint

**Endpoint**: `POST /execute-pentest`

**Authentication**: Verify `X-Webhook-Secret` header matches `GCP_WEBHOOK_SECRET`

**Request Body**:
```json
{
  "pentestId": "abc123",
  "userId": "user_xyz",
  "type": "web_app" | "external_ip",
  "targetUrl": "https://example.com",
  "userRoles": "admin\\nuser\\nguest",  // optional for web_app
  "endpoints": "/api/users\\n/api/auth\\n...",  // optional for web_app
  "additionalContext": "..."  // optional
}
```

**Response** (Immediate):
```json
{
  "success": true,
  "message": "Pentest job received",
  "pentestId": "abc123"
}
```

**Processing Steps**:
1. Verify webhook secret
2. Validate pentest parameters
3. Update Firestore pentest status to `in_progress` (optional - can do this via webapp API)
4. Queue Claude agent job (async)
5. Return 200 OK immediately

### 2. Claude Agent Execution (Async)

**Job Queue**: Use Cloud Tasks, Pub/Sub, or background workers

**Processing Steps**:
1. Call Claude agent with pentest parameters
2. Stream results as they come in
3. Parse vulnerabilities from Claude's JSON output
4. On completion, call webapp PATCH endpoint

### 3. Results Callback to Webapp

**Endpoint**: `PATCH https://msppentesting.vercel.app/api/pentests`

**Authentication**: Include `X-Webhook-Secret` header

**Request Body**:
```json
{
  "pentestId": "abc123",
  "status": "completed" | "failed",
  "results": {
    "report": "# Full markdown report...",
    "executiveSummary": "...",
    "findings": 5
  },
  "vulnerabilities": [
    {
      "title": "SQL Injection in /api/users",
      "severity": "critical",
      "description": "...",
      "cve": "CVE-2024-1234",
      "cvss": 9.8,
      "remediation": "...",
      "affectedEndpoint": "/api/users?id=1"
    }
  ],
  "error": "Error message if failed"  // optional
}
```

**Response**:
```json
{
  "success": true,
  "message": "Pentest results updated successfully"
}
```

---

## Claude Agent Integration

### Agent Configuration

**Model**: `claude-sonnet-4-5` or `claude-opus-4`

**System Prompt Template**:
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
    {
      "title": "...",
      "severity": "critical|high|medium|low|info",
      "description": "...",
      "cve": "CVE-XXXX-XXXXX",
      "cvss": 7.5,
      "remediation": "...",
      "affectedEndpoint": "..."
    }
  ]
}
```

### Tool Access for Claude

Claude agent should have access to:

#### Web Application Testing:
- HTTP client for making requests
- Browser automation (Playwright/Puppeteer) for authenticated flows
- Common security testing tools:
  - `sqlmap` for SQL injection
  - `nuclei` for vulnerability scanning
  - `ffuf` for fuzzing
  - `jwt_tool` for JWT analysis

#### External IP Testing:
- `nmap` for port scanning
- `masscan` for fast scanning
- `nikto` for web server scanning
- `testssl.sh` for SSL/TLS testing
- Service-specific tools (ssh-audit, etc.)

### Error Handling

If Claude agent encounters errors:
```typescript
// Update pentest document
{
  status: 'failed',
  results: {
    report: 'Pentest failed: [error message]',
  },
  completedAt: FieldValue.serverTimestamp(),
}
```

---

## API Endpoints (Already Implemented)

### Create Pentest
**POST** `/api/pentests`

Request:
```json
{
  "type": "web_app" | "external_ip",
  "targetUrl": "https://example.com",
  "userRoles": "Admin\nUser\nGuest",
  "endpoints": "/api/users\n/api/posts",
  "additionalContext": "Backend uses PostgreSQL...",
  "userId": "firebase-uid"
}
```

Response:
```json
{
  "pentestId": "pentest-id",
  "message": "Pentest started successfully"
}
```

### Get Pentest Status
**GET** `/api/pentests/[id]?userId=uid`

Response:
```json
{
  "pentest": {
    "id": "...",
    "status": "completed",
    "results": { ... },
    "vulnerabilities": [ ... ]
  }
}
```

---

## Environment Variables Required

### Backend (Cloud Run / Cloud Functions)
```bash
# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...

# Webhook Authentication (CRITICAL - must match webapp)
GCP_WEBHOOK_SECRET=9e33b83b7ae6aeda980df8152927aba5551ecd5e718b6bd475bde3902ad6ecd3

# Webapp Callback URL
WEBAPP_API_URL=https://msppentesting.vercel.app/api/pentests

# GCP (if using Cloud Functions/Run)
GCP_PROJECT_ID=msp-pentesting
GCP_REGION=us-east1

# Firestore (Optional - only if backend writes directly to Firestore)
# Note: Backend sends results via webhook to webapp instead
FIREBASE_ADMIN_PROJECT_ID=msp-pentesting
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY=...
```

### Webapp (Already Configured in Vercel)
```bash
# Backend webhook endpoint (update after deploying backend)
BACKEND_WEBHOOK_URL=https://your-backend.run.app/execute-pentest

# Shared webhook secret (already set)
GCP_WEBHOOK_SECRET=9e33b83b7ae6aeda980df8152927aba5551ecd5e718b6bd475bde3902ad6ecd3

# Stripe webhook secret (already set)
STRIPE_WEBHOOK_SECRET=whsec_eUo8mKBZqO31Rml5Oihq8mtLXb0EUMGB
```

---

## Security Considerations

### 1. Rate Limiting
- Max 5 concurrent pentests per user
- Max 20 pentests per user per day
- Implement queue system to prevent resource exhaustion

### 2. Target Validation
- Verify target is internet-accessible
- Check against blacklist (gov sites, .mil domains, etc.)
- Require user to verify ownership (DNS TXT record or file upload)

### 3. Legal Compliance
- Log all pentest activities
- Include disclaimer in user agreement
- Store consent records in Firestore

### 4. Resource Limits
- Max 30 minutes per pentest execution
- Kill agent if timeout exceeded
- Implement circuit breaker for failing targets

---

## Monitoring & Logging

### Metrics to Track
- Pentests created per day
- Average completion time
- Success/failure rate
- Claude API costs per pentest
- Vulnerabilities found (by severity)

### Logging Requirements
- Log all Claude agent requests/responses
- Log pentest start/end times
- Log any errors or timeouts
- Store in Cloud Logging or structured Firestore collection

---

## Cost Estimation

### Per Pentest:
- **External IP**: ~50K-100K tokens = $1.50-$3.00
- **Web App**: ~200K-500K tokens = $6.00-$15.00

### Pricing Model:
- External IP: $199 (66-132x markup)
- Web App: $500 (33-83x markup)

---

## Implementation Checklist

- [ ] Set up GCP Cloud Function/Run for queue processor
- [ ] Configure Anthropic API client
- [ ] Implement system prompt templates
- [ ] Add tool access for security testing tools
- [ ] Build result parser (JSON → Firestore)
- [ ] Add error handling and retries
- [ ] Implement rate limiting
- [ ] Set up monitoring and alerts
- [ ] Test with sample targets
- [ ] Deploy to production

---

## Sample Claude Agent Code Structure

```python
import anthropic
from google.cloud import firestore

db = firestore.Client()
client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

def process_pentest(pentest_id: str):
    # Get pentest document
    pentest_ref = db.collection('pentests').document(pentest_id)
    pentest = pentest_ref.get().to_dict()
    
    # Update status
    pentest_ref.update({'status': 'in_progress'})
    
    try:
        # Build system prompt
        system_prompt = build_system_prompt(pentest)
        
        # Call Claude with tools
        response = client.messages.create(
            model="claude-sonnet-4-5-20250514",
            max_tokens=8192,
            system=system_prompt,
            messages=[
                {"role": "user", "content": f"Perform pentest on {pentest['targetUrl']}"}
            ],
            tools=[
                # Define tools here
            ]
        )
        
        # Parse results
        results = parse_claude_response(response)
        
        # Update Firestore
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

def build_system_prompt(pentest: dict) -> str:
    # Build based on template above
    pass

def parse_claude_response(response) -> dict:
    # Extract JSON from response
    pass
```

---

## Deployment Checklist for Backend Engineer

### Phase 1: Setup
- [ ] Clone backend repo and review this spec
- [ ] Get Anthropic API key (ask for budget/account access)
- [ ] Set up local development environment
- [ ] Configure environment variables:
  - `GCP_WEBHOOK_SECRET=9e33b83b7ae6aeda980df8152927aba5551ecd5e718b6bd475bde3902ad6ecd3`
  - `WEBAPP_API_URL=https://msppentesting.vercel.app/api/pentests`
  - `ANTHROPIC_API_KEY=sk-ant-...`

### Phase 2: Implementation
- [ ] Build `POST /execute-pentest` webhook receiver endpoint
- [ ] Verify `X-Webhook-Secret` header matches `GCP_WEBHOOK_SECRET`
- [ ] Implement Claude agent with system prompts (see templates above)
- [ ] Add tool access: nmap, sqlmap, nuclei, testssl.sh
- [ ] Parse Claude JSON output for vulnerabilities
- [ ] Build callback to webapp: `PATCH https://msppentesting.vercel.app/api/pentests`

### Phase 3: Testing
- [ ] Test webhook receipt with curl:
```bash
curl -X POST https://your-backend.run.app/execute-pentest \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: 9e33b83b7ae6aeda980df8152927aba5551ecd5e718b6bd475bde3902ad6ecd3" \
  -d '{"pentestId":"test123","type":"web_app","targetUrl":"https://test.example.com"}'
```
- [ ] Test Claude integration with sandbox target
- [ ] Verify results callback to webapp updates Firestore correctly
- [ ] Test error handling (invalid targets, timeouts, tool failures)

### Phase 4: Deployment
- [ ] Deploy to Cloud Run (preferred) or Cloud Functions
- [ ] Note your backend URL (e.g., `https://msp-pentest-backend-xyz.run.app`)
- [ ] Update Vercel environment variable:
```bash
vercel env rm BACKEND_WEBHOOK_URL production
vercel env add BACKEND_WEBHOOK_URL production
# Value: https://your-actual-backend.run.app/execute-pentest
```
- [ ] Test end-to-end: Create pentest in webapp → View results
- [ ] Set up monitoring and alerts
- [ ] Configure rate limiting and timeouts

---

## Next Steps for Backend Engineer

1. **Review this spec** and confirm approach
2. **Set up development environment** with Anthropic API access
3. **Build webhook receiver** endpoint at `POST /execute-pentest`
4. **Implement Claude integration** with tool access
5. **Test with sandbox targets** (test.msppentesting.com)
6. **Deploy to Cloud Run** and share URL
7. **Load test** with 10-20 concurrent pentests
8. **Production deployment** with monitoring

---

## Questions for Backend Engineer

1. Do you prefer Cloud Functions, Cloud Run, or Kubernetes for the worker?
2. Should we implement a dead letter queue for failed pentests?
3. What monitoring tool do you prefer (Cloud Monitoring, Datadog, etc.)?
4. Do you need access to a staging Firestore database?
5. Should we implement email notifications when pentests complete (in addition to in-app)?

---

**Document Version**: 1.0  
**Last Updated**: February 28, 2026  
**Owner**: MSP Pentesting Platform Team
