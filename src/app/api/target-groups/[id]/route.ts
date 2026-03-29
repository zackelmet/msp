import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyAuthToken } from "@/lib/firebase/firebaseAdmin";

export const dynamic = "force-dynamic";

// GET /api/target-groups/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await adminDb.collection("targetGroups").doc(params.id).get();

  if (!doc.exists || doc.data()?.uid !== uid) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ id: doc.id, ...doc.data() });
}

// PATCH /api/target-groups/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ref = adminDb.collection("targetGroups").doc(params.id);
  const doc = await ref.get();
  if (!doc.exists || doc.data()?.uid !== uid) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, clientName, envType, assets, notes } = body;

  await ref.update({
    ...(name !== undefined && { name }),
    ...(clientName !== undefined && { clientName }),
    ...(envType !== undefined && { envType }),
    ...(assets !== undefined && { assets, assetCount: assets.length }),
    ...(notes !== undefined && { notes }),
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}

// DELETE /api/target-groups/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ref = adminDb.collection("targetGroups").doc(params.id);
  const doc = await ref.get();

  if (!doc.exists || doc.data()?.uid !== uid) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await ref.delete();
  return NextResponse.json({ success: true });
}
