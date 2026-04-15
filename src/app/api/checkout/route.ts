import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const MANUAL_PACKAGE_PRICE_FALLBACKS: Record<string, string> = {
  external_ip_1_50: "price_1TL6IfA2hEQYBBzSDjQwyr3R",
  external_ip_51_100: "price_1TL6IfA2hEQYBBzS7i18BsnG",
};

export async function POST(request: NextRequest) {
  try {
    const {
      priceId,
      manualPackageId,
      userId,
      email,
      productType,
      mode,
      quantity,
      metadata,
      successUrl,
      cancelUrl,
    } = await request.json();

    const manualPackagePriceMap: Record<string, string | undefined> = {
      external_ip_1_50:
        process.env.STRIPE_PRICE_EXTERNAL_IP_1_50 ||
        process.env.NEXT_PUBLIC_STRIPE_PRICE_EXTERNAL_IP_1_50 ||
        MANUAL_PACKAGE_PRICE_FALLBACKS.external_ip_1_50,
      external_ip_51_100:
        process.env.STRIPE_PRICE_EXTERNAL_IP_51_100 ||
        process.env.NEXT_PUBLIC_STRIPE_PRICE_EXTERNAL_IP_51_100 ||
        MANUAL_PACKAGE_PRICE_FALLBACKS.external_ip_51_100,
    };

    const resolvedPriceId =
      priceId ||
      (manualPackageId ? manualPackagePriceMap[manualPackageId] : undefined);

    const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;

    const resolveUrl = (rawUrl: string | undefined, fallbackPath: string) => {
      if (!rawUrl) return `${origin}${fallbackPath}`;
      if (rawUrl.startsWith("/")) return `${origin}${rawUrl}`;
      if (rawUrl.startsWith(origin)) return rawUrl;
      return `${origin}${fallbackPath}`;
    };

    const resolvedSuccessUrl = resolveUrl(
      successUrl,
      "/app/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}",
    );
    const resolvedCancelUrl = resolveUrl(
      cancelUrl,
      "/app/dashboard?canceled=true",
    );

    if (!resolvedPriceId) {
      return NextResponse.json(
        {
          error: "Missing required fields or package is not configured",
          details: { manualPackageId: manualPackageId || null },
        },
        { status: 400 },
      );
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: resolvedPriceId,
          quantity: quantity || 1,
        },
      ],
      mode:
        mode || (productType === "subscription" ? "subscription" : "payment"),
      success_url: resolvedSuccessUrl,
      cancel_url: resolvedCancelUrl,
      ...(email ? { customer_email: email } : {}),
      metadata: {
        userId: userId || "",
        productType: productType || "one-time",
        manualPackageId: manualPackageId || "",
        ...(metadata || {}),
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to create checkout session",
        type: error?.type || null,
        code: error?.code || null,
      },
      { status: 500 },
    );
  }
}
