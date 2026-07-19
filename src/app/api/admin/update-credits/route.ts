import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUid } from "@/lib/firebase/adminSession";
import { adminDb } from "@/lib/firebase/firebaseAdmin";

export const dynamic = "force-dynamic";

async function isAdminUid(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  const doc = await adminDb.collection("users").doc(uid).get();
  return doc.data()?.isAdmin === true;
}

// PATCH /api/admin/update-credits
// Body: { targetUid: string, externalIp1To50Credits?: number, externalIp51To100Credits?: number }
// Legacy support: { targetUid: string, credits: { web_app?: number, external_ip?: number } }
export async function PATCH(req: NextRequest) {
  const uid = await getVerifiedUid();
  if (!(await isAdminUid(uid))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const {
    targetUid,
    credits,
    externalIp1To50Credits,
    externalIp51To100Credits,
    level1Credits,
    level2Credits,
  } = body;

  if (!targetUid) {
    return NextResponse.json(
      { error: "targetUid is required" },
      { status: 400 },
    );
  }

  const update: Record<string, number | string> = {};
  const now = new Date().toISOString();

  if (typeof externalIp1To50Credits === "number") {
    update.externalIp1To50Credits = externalIp1To50Credits;
  }

  if (typeof externalIp51To100Credits === "number") {
    update.externalIp51To100Credits = externalIp51To100Credits;
  }

  if (typeof level1Credits === "number") {
    update.externalIp1To50Credits = level1Credits;
  }

  if (typeof level2Credits === "number") {
    update.externalIp51To100Credits = level2Credits;
  }

  if (credits && typeof credits === "object") {
    if (typeof credits.web_app === "number") {
      update.externalIp1To50Credits = credits.web_app;
    } else if (typeof credits.level1 === "number") {
      update.externalIp1To50Credits = credits.level1;
    }

    if (typeof credits.external_ip === "number") {
      update.externalIp51To100Credits = credits.external_ip;
    } else if (typeof credits.level2 === "number") {
      update.externalIp51To100Credits = credits.level2;
    }
  }

  if (
    typeof update.externalIp1To50Credits !== "number" &&
    typeof update.externalIp51To100Credits !== "number"
  ) {
    return NextResponse.json(
      {
        error:
          "Provide externalIp1To50Credits and/or externalIp51To100Credits (or legacy credits map keys)",
      },
      { status: 400 },
    );
  }

  update.updatedAt = now;

  await adminDb.collection("users").doc(targetUid).update(update);
  return NextResponse.json({ success: true });
}
