import { NextRequest, NextResponse } from "next/server";
import { initializeAdmin } from "@/lib/firebase/firebaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const admin = initializeAdmin();
    const auth = admin.auth();
    const firestore = admin.firestore();

    // Verify auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized - No token provided" },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid token" },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    const body = await request.json();

    const { type, title, description, target, engagementId, metadata } = body;

    if (!type || !title) {
      return NextResponse.json(
        { error: "Missing required fields: type, title" },
        { status: 400 }
      );
    }

    const activityLog = {
      userId,
      type,
      title,
      description: description || "",
      target: target || null,
      engagementId: engagementId || null,
      metadata: metadata || {},
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await firestore.collection("activityLogs").add(activityLog);

    return NextResponse.json({
      success: true,
      id: docRef.id,
    });
  } catch (error: any) {
    console.error("Error creating activity log:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const admin = initializeAdmin();
    const auth = admin.auth();
    const firestore = admin.firestore();

    // Verify auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized - No token provided" },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid token" },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit") || "50";
    const engagementId = searchParams.get("engagementId");

    let query = firestore
      .collection("activityLogs")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .limit(parseInt(limitParam));

    if (engagementId) {
      query = firestore
        .collection("activityLogs")
        .where("userId", "==", userId)
        .where("engagementId", "==", engagementId)
        .orderBy("timestamp", "desc")
        .limit(parseInt(limitParam));
    }

    const snapshot = await query.get();
    const activities = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ activities });
  } catch (error: any) {
    console.error("Error fetching activity logs:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
