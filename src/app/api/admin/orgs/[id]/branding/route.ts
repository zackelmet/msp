import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUid } from "@/lib/firebase/adminSession";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { COLLECTIONS } from "@/lib/org/collections";
import { OrgBranding } from "@/lib/types/org";

export const dynamic = "force-dynamic";

async function isAdminUid(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  const doc = await adminDb.collection("users").doc(uid).get();
  return doc.data()?.isAdmin === true;
}

const strField = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

/**
 * PUT /api/admin/orgs/[id]/branding
 *
 * Sets a reseller node's white-label branding (logo / primary color / footer /
 * cname / cover / email sender) and the whiteLabelEnabled master switch. This
 * branding drives the reseller's clients' reports + portal. Writes to
 * orgs/{orgId}.branding via the Admin SDK.
 */
export async function PUT(
  req: NextRequest,
  context: { params: { id: string } },
) {
  const uid = await getVerifiedUid();
  if (!(await isAdminUid(uid))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const orgId = context.params.id;
  const orgRef = adminDb.collection(COLLECTIONS.orgs).doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = (body as { branding?: Record<string, unknown> })?.branding ?? body;
  const b = (raw ?? {}) as Record<string, unknown>;

  // Build only the provided fields; strip undefined so we don't clobber others.
  const branding: OrgBranding = {
    logoUrl: strField(b.logoUrl),
    primaryColor: strField(b.primaryColor),
    cname: strField(b.cname),
    reportCoverUrl: strField(b.reportCoverUrl),
    emailSender: strField(b.emailSender),
    reportFooter: strField(b.reportFooter),
    whiteLabelEnabled: b.whiteLabelEnabled === true,
  };
  const clean = Object.fromEntries(
    Object.entries(branding).filter(([, v]) => v !== undefined),
  );

  await orgRef.set(
    { branding: clean, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  return NextResponse.json({ status: "success", orgId, branding: clean });
}
