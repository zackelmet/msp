import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase/firebaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

async function isAdminUid(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  const doc = await adminDb.collection("users").doc(uid).get();
  return doc.data()?.isAdmin === true;
}

/** Sum paid Stripe checkout revenue over the last `days` days. */
async function stripeRevenue(days: number) {
  const since = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
  let salesCents = 0;
  let salesCount = 0;
  let startingAfter: string | undefined;

  try {
    // Paginate all sessions created since the cutoff.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await stripe.checkout.sessions.list({
        limit: 100,
        created: { gte: since },
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      for (const s of page.data) {
        const amount = s.amount_total || 0;
        if (s.payment_status === "paid" && amount > 0) {
          salesCents += amount;
          salesCount += 1;
        }
      }
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
  } catch (err) {
    console.error("Stripe revenue aggregation failed:", err);
    return { salesCents: 0, salesCount: 0, averageOrderCents: 0, unavailable: true };
  }

  return {
    salesCents,
    salesCount,
    averageOrderCents: salesCount > 0 ? Math.round(salesCents / salesCount) : 0,
    unavailable: false,
  };
}

export async function GET(_req: NextRequest) {
  const uid = cookies().get("uid")?.value;
  if (!(await isAdminUid(uid))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [usersSnap, pentestsSnap, completedSnap, recentPentestsSnap, revenue] =
      await Promise.all([
        adminDb.collection("users").count().get(),
        adminDb.collection("pentests").count().get(),
        adminDb
          .collection("pentests")
          .where("status", "==", "completed")
          .count()
          .get(),
        adminDb
          .collection("pentests")
          .where("createdAt", ">=", sevenDaysAgo)
          .count()
          .get(),
        stripeRevenue(30),
      ]);

    return NextResponse.json({
      totalUsers: usersSnap.data().count,
      totalPentests: pentestsSnap.data().count,
      completedPentests: completedSnap.data().count,
      pentestsLast7Days: recentPentestsSnap.data().count,
      revenue30Days: {
        cents: revenue.salesCents,
        count: revenue.salesCount,
        averageOrderCents: revenue.averageOrderCents,
        unavailable: revenue.unavailable,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
