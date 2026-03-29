import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyAuthToken } from "@/lib/firebase/firebaseAdmin";

export const dynamic = "force-dynamic";

// GET /api/scheduled-tests
export async function GET(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb
    .collection("scheduledTests")
    .where("uid", "==", uid)
    .orderBy("scheduledDate", "asc")
    .get();

  const tests = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ tests });
}

// POST /api/scheduled-tests
export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { targetGroupId, targetGroupName, clientName, testType, frequency, scheduledDate, notes } = body;

  if (!targetGroupId || !testType || !frequency || !scheduledDate) {
    return NextResponse.json({ error: "targetGroupId, testType, frequency, scheduledDate are required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const ref = adminDb.collection("scheduledTests").doc();

  await ref.set({
    uid,
    targetGroupId,
    targetGroupName: targetGroupName || "",
    clientName: clientName || "",
    testType,
    frequency,
    scheduledDate,
    notes: notes || "",
    status: "pending",
    createdAt: now,
  });

  return NextResponse.json({ id: ref.id, createdAt: now });
}

// DELETE /api/scheduled-tests?id=xxx
export async function DELETE(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const ref = adminDb.collection("scheduledTests").doc(id);
  const doc = await ref.get();

  if (!doc.exists || doc.data()?.uid !== uid) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await ref.delete();
  return NextResponse.json({ success: true });
}
