# MSP Pentesting — Penetration Testing as a Service

AI-powered autonomous penetration testing platform powered by Anthropic Claude agentic systems. Next.js frontend with serverless backend. $199 per target (IP, domain, or URL).

## Quick Start (local)

1) Install deps: `npm install`
2) Copy `.env.example` to `.env.local` and fill Firebase/Stripe creds.
3) Run dev server: `npm run dev` → http://localhost:3000

## Deploying
- Frontend: Vercel (Next.js 14)
- Backend: Cloud Run / Cloud Functions for AI pentest orchestration
- Database: Firebase Firestore
- Storage: Firebase Storage for pentest results
- Payments: Stripe
- AI: Anthropic Claude agentic systems

## Security Notice
This platform is for authorized security testing only. Ensure you have permission before testing any target.

Last updated: February 28, 2026
