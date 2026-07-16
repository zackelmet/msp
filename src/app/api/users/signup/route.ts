import { initializeAdmin } from "@/lib/firebase/firebaseAdmin";
import { NextRequest, NextResponse } from "next/server";
import { UserDocument } from "@/lib/types/user";
import { OrgDocument } from "@/lib/types/org";
import { sendEmail, opsEmail, newSignupOpsEmail } from "@/lib/email/send";

const admin = initializeAdmin();

// New self-signups are auto-enrolled as a reseller under MSP Pentesting's supplier
// tree (Acronis-style: everyone lands in the tree, nobody is orphaned). They are
// PARKED — zero credits, so they can't launch/spend until Zack provisions them.
// Ambitious partners are nudged to become a distributor (their own supplier) via
// the portal's distributor prompt → email Zack.
const MSPP_SUPPLIER_ORG_ID = "org_msp";

export async function POST(req: NextRequest) {
  try {
    const { uid, name, email } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: "UID is required" }, { status: 400 });
    }

    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      return NextResponse.json({ message: "User document already exists" });
    }

    // Auto-enrol as a reseller under the MSPP supplier. Each signup gets its own
    // reseller node (their own tenant), keyed on the full uid so it's idempotent
    // and collision-free (a uid prefix could otherwise merge two users' orgs).
    const resellerOrgId = `org_reseller_${uid}`;
    const orgRef = db.collection("orgs").doc(resellerOrgId);
    const ts = admin.firestore.FieldValue.serverTimestamp();

    const resellerOrg: Partial<OrgDocument> = {
      id: resellerOrgId,
      type: "reseller",
      parentOrgId: MSPP_SUPPLIER_ORG_ID,
      path: [MSPP_SUPPLIER_ORG_ID, resellerOrgId],
      name: name || email || resellerOrgId,
      billing: { mode: "inherited" },
      status: "active",
      createdAt: ts as any,
      createdBy: "system:signup",
    };

    const newUser: Partial<UserDocument> = {
      uid,
      name: name || "",
      email: email || "",
      // Parked: no ai_pentest credit → the launch path (credit-gated) blocks
      // spend until Zack provisions them.
      credits: { web_app: 0, external_ip: 0 },
      // Org membership: reseller admin of their own node under MSPP.
      orgId: resellerOrgId,
      orgPath: [MSPP_SUPPLIER_ORG_ID, resellerOrgId],
      role: "reseller_admin",
      // Flags the distributor-upsell prompt (self-serve signups only, not the
      // MSPP house reseller or partners onboarded by script).
      selfEnrolled: true,
      createdAt: ts as any,
      updatedAt: ts as any,
    };

    // Both writes together so a user is never left without their org node.
    const batch = db.batch();
    batch.set(orgRef, resellerOrg, { merge: true });
    batch.set(userRef, newUser, { merge: true });
    await batch.commit();

    // Notify Zack (Resend). Env-gated: no-op if RESEND_API_KEY/EMAIL_FROM unset.
    const to = opsEmail() || "zack@msppentesting.com";
    if (to) {
      const tmpl = newSignupOpsEmail({ email: email || "", name, resellerOrgId });
      // Don't let an email hiccup fail the signup.
      await sendEmail({ to, ...tmpl }).catch((e) =>
        console.error("[signup] ops email failed:", e?.message ?? e),
      );
    }

    return NextResponse.json({
      message: "User document created successfully",
      resellerOrgId,
    });
  } catch (error: any) {
    console.error("Error creating user document:", error);
    return NextResponse.json(
      { error: "Failed to create user document" },
      { status: 500 }
    );
  }
}
