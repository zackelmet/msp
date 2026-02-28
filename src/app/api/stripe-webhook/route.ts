import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

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
  const pentestType = session.metadata?.pentestType; // 'web_app' or 'external_ip'

  if (!userId) {
    console.error('No userId in session metadata');
    return;
  }

  // If this is a pentest credit purchase
  if (pentestType) {
    const quantity = session.line_items?.data?.[0]?.quantity || 1;
    
    try {
      const userRef = adminDb.collection('users').doc(userId);
      
      // Add credits to user account
      await userRef.update({
        [`credits.${pentestType}`]: FieldValue.increment(quantity),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`Added ${quantity} ${pentestType} credit(s) to user ${userId}`);
    } catch (error) {
      console.error('Error adding credits:', error);
      
      // If user doesn't exist, create with credits
      try {
        await adminDb.collection('users').doc(userId).set({
          uid: userId,
          credits: {
            web_app: pentestType === 'web_app' ? quantity : 0,
            external_ip: pentestType === 'external_ip' ? quantity : 0,
          },
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
