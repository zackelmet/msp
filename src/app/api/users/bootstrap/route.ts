import { initializeAdmin } from "@/lib/firebase/firebaseAdmin";
import { NextRequest, NextResponse } from "next/server";
import { OrgDocument } from "@/lib/types/org";
import { sendEmail, opsEmail, newSignupOpsEmail } from "@/lib/email/send";

const admin = initializeAdmin();

// A brand-new self-signup is auto-enrolled as a reseller under MSP Pentesting
// (Acronis-style: everyone lands in the tree, nobody is orphaned). PARKED — zero
// credits — until provisioned. Existing users are only profile-normalized.
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
    const existing = userDoc.exists ? userDoc.data() || {} : {};
    const legacyCredits =
      (existing.credits as Record<string, unknown> | undefined) || {};

    const externalIp1To50Credits =
      typeof existing.externalIp1To50Credits === "number"
        ? existing.externalIp1To50Credits
        : typeof existing.level1Credits === "number"
          ? existing.level1Credits
          : typeof legacyCredits.web_app === "number"
            ? (legacyCredits.web_app as number)
            : typeof legacyCredits.level1 === "number"
              ? (legacyCredits.level1 as number)
              : 0;

    const externalIp51To100Credits =
      typeof existing.externalIp51To100Credits === "number"
        ? existing.externalIp51To100Credits
        : typeof existing.level2Credits === "number"
          ? existing.level2Credits
          : typeof legacyCredits.external_ip === "number"
            ? (legacyCredits.external_ip as number)
            : typeof legacyCredits.level2 === "number"
              ? (legacyCredits.level2 as number)
              : 0;

    const ts = admin.firestore.FieldValue.serverTimestamp();

    const basePayload: Record<string, unknown> = {
      uid,
      email: existing.email || email || "",
      name: existing.name || existing.displayName || name || "",
      externalIp1To50Credits,
      externalIp51To100Credits,
      createdAt: existing.createdAt || ts,
      updatedAt: ts,
    };

    // Auto-enrol a NEW user as a reseller under MSPP (once). Never touch role/org
    // for an existing user (they may have been elevated to a distributor, etc.).
    let resellerOrgId: string | null = null;
    if (!userDoc.exists) {
      resellerOrgId = `org_reseller_${uid}`;
      const resellerOrg: Partial<OrgDocument> = {
        id: resellerOrgId,
        type: "reseller",
        parentOrgId: MSPP_SUPPLIER_ORG_ID,
        path: [MSPP_SUPPLIER_ORG_ID, resellerOrgId],
        name: (name as string) || (email as string) || resellerOrgId,
        billing: { mode: "inherited" },
        status: "active",
        createdAt: ts as any,
        createdBy: "system:bootstrap",
      };
      Object.assign(basePayload, {
        orgId: resellerOrgId,
        orgPath: [MSPP_SUPPLIER_ORG_ID, resellerOrgId],
        role: "reseller_admin",
        selfEnrolled: true,
        // Parked: no ai_pentest credit → the credit-gated launch path blocks spend.
        credits: { ai_pentest: 0, web_app: 0, external_ip: 0 },
      });

      const batch = db.batch();
      batch.set(db.collection("orgs").doc(resellerOrgId), resellerOrg, {
        merge: true,
      });
      batch.set(userRef, basePayload, { merge: true });
      await batch.commit();

      // Notify ops (Resend). Env-gated no-op if unset.
      const to = opsEmail() || "zack@msppentesting.com";
      if (to) {
        const tmpl = newSignupOpsEmail({ email: email || "", name, resellerOrgId });
        await sendEmail({ to, ...tmpl }).catch((e) =>
          console.error("[bootstrap] ops email failed:", e?.message ?? e),
        );
      }
    } else {
      await userRef.set(basePayload, { merge: true });
    }

    return NextResponse.json({
      message: userDoc.exists ? "User profile normalized" : "User enrolled",
      resellerOrgId,
      user: {
        uid,
        email: basePayload.email,
        name: basePayload.name,
        externalIp1To50Credits,
        externalIp51To100Credits,
      },
    });
  } catch (error: any) {
    console.error("Error bootstrapping user profile:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to bootstrap user profile" },
      { status: 500 },
    );
  }
}
