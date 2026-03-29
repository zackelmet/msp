import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyAuthToken } from "@/lib/firebase/firebaseAdmin";

export const dynamic = "force-dynamic";

// GET /api/target-groups  — list all target groups for the authed user
export async function GET(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb
    .collection("targetGroups")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .get();

  const groups = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json(groups);
}

// POST /api/target-groups  — create a new target group
export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, clientName, envType, assets, notes } = body;

  if (!name || !envType) {
    return NextResponse.json({ error: "name and envType are required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const ref = adminDb.collection("targetGroups").doc();

  await ref.set({
    uid,
    name,
    clientName: clientName || "",
    envType,
    assets: assets || [],
    assetCount: (assets || []).length,
    notes: notes || "",
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id: ref.id, createdAt: now });
}
