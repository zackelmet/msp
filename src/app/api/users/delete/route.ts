import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/firebaseAdmin";

export async function DELETE(req: NextRequest) {
  try {
    const { uid } = await req.json();
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

    // Delete Firestore user document
    await adminDb.collection("users").doc(uid).delete();

    // Delete Firebase Auth user
    await adminAuth.deleteUser(uid);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Delete user error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete user" }, { status: 500 });
  }
}
