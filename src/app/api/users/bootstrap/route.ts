import { initializeAdmin } from "@/lib/firebase/firebaseAdmin";
import { NextRequest, NextResponse } from "next/server";

const admin = initializeAdmin();

export async function POST(req: NextRequest) {
  try {
    const { uid, name, email } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: "UID is required" }, { status: 400 });
    }

    const userRef = admin.firestore().collection("users").doc(uid);
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

    const updatePayload = {
      uid,
      email: existing.email || email || "",
      name: existing.name || existing.displayName || name || "",
      externalIp1To50Credits,
      externalIp51To100Credits,
      createdAt:
        existing.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await userRef.set(updatePayload, { merge: true });

    return NextResponse.json({
      message: userDoc.exists
        ? "User profile normalized"
        : "User profile created",
      user: {
        uid: updatePayload.uid,
        email: updatePayload.email,
        name: updatePayload.name,
        externalIp1To50Credits: updatePayload.externalIp1To50Credits,
        externalIp51To100Credits: updatePayload.externalIp51To100Credits,
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
