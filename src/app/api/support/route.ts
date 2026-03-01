import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, topic, message } = body;

    if (!name || !email || !topic || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Store in Firestore support_requests collection
    await adminDb.collection("support_requests").add({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      topic,
      message: message.trim(),
      status: "open",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Support request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
