# MSP Pentesting Backend

AI-powered penetration testing backend using Anthropic Claude Sonnet 4.

## Architecture

Single Cloud Run service that:
1. Receives webhook from webapp at `POST /execute-pentest`
2. Validates webhook secret
3. Returns 200 OK immediately
4. Spawns background thread to execute pentest
5. Calls Claude API for analysis
6. Generates branded PDF report
7. Uploads to Cloud Storage
8. Sends results back to webapp via `PATCH /api/pentests`

## Setup

### Prerequisites
- GCP account with billing enabled
- Anthropic API key
- Google Cloud SDK installed

### Deployment

1. **Set environment variables:**
```bash
export ANTHROPIC_API_KEY="your-api-key-here"
export GCP_PROJECT_ID="msp-ai-pentester"
```

2. **Deploy to Cloud Run:**
```bash
gcloud run deploy msp-pentest-backend \
  --source . \
  --region us-east1 \
  --allow-unauthenticated \
  --set-env-vars="GCP_WEBHOOK_SECRET=9e33b83b7ae6aeda980df8152927aba5551ecd5e718b6bd475bde3902ad6ecd3" \
  --set-env-vars="ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" \
  --set-env-vars="WEBAPP_API_URL=https://msppentesting.vercel.app/api/pentests" \
  --set-env-vars="GCS_BUCKET_NAME=msp-pentest-reports" \
  --set-env-vars="GCP_PROJECT_ID=msp-ai-pentester" \
  --timeout=3600 \
  --memory=2Gi \
  --cpu=2
```

3. **Update Vercel environment variable:**
After deployment, note your Cloud Run URL and update Vercel:
```bash
vercel env rm BACKEND_WEBHOOK_URL production
vercel env add BACKEND_WEBHOOK_URL production
# Value: https://your-service-url.run.app/execute-pentest
```

## Testing

```bash
curl -X POST https://your-service-url.run.app/execute-pentest \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: 9e33b83b7ae6aeda980df8152927aba5551ecd5e718b6bd475bde3902ad6ecd3" \
  -d '{
    "pentestId": "test123",
    "userId": "user_abc",
    "type": "web_app",
    "targetUrl": "https://test.example.com"
  }'
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `GCP_WEBHOOK_SECRET` | Shared secret with webapp (must match) |
| `WEBAPP_API_URL` | Webapp API endpoint for results callback |
| `GCS_BUCKET_NAME` | Cloud Storage bucket for PDF reports |
| `GCP_PROJECT_ID` | GCP project ID |
| `PORT` | Server port (default: 8080) |

## File Structure

```
backend/
├── main.py              # Flask app, webhook receiver
├── worker.py            # Claude agent + pentest execution
├── pdf_generator.py     # PDF creation with MSP branding
├── requirements.txt     # Python dependencies
├── Dockerfile           # Container definition
└── README.md           # This file
```

## Features

- ✅ Webhook-based architecture (no polling)
- ✅ Background thread processing
- ✅ Claude Sonnet 4 integration
- ✅ Branded PDF reports with MSP styling
- ✅ Cloud Storage for report hosting
- ✅ Automatic callback to webapp
- ✅ Error handling and retries

## Cost Estimation

- Cloud Run: ~$0.10-0.50 per pentest (depending on duration)
- Claude API: ~$3-10 per pentest (Sonnet 4)
- Cloud Storage: ~$0.02/GB/month
- Network egress: Minimal

**Est. total: $3-11 per pentest**
