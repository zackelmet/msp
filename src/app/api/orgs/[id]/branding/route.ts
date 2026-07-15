import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { COLLECTIONS } from "@/lib/org/collections";
import { OrgBranding } from "@/lib/types/org";
import { getCaller, canManageOrgs } from "@/lib/org/access";
import { getOrg, isInSubtree } from "@/lib/org/tree";

export const dynamic = "force-dynamic";

const strField = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

/**
 * PUT /api/orgs/[id]/branding — role-scoped white-label write.
 *
 * Branding may be set on SELF or a descendant (a reseller brands itself, and can
 * override a client's). platform_admin may set any. Auth: Firebase Bearer token.
 */
export async function PUT(
  req: NextRequest,
  context: { params: { id: string } },
) {
  const caller = await getCaller(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageOrgs(caller)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgId = context.params.id;
  const target = await getOrg(orgId);
  if (!target) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  if (!caller.isAdmin) {
    const allowed = !!caller.orgId && isInSubtree(target, caller.orgId);
    if (!allowed) {
      return NextResponse.json(
        { error: "You can only brand your own subtree" },
        { status: 403 },
      );
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = (body as { branding?: Record<string, unknown> })?.branding ?? body;
  const b = (raw ?? {}) as Record<string, unknown>;
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

  await adminDb
    .collection(COLLECTIONS.orgs)
    .doc(orgId)
    .set(
      { branding: clean, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

  return NextResponse.json({ status: "success", orgId, branding: clean });
}
