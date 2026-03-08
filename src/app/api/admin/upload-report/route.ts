import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb, adminStorage } from "@/lib/firebase/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

async function isAdminUid(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  const doc = await adminDb.collection("users").doc(uid).get();
  return doc.data()?.isAdmin === true;
}

export async function POST(req: NextRequest) {
  const uid = cookies().get("uid")?.value;
  if (!(await isAdminUid(uid))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const pentestId = formData.get("pentestId") as string | null;
    const file = formData.get("file") as File | null;

    if (!pentestId || !file) {
      return NextResponse.json(
        { error: "pentestId and file are required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF and DOCX files are accepted" },
        { status: 400 }
      );
    }

    // Verify pentest exists
    const pentestDoc = await adminDb.collection("pentests").doc(pentestId).get();
    if (!pentestDoc.exists) {
      return NextResponse.json({ error: "Pentest not found" }, { status: 404 });
    }

    // Determine extension
    const ext = file.type === "application/pdf" ? "pdf" : "docx";
    const storagePath = `reports/${pentestId}.${ext}`;

    // Upload to Firebase Storage
    const cleanBucket = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "")
      .trim()
      .replace(/^["']|["']$/g, "");

    const bucket = adminStorage.bucket(cleanBucket);
    const fileRef = bucket.file(storagePath);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fileRef.save(buffer, {
      metadata: { contentType: file.type },
    });

    // Update Firestore pentest doc
    await adminDb.collection("pentests").doc(pentestId).update({
      reportUrl: storagePath,
      status: "completed",
      reportUploadedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, storagePath });
  } catch (err: any) {
    console.error("upload-report error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
