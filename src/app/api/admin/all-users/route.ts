import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebase/firebaseAdmin";

export const dynamic = "force-dynamic";

async function isAdminUid(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  const doc = await adminDb.collection("users").doc(uid).get();
  return doc.data()?.isAdmin === true;
}

// GET /api/admin/all-users?limit=50&after=<lastDocId>
export async function GET(req: NextRequest) {
  const uid = cookies().get("uid")?.value;
  if (!(await isAdminUid(uid))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);
  const afterId = req.nextUrl.searchParams.get("after");

  let query = adminDb.collection("users").orderBy("email").limit(limit);

  if (afterId) {
    const cursor = await adminDb.collection("users").doc(afterId).get();
    if (cursor.exists) {
      query = adminDb
        .collection("users")
        .orderBy("email")
        .startAfter(cursor)
        .limit(limit);
    }
  }

  const snap = await query.get();
  const users = snap.docs.map((doc) => {
    const d = doc.data();
    const legacyCredits = d.credits ?? {};
    const externalIp1To50Credits =
      typeof d.externalIp1To50Credits === "number"
        ? d.externalIp1To50Credits
        : typeof d.level1Credits === "number"
          ? d.level1Credits
          : typeof legacyCredits.web_app === "number"
            ? legacyCredits.web_app
            : typeof legacyCredits.level1 === "number"
              ? legacyCredits.level1
              : 0;
    const externalIp51To100Credits =
      typeof d.externalIp51To100Credits === "number"
        ? d.externalIp51To100Credits
        : typeof d.level2Credits === "number"
          ? d.level2Credits
          : typeof legacyCredits.external_ip === "number"
            ? legacyCredits.external_ip
            : typeof legacyCredits.level2 === "number"
              ? legacyCredits.level2
              : 0;

    return {
      id: doc.id,
      email: d.email ?? "",
      displayName: d.displayName ?? "",
      isAdmin: d.isAdmin ?? false,
      externalIp1To50Credits,
      externalIp51To100Credits,
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
    };
  });

  return NextResponse.json(users);
}
