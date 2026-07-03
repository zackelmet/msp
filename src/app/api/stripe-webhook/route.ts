import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

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

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Checkout session completed:', session.id);

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
    // line_items are NOT included in webhook events by default - retrieve them
    let quantity = 1;
    try {
      const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items'],
      });
      quantity = expandedSession.line_items?.data?.[0]?.quantity || 1;
    } catch (e) {
      console.warn('Could not retrieve line_items, defaulting to quantity 1:', e);
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
