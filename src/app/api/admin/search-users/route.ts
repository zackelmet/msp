import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebase/firebaseAdmin";

export const dynamic = "force-dynamic";

async function isAdminUid(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  const doc = await adminDb.collection("users").doc(uid).get();
  return doc.data()?.isAdmin === true;
}

export async function GET(req: NextRequest) {
  const uid = cookies().get("uid")?.value;
  if (!(await isAdminUid(uid))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const snap = await adminDb
      .collection("users")
      .where("email", ">=", q)
      .where("email", "<", q + "\uf8ff")
      .limit(8)
      .get();

    const results = snap.docs.map((doc) => ({
      uid: doc.id,
      email: doc.data().email as string,
    }));

    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
