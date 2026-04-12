import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(request: NextRequest) {
  try {
    const { priceId, manualPackageId, userId, email, productType, mode, quantity, metadata } = await request.json();

    const manualPackagePriceMap: Record<string, string | undefined> = {
      external_ip_1_50: process.env.NEXT_PUBLIC_STRIPE_PRICE_EXTERNAL_IP_1_50,
      external_ip_51_100: process.env.NEXT_PUBLIC_STRIPE_PRICE_EXTERNAL_IP_51_100,
    };

    const resolvedPriceId = priceId || (manualPackageId ? manualPackagePriceMap[manualPackageId] : undefined);

    if (!resolvedPriceId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields or package is not configured' },
        { status: 400 }
      );
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: resolvedPriceId,
          quantity: quantity || 1,
        },
      ],
      mode: mode || (productType === 'subscription' ? 'subscription' : 'payment'),
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/app/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/app/dashboard?canceled=true`,
      customer_email: email,
      metadata: {
        userId: userId || '',
        productType: productType || 'one-time',
        manualPackageId: manualPackageId || '',
        ...(metadata || {}),
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
