import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { COLLECTIONS } from "@/lib/org/collections";

export const dynamic = "force-dynamic";

/**
 * GET /api/tenant?slug=<subdomain> — PUBLIC white-label resolution.
 *
 * Maps a distributor's portal subdomain (e.g. `compulab` from
 * compulab.msppentesting.com) to their branding via `OrgBranding.cname`. Returns
 * the tenant's name + logo + primary color so the (unauthenticated) login page and
 * the app shell can skin themselves. No auth — this is public branding only.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim().toLowerCase();
  if (!slug) return NextResponse.json({ tenant: null });

  const snap = await adminDb
    .collection(COLLECTIONS.orgs)
    .where("branding.cname", "==", slug)
    .limit(1)
    .get();
  if (snap.empty) return NextResponse.json({ tenant: null });

  const org = snap.docs[0].data();
  const b = org.branding || {};
  return NextResponse.json({
    tenant: {
      orgId: org.id,
      name: org.name || slug,
      logoUrl: b.logoUrl || null,
      primaryColor: b.primaryColor || null,
    },
  });
}
