import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  sendEmail,
  opsEmail,
  manualOrderCustomerEmail,
  manualOrderOpsEmail,
} from '@/lib/email/send';

// Manual (expert-led) engagement packages sold via /pricing and /app/launch-pentest.
// A purchase here is fulfilled by a human, so the webhook records a paid ORDER
// in the admin Requests queue rather than granting self-serve credits.
const MANUAL_PACKAGES: Record<
  string,
  { tier: 'manual_basic' | 'manual_advanced'; label: string }
> = {
  external_ip_1_50: { tier: 'manual_basic', label: 'Manual Pentest — External IP (1–50)' },
  external_ip_51_100: { tier: 'manual_advanced', label: 'Manual Pentest — External IP (51–100)' },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Credit buckets the webhook is allowed to top up. Anything else (e.g. the
// manual pay-and-launch flow's metadata) is ignored so we never create junk
// credit fields on the user doc.
const VALID_CREDIT_TYPES = new Set(["web_app", "external_ip", "ai_pentest"]);

/**
 * Idempotency guard. Records the Stripe event id exactly once; returns true if
 * we've already processed this event (a Stripe retry) so the caller can skip.
 * A genuine write error is rethrown so the webhook returns 500 and Stripe retries.
 */
async function isDuplicateEvent(eventId: string): Promise<boolean> {
  const ref = adminDb.collection("stripeEvents").doc(eventId);
  try {
    await ref.create({ processedAt: FieldValue.serverTimestamp() });
    return false;
  } catch (err: any) {
    const code = err?.code;
    const msg = String(err?.message || "");
    if (code === 6 || code === "already-exists" || msg.includes("ALREADY_EXISTS")) {
      return true;
    }
    throw err;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        if (await isDuplicateEvent(event.id)) {
          console.log('Skipping already-processed event:', event.id);
          break;
        }
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case 'invoice.payment_failed': {
        if (await isDuplicateEvent(event.id)) break;
        const invoice = event.data.object as Stripe.Invoice;
        await setOrgSuspendedByCustomer(invoice.customer as string, true);
        break;
      }

      case 'invoice.paid': {
        if (await isDuplicateEvent(event.id)) break;
        const invoice = event.data.object as Stripe.Invoice;
        await setOrgSuspendedByCustomer(invoice.customer as string, false);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment succeeded:', paymentIntent.id);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment failed:', paymentIntent.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// The metered per-IP price a Tier-2 supplier subscription is created against when
// the buyer has no subscription yet.
const AI_PER_IP_PRICE_FALLBACK = 'price_1TtV2oA2hEQYBBzSJw5Dsyrs';

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Checkout session completed:', session.id);

  // Tier-2 billing activation for a consolidated buyer (supplier): a mode:setup
  // session that collected a card. Attach it + put the metered sub on
  // charge_automatically. Handled first — these carry no userId/credit metadata.
  if (session.metadata?.flow === 'org_billing_setup') {
    await handleOrgBillingSetup(session);
    return;
  }

  const userId = session.metadata?.userId;
  const pentestType = session.metadata?.pentestType; // 'web_app' | 'external_ip' | 'ai_pentest'

  if (!userId) {
    console.error('No userId in session metadata');
    return;
  }

  // Only grant credits for recognized buckets. Other flows (e.g. the manual
  // pay-and-launch checkout) carry a different metadata.pentestType and are
  // fulfilled elsewhere — grant nothing here rather than minting junk credits.
  if (pentestType && VALID_CREDIT_TYPES.has(pentestType)) {
    // Determine how many credits to grant. AI-pentest checkouts charge the
    // graduated TOTAL as one line item, so the credit count travels in
    // metadata.quantity. Fixed-price credit purchases use the line-item qty.
    let quantity = 1;
    if (pentestType === 'ai_pentest' && session.metadata?.quantity) {
      quantity = parseInt(session.metadata.quantity, 10) || 1;
    } else {
      // line_items are NOT included in webhook events by default - retrieve them
      try {
        const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items'],
        });
        quantity = expandedSession.line_items?.data?.[0]?.quantity || 1;
      } catch (e) {
        console.warn('Could not retrieve line_items, defaulting to quantity 1:', e);
      }
    }
    
    try {
      const userRef = adminDb.collection('users').doc(userId);
      
      // Add credits to user account and mark as paid
      await userRef.update({
        [`credits.${pentestType}`]: FieldValue.increment(quantity),
        currentPlan: 'paid',
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`Added ${quantity} ${pentestType} credit(s) to user ${userId}`);
    } catch (error) {
      console.error('Error adding credits:', error);
      
      // If user doesn't exist, create with credits (merge preserves any other
      // credit buckets already present on the doc).
      try {
        await adminDb.collection('users').doc(userId).set({
          uid: userId,
          credits: {
            [pentestType]: quantity,
          },
          currentPlan: 'paid',
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        
        console.log(`Created user ${userId} with ${quantity} ${pentestType} credit(s)`);
      } catch (createError) {
        console.error('Error creating user with credits:', createError);
      }
    }
  }
  
  // Manual (expert-led) package purchase → record a paid order for the team.
  const manualPackageId = session.metadata?.manualPackageId;
  if (manualPackageId && MANUAL_PACKAGES[manualPackageId]) {
    await handleManualOrder(session, userId, manualPackageId);
  }

  // Handle subscription-based purchases (legacy support)
  if (session.mode === 'subscription' && session.subscription) {
    try {
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      
      await adminDb.collection('users').doc(userId).update({
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        currentPlan: 'paid',
        currentPeriodStart: FieldValue.serverTimestamp(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`Updated subscription for user ${userId}`);
    } catch (error) {
      console.error('Error updating subscription:', error);
    }
  }
}

/**
 * Tier-2 activation: a supplier finished the card-collection Checkout. Set the card
 * as the customer + subscription default payment method and switch to (or create)
 * a charge_automatically metered subscription. Idempotent via the event guard.
 */
async function handleOrgBillingSetup(session: Stripe.Checkout.Session) {
  const orgId = session.metadata?.orgId;
  const customerId = session.customer as string | null;
  if (!orgId || !customerId) {
    console.error('org_billing_setup: missing orgId/customer', { orgId, customerId });
    return;
  }

  // The card lives on the SetupIntent the Checkout session created.
  const setupIntentId = session.setup_intent as string | null;
  if (!setupIntentId) {
    console.error('org_billing_setup: no setup_intent on session', session.id);
    return;
  }
  const si = await stripe.setupIntents.retrieve(setupIntentId);
  const paymentMethod = si.payment_method as string | null;
  if (!paymentMethod) {
    console.error('org_billing_setup: no payment_method on setup_intent', setupIntentId);
    return;
  }

  // Default the card for future invoices.
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethod },
  });

  const orgRef = adminDb.collection('orgs').doc(orgId);
  const org = (await orgRef.get()).data() || {};
  const billing = org.billing || {};

  let subscriptionId: string | undefined = billing.stripeSubscriptionId;
  let subscriptionItemId: string | undefined = billing.stripeSubscriptionItemId;

  if (subscriptionId) {
    // Existing subscription (e.g. Compulab's send_invoice sub) → flip it to
    // auto-charge against the new card.
    const sub = await stripe.subscriptions.update(subscriptionId, {
      default_payment_method: paymentMethod,
      collection_method: 'charge_automatically',
    });
    subscriptionItemId = sub.items.data[0]?.id ?? subscriptionItemId;
  } else {
    // No subscription yet → create the metered one on auto-charge.
    const priceId = billing.stripePriceId || AI_PER_IP_PRICE_FALLBACK;
    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      collection_method: 'charge_automatically',
      default_payment_method: paymentMethod,
      metadata: { orgId, sku: 'ai_pentest_per_ip' },
    });
    subscriptionId = sub.id;
    subscriptionItemId = sub.items.data[0]?.id;
    billing.stripePriceId = priceId;
  }

  await orgRef.set(
    {
      billing: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripeSubscriptionItemId: subscriptionItemId,
        stripePriceId: billing.stripePriceId || AI_PER_IP_PRICE_FALLBACK,
        paymentTier: 'auto',
        suspended: false,
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log(`Tier-2 activated for ${orgId}: sub ${subscriptionId}, item ${subscriptionItemId}`);
}

/**
 * Dunning: flip a supplier org's suspended flag from an invoice event. Resolves the
 * org by its stored Stripe customer id.
 */
async function setOrgSuspendedByCustomer(customerId: string, suspended: boolean) {
  if (!customerId) return;
  const snap = await adminDb
    .collection('orgs')
    .where('billing.stripeCustomerId', '==', customerId)
    .limit(1)
    .get();
  if (snap.empty) {
    console.warn(`invoice event: no org for customer ${customerId}`);
    return;
  }
  const doc = snap.docs[0];
  await doc.ref.set(
    { billing: { suspended }, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  console.log(`Org ${doc.id} billing.suspended = ${suspended} (customer ${customerId})`);
}

/**
 * Records a paid manual-engagement order in the `pentestRequests` collection so
 * it surfaces in the admin Requests queue, then notifies the customer + ops.
 * Idempotent: the doc id is derived from the Stripe session id.
 */
async function handleManualOrder(
  session: Stripe.Checkout.Session,
  userId: string,
  manualPackageId: string,
) {
  const pkg = MANUAL_PACKAGES[manualPackageId];
  const amountCents = session.amount_total || 0;

  // Prefer the checkout email, fall back to the user doc.
  let userEmail =
    session.customer_details?.email || session.customer_email || null;
  if (!userEmail) {
    try {
      const u = await adminDb.collection('users').doc(userId).get();
      userEmail = (u.data()?.email as string) || null;
    } catch {
      /* ignore */
    }
  }

  const requestId = `stripe_${session.id}`;

  try {
    // Deterministic id → a Stripe retry can't create a duplicate order.
    await adminDb.collection('pentestRequests').doc(requestId).set(
      {
        id: requestId,
        userId,
        userEmail: userEmail || '',
        tier: pkg.tier,
        status: 'pending',
        source: 'stripe_checkout',
        paymentStatus: 'paid',
        amountPaidCents: amountCents,
        stripeSessionId: session.id,
        packageId: manualPackageId,
        needsScoping: true,
        // Minimal display fields for the admin Requests table; scope is
        // captured later via the /app/request-pentest form.
        contactName: userEmail || '',
        companyName: '',
        targetDomains: [],
        targetApplications: [],
        scopeDescription: '',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`Recorded paid manual order ${requestId} (${pkg.label})`);
  } catch (err) {
    console.error('Error recording manual order:', err);
    return; // don't attempt emails if the order didn't persist
  }

  // Notifications (no-op unless RESEND_API_KEY/EMAIL_FROM are configured).
  if (userEmail) {
    const c = manualOrderCustomerEmail({ packageLabel: pkg.label, amountCents });
    await sendEmail({ to: userEmail, subject: c.subject, html: c.html });
  }
  const ops = opsEmail();
  if (ops) {
    const o = manualOrderOpsEmail({
      customerEmail: userEmail || 'unknown',
      packageLabel: pkg.label,
      amountCents,
      requestId,
    });
    await sendEmail({ to: ops, subject: o.subject, html: o.html });
  }
}
