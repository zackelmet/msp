# Backend Integration Specs: Anthropic Claude Pentest Agent

## Overview
This document outlines the specifications for integrating Anthropic Claude agentic systems to perform autonomous penetration testing for MSP Pentesting platform.

## Architecture

### Pentest Flow
1. User submits pentest via `/api/pentests` (POST)
2. Credit is deducted and pentest document created with `status: 'pending'`
3. Backend worker picks up pending pentests and triggers Claude agent
4. Claude agent performs autonomous pentesting
5. Results are written back to Firestore pentest document
6. User views results at `/app/pentests/[id]`

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

## Backend Worker Requirements

### 1. Pentest Queue Processor

**Trigger**: Cloud Function or Cloud Run job that polls Firestore every 30-60 seconds

**Query**:
```typescript
const pendingPentests = await db
  .collection('pentests')
  .where('status', '==', 'pending')
  .orderBy('createdAt', 'asc')
  .limit(5)
  .get();
```

**Processing Steps**:
1. Update status to `in_progress`
2. Call Claude agent with pentest parameters
3. Update status to `completed` or `failed`
4. Write results and vulnerabilities array

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

```bash
# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...

# GCP (if using Cloud Functions/Run)
GCP_PROJECT_ID=msp-pentesting
GCP_REGION=us-east1

# Firestore
FIREBASE_ADMIN_PROJECT_ID=msp-pentesting
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY=...
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

## Next Steps for Backend Engineer

1. **Review this spec** and confirm approach
2. **Set up development environment** with Anthropic API access
3. **Build queue processor** to poll pending pentests
4. **Implement Claude integration** with tool access
5. **Test with sandbox targets** (test.msppentesting.com)
6. **Deploy to staging** environment
7. **Load test** with 10-20 concurrent pentests
8. **Production deployment** with monitoring

---

## Questions for Backend Engineer

1. Do you prefer Cloud Functions, Cloud Run, or Kubernetes for the worker?
2. Should we implement a dead letter queue for failed pentests?
3. What monitoring tool do you prefer (Cloud Monitoring, Datadog, etc.)?
4. Do you need access to a staging Firestore database?
5. Should we implement webhooks to notify users when pentests complete?

---

**Document Version**: 1.0  
**Last Updated**: February 28, 2026  
**Owner**: MSP Pentesting Platform Team
