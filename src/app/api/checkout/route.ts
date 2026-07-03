import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { computeAiPentestPricing } from "@/lib/pricing/aiPentest";

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

    const isAiPentest = productType === "ai_pentest";

    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
    let sessionMetadata: Record<string, string>;
    let sessionMode: Stripe.Checkout.SessionCreateParams.Mode;

    if (isAiPentest) {
      // Volume-priced AI-pentest credits. Pricing is computed SERVER-SIDE from
      // the shared tier table so the client can never dictate the amount; we use
      // Stripe price_data (ad-hoc unit amount) because the flat-tier total is not
      // a fixed price × quantity.
      if (!userId) {
        return NextResponse.json(
          { error: "Sign in required to purchase credits" },
          { status: 401 },
        );
      }
      if (!Number.isFinite(quantity) || quantity < 1) {
        return NextResponse.json(
          { error: "Quantity must be at least 1" },
          { status: 400 },
        );
      }

      const pricing = computeAiPentestPricing(quantity);
      lineItems = [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `AI Pentest Credits — ${pricing.tierLabel}`,
              description: `${pricing.quantity} AI pentest credit(s) at $${pricing.ratePerIpDollars}/IP`,
            },
            unit_amount: pricing.ratePerIpCents,
          },
          quantity: pricing.quantity,
        },
      ];
      sessionMode = "payment";
      sessionMetadata = {
        ...(metadata || {}),
        userId,
        productType: "ai_pentest",
        // pentestType drives the webhook credit grant — set LAST so a caller's
        // metadata object can never override it.
        pentestType: "ai_pentest",
        quantity: String(pricing.quantity),
      };
    } else {
      if (!resolvedPriceId) {
        return NextResponse.json(
          {
            error: "Missing required fields or package is not configured",
            details: { manualPackageId: manualPackageId || null },
          },
          { status: 400 },
        );
      }
      lineItems = [{ price: resolvedPriceId, quantity: quantity || 1 }];
      sessionMode =
        mode || (productType === "subscription" ? "subscription" : "payment");
      sessionMetadata = {
        userId: userId || "",
        productType: productType || "one-time",
        manualPackageId: manualPackageId || "",
        ...(metadata || {}),
      };
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: sessionMode,
      success_url: resolvedSuccessUrl,
      cancel_url: resolvedCancelUrl,
      ...(email ? { customer_email: email } : {}),
      metadata: sessionMetadata,
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
