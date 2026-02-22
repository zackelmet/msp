# MSP Pentesting - PTaaS Platform

A comprehensive Penetration Testing as a Service (PTaaS) platform built with Next.js, Firebase, and Stripe.

## 🚀 Features

### For Customers
- **AI-Driven Pentests**: Automated vulnerability scanning using Nmap, OpenVAS, and OWASP ZAP
- **Manual Pentesting**: Request professional manual penetration tests from certified experts
- **Results Portal**: View all findings, engagements, and pentest requests in one place
- **Multiple Service Tiers**:
  - Single AI Pentest: $199
  - Unlimited AI Pentests: $499/month
  - Basic Manual Pentest: $2,000
  - Advanced Manual Pentest: $5,000

### For Admins
- **Request Management**: Review and manage incoming manual pentest requests
- **Engagement Tracking**: Track ongoing pentesting engagements
- **Activity Logs**: Monitor all system activity
- **Findings Management**: Create and manage vulnerability findings

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── activity/          # Activity logging endpoints
│   │   ├── ai-pentest/        # AI pentest orchestration
│   │   ├── checkout/          # Stripe checkout sessions
│   │   ├── engagements/       # Client engagement management
│   │   ├── findings/          # Vulnerability findings CRUD
│   │   ├── manual-tests/      # Manual test logging
│   │   └── pentest-requests/  # Manual pentest request handling
│   ├── app/
│   │   ├── activity/          # Activity log viewer
│   │   ├── ai-pentest/        # AI pentest launcher
│   │   ├── findings/          # Findings dashboard
│   │   ├── manual-tests/      # Manual test tracker
│   │   ├── my-results/        # Customer results portal
│   │   └── request-pentest/   # Manual pentest request form
│   ├── admin/
│   │   └── requests/          # Admin request management
│   └── pricing/               # Pricing & checkout page
├── components/
│   ├── dashboard/             # Dashboard layout & navigation
│   └── nav/                   # Navbar components
├── lib/
│   ├── types/
│   │   ├── pentest.ts         # Pentest type definitions
│   │   └── pentestRequest.ts  # Request type definitions
│   ├── hooks/                 # React hooks for data fetching
│   └── firebase/              # Firebase configuration
└── scripts/
    └── setupStripeProducts.js # Stripe product setup script
```

## 🛠️ Setup Instructions

### 1. Firebase Setup

1. **Create Firebase Project**:
   ```bash
   firebase projects:create msp-pentesting
   firebase use msp-pentesting
   ```

2. **Initialize Services**:
   ```bash
   firebase init firestore
   firebase init storage
   ```

3. **Enable Authentication** (manual):
   - Go to: https://console.firebase.google.com/project/msp-pentesting/authentication
   - Enable Email/Password provider

4. **Create Service Account**:
   - Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=msp-pentesting
   - Create service account → Download JSON
   - Base64 encode: `base64 -w 0 serviceaccount.json`
   - Add to `.env.local` as `FIREBASE_SERVICE_ACCOUNT_KEY`

5. **Deploy Firestore Rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

### 2. Stripe Setup

1. **Configure Environment**:
   - Add Stripe keys to `.env.local`:
     ```
     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
     STRIPE_SECRET_KEY=sk_live_...
     ```

2. **Create Products & Prices**:
   ```bash
   npm install dotenv
   node scripts/setupStripeProducts.js
   ```
   This creates:
   - AI Pentest - Single ($199)
   - AI Pentest - Monthly ($499/month)
   - Manual Pentest - Basic ($2,000)
   - Manual Pentest - Advanced ($5,000)

3. **Update Environment Variables**:
   Copy the price IDs output by the script to `.env.local`:
   ```
   NEXT_PUBLIC_STRIPE_PRICE_AI_SINGLE=price_...
   NEXT_PUBLIC_STRIPE_PRICE_AI_MONTHLY=price_...
   NEXT_PUBLIC_STRIPE_PRICE_MANUAL_BASIC=price_...
   NEXT_PUBLIC_STRIPE_PRICE_MANUAL_ADVANCED=price_...
   ```

4. **Set Up Webhook** (for production):
   - Create webhook endpoint: `/api/webhooks/stripe`
   - Add webhook secret to `.env.local` as `STRIPE_WEBHOOK_SECRET`

### 3. Vercel Deployment

1. **Link Project**:
   ```bash
   vercel link
   ```

2. **Add Environment Variables**:
   ```bash
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
   vercel env add NEXT_PUBLIC_STRIPE_PRICE_AI_SINGLE
   vercel env add NEXT_PUBLIC_STRIPE_PRICE_AI_MONTHLY
   vercel env add NEXT_PUBLIC_STRIPE_PRICE_MANUAL_BASIC
   vercel env add NEXT_PUBLIC_STRIPE_PRICE_MANUAL_ADVANCED
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

