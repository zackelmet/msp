import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/firebaseAdmin";

export const dynamic = "force-dynamic";

/** GET /api/invites/[token] — public, minimal invite info for the accept page. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const snap = await adminDb.collection("invites").doc(params.token).get();
  const d = snap.data();
  if (!snap.exists || !d) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  return NextResponse.json({
    email: d.email,
    parentName: d.parentName,
    tenantSlug: d.tenantSlug || null,
    status: d.status,
  });
}
