import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebase/firebaseAdmin";

export const dynamic = "force-dynamic";

async function isAdminUid(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  const doc = await adminDb.collection("users").doc(uid).get();
  return doc.data()?.isAdmin === true;
}

export async function GET(_req: NextRequest) {
  const uid = cookies().get("uid")?.value;
  if (!(await isAdminUid(uid))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const snap = await adminDb.collection("users").count().get();
    const totalUsers = snap.data().count;
    return NextResponse.json({ totalUsers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
