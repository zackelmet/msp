import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebase/firebaseAdmin";

export const dynamic = "force-dynamic";

async function isAdminUid(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  const doc = await adminDb.collection("users").doc(uid).get();
  return doc.data()?.isAdmin === true;
}

// PATCH /api/admin/update-credits
// Body: { targetUid: string, credits: { web_app?: number, ... } }
export async function PATCH(req: NextRequest) {
  const uid = cookies().get("uid")?.value;
  if (!(await isAdminUid(uid))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { targetUid, credits } = body;

  if (!targetUid || !credits || typeof credits !== "object") {
    return NextResponse.json({ error: "targetUid and credits object are required" }, { status: 400 });
  }

  const update: Record<string, number> = {};
  for (const [key, val] of Object.entries(credits)) {
    if (typeof val === "number") {
      update[`credits.${key}`] = val;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid credit fields provided" }, { status: 400 });
  }

  await adminDb.collection("users").doc(targetUid).update(update);
  return NextResponse.json({ success: true });
}