### 4. GCP Scanner Functions (Optional)

Configure the scanner function URLs in `.env.local`:
```
GCP_NMAP_FUNCTION_URL=https://...
GCP_OPENVAS_API_URL=https://...
GCP_ZAP_API_URL=https://...
GCP_WEBHOOK_SECRET=your-secret
```

See individual setup docs:
- [Nmap Scanner](gcp/functions/nmap-scanner/)
- [OpenVAS Scanner](gcp/functions/openvas-scanner/)
- [ZAP Scanner](gcp/functions/zap-scanner/)

## 🔐 Environment Variables

Create `.env.local` with the following:

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

# Stripe Price IDs
NEXT_PUBLIC_STRIPE_PRICE_AI_SINGLE=
NEXT_PUBLIC_STRIPE_PRICE_AI_MONTHLY=
NEXT_PUBLIC_STRIPE_PRICE_MANUAL_BASIC=
NEXT_PUBLIC_STRIPE_PRICE_MANUAL_ADVANCED=

# GCP Scanner Functions
GCP_NMAP_FUNCTION_URL=
GCP_OPENVAS_API_URL=
GCP_ZAP_API_URL=
GCP_WEBHOOK_SECRET=

# Application
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## 📊 Firestore Collections

### Core Collections
- **users**: User profiles and roles
- **scans**: Scan history and results
- **targets**: Target assets for scanning
- **activityLogs**: System activity tracking
- **manualTests**: Manual pentest test cases
- **findings**: Vulnerability findings
- **engagements**: Client engagement tracking
- **aiPentestRuns**: AI pentest execution tracking
- **pentestRequests**: Manual pentest requests

### Security Rules
All collections enforce user-based access control:
- Users can only read/write their own data
- Admins have full access
- Activity logs are immutable (create-only)

## 🎯 User Flows

### AI Pentest Purchase Flow
1. User views pricing page (`/pricing`)
2. Clicks "Purchase Scan" or "Subscribe Now"
3. Redirected to Stripe Checkout
4. After payment, redirected to dashboard
5. Can launch AI pentests from `/app/ai-pentest`
6. View results in `/app/findings` and `/app/my-results`

### Manual Pentest Request Flow
1. User views pricing page and clicks "Request Service"
2. Fills out detailed request form (`/app/request-pentest`)
3. Request submitted with status "pending"
4. Admin reviews request in `/admin/requests`
5. Admin updates status: reviewing → scoping → approved
6. Admin creates engagement and assigns team
7. Customer views progress in `/app/my-results`
8. Findings published to customer portal

## 🔧 Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📝 Next Steps

### Required Manual Steps
1. ✅ Enable Firebase Authentication in console
2. ⏳ Create Firebase service account and add to `.env.local`
3. ⏳ Set up Stripe webhook endpoint
4. ⏳ Push environment variables to Vercel
5. ⏳ Deploy GCP scanner functions
6. ⏳ Update production URLs in `.env.local`

### Optional Enhancements
- [ ] Add email notifications for request updates
- [ ] Implement PDF report generation
- [ ] Add team collaboration features
- [ ] Create detailed analytics dashboard
- [ ] Implement compliance reporting (PCI-DSS, SOC2)
- [ ] Add integration with Jira/ticketing systems
- [ ] Build mobile app for iOS/Android

## 📚 API Documentation

### Checkout API
**POST** `/api/checkout`
```json
{
  "priceId": "price_xxx",
  "userId": "user123",
  "email": "user@example.com",
  "productType": "one-time" | "subscription"
}
```

### Pentest Request API
**POST** `/api/pentest-requests`
```json
{
  "userId": "user123",
  "userEmail": "user@example.com",
  "tier": "manual_basic" | "manual_advanced",
  "contactName": "John Doe",
  "companyName": "Acme Corp",
  "targetDomains": ["example.com"],
  "scopeDescription": "Test main web app..."
}
```

**GET** `/api/pentest-requests?userId=user123&status=pending`

**PATCH** `/api/pentest-requests`
```json
{
  "requestId": "req123",
  "updates": { "status": "approved" },
  "adminUserId": "admin123"
}
```

## 🔒 Admin Access

Admin users are identified by:
- Email containing "admin"
- Email containing "hackeranalytics0"

To add admin role-based access:
1. Add `role` field to user document in Firestore
2. Update security rules to check role
3. Update admin check in components

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Support

For issues or questions:
- Email: hackeranalytics0@gmail.com
- GitHub: https://github.com/zackelmet/msp
