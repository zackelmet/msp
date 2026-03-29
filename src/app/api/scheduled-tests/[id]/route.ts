import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyAuthToken } from "@/lib/firebase/firebaseAdmin";

export const dynamic = "force-dynamic";

// PATCH /api/scheduled-tests/[id]  — update status or notes
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ref = adminDb.collection("scheduledTests").doc(params.id);
  const doc = await ref.get();

  if (!doc.exists || doc.data()?.uid !== uid) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const allowed = ["scheduledDate", "frequency", "notes", "status", "testType"];
  const updates: Record<string, string> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  await ref.update(updates);
  return NextResponse.json({ success: true });
}

// DELETE /api/scheduled-tests/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ref = adminDb.collection("scheduledTests").doc(params.id);
  const doc = await ref.get();

  if (!doc.exists || doc.data()?.uid !== uid) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await ref.delete();
  return NextResponse.json({ success: true });
}
