import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyAuthToken } from "@/lib/firebase/firebaseAdmin";

export const dynamic = "force-dynamic";

/**
 * POST /api/invites/accept  { token }
 *
 * Called right after the invitee signs in/up (Bearer ID token). Attaches the new
 * user to the inviter's tree as a reseller_admin (creating their reseller org) and
 * marks the invite accepted. Their account lives on our single Firebase.
 */
export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const token = String(body?.token || "");
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const inviteRef = adminDb.collection("invites").doc(token);
  const inviteSnap = await inviteRef.get();
  const invite = inviteSnap.data();
  if (!inviteSnap.exists || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.status === "accepted") {
    return NextResponse.json({ error: "Invite already used" }, { status: 409 });
  }

  const parentOrgId: string = invite.parentOrgId;
  const parent = (await adminDb.collection("orgs").doc(parentOrgId).get()).data();
  if (!parent) {
    return NextResponse.json({ error: "Inviting org no longer exists" }, { status: 410 });
  }

  const resellerOrgId = `org_reseller_${uid}`;
  const orgPath = [...(parent.path || [parentOrgId]), resellerOrgId];
  const ts = FieldValue.serverTimestamp();

  const batch = adminDb.batch();
  batch.set(
    adminDb.collection("orgs").doc(resellerOrgId),
    {
      id: resellerOrgId,
      type: "reseller",
      parentOrgId,
      path: orgPath,
      name: invite.email || resellerOrgId,
      billing: { mode: "inherited" },
      status: "active",
      createdAt: ts,
      createdBy: `system:invite:${invite.createdBy || ""}`,
    },
    { merge: true },
  );
  batch.set(
    adminDb.collection("users").doc(uid),
    {
      uid,
      orgId: resellerOrgId,
      orgPath,
      role: "reseller_admin",
      invitedBy: invite.createdBy || null,
      credits: { ai_pentest: 0, web_app: 0, external_ip: 0 },
      updatedAt: ts,
    },
    { merge: true },
  );
  batch.set(
    inviteRef,
    { status: "accepted", acceptedByUid: uid, acceptedAt: ts },
    { merge: true },
  );
  await batch.commit();

  return NextResponse.json({ ok: true, orgId: resellerOrgId });
}
