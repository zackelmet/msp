import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebase/firebaseAdmin";

export const dynamic = "force-dynamic";

async function isAdminUid(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  const doc = await adminDb.collection("users").doc(uid).get();
  return doc.data()?.isAdmin === true;
}

/** Returns the most recent customer feedback entries for the admin viewer. */
export async function GET(_req: NextRequest) {
  const uid = cookies().get("uid")?.value;
  if (!(await isAdminUid(uid))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    let feedback: any[] = [];
    try {
      const snap = await adminDb
        .collection("feedback")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
      feedback = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          userEmail: data.userEmail || data.email || "—",
          message: data.message || data.feedback || "",
          rating: data.rating ?? null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        };
      });
    } catch {
      // Collection may not exist yet (no feedback captured) — return empty.
      feedback = [];
    }

    return NextResponse.json({ feedback });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
