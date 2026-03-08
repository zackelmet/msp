import { initializeAdmin } from "@/lib/firebase/firebaseAdmin";
import { NextRequest, NextResponse } from "next/server";
import { UserDocument } from "@/lib/types/user";

const admin = initializeAdmin();

export async function POST(req: NextRequest) {
  try {
    const { uid, name, email } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: "UID is required" }, { status: 400 });
    }

    const userRef = admin.firestore().collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      const newUser: Partial<UserDocument> = {
        uid,
        name: name || "",
        email: email || "",
        credits: { web_app: 0, external_ip: 0 },
        createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
      };

      await userRef.set(newUser, { merge: true });

      return NextResponse.json({ message: "User document created successfully" });
    }

    return NextResponse.json({ message: "User document already exists" });
  } catch (error: any) {
    console.error("Error creating user document:", error);
    return NextResponse.json(
      { error: "Failed to create user document" },
      { status: 500 }
    );
  }
}
