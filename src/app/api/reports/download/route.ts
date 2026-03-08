import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb, adminStorage } from "@/lib/firebase/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const uid = cookies().get("uid")?.value;
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pentestId = req.nextUrl.searchParams.get("pentestId");
  if (!pentestId) {
    return NextResponse.json({ error: "pentestId is required" }, { status: 400 });
  }

  try {
    const pentestDoc = await adminDb.collection("pentests").doc(pentestId).get();
    if (!pentestDoc.exists) {
      return NextResponse.json({ error: "Pentest not found" }, { status: 404 });
    }

    const data = pentestDoc.data()!;

    // Authorization: user must own this pentest OR be an admin
    const isOwner = data.userId === uid;
    const adminDoc = await adminDb.collection("users").doc(uid).get();
    const isAdmin = adminDoc.data()?.isAdmin === true;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storagePath: string = data.reportUrl;
    if (!storagePath) {
      return NextResponse.json({ error: "No report available" }, { status: 404 });
    }

    const ext = storagePath.endsWith(".docx") ? "docx" : "pdf";

    const cleanBucket = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "")
      .trim()
      .replace(/^["']|["']$/g, "");

    const bucket = adminStorage.bucket(cleanBucket);
    const file = bucket.file(storagePath);

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 15 * 60 * 1000,
      responseDisposition: `attachment; filename="pentest-report-${pentestId}.${ext}"`,
    });

    return NextResponse.json({ url });
  } catch (err: any) {
    console.error("reports/download error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
