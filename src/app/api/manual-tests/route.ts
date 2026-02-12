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

    const {
      title,
      description,
      target,
      testType,
      methodology,
      engagementId,
      notes,
    } = body;

    if (!title || !target || !testType) {
      return NextResponse.json(
        { error: "Missing required fields: title, target, testType" },
        { status: 400 }
      );
    }

    const manualTest = {
      userId,
      title,
      description: description || "",
      target,
      testType,
      methodology: methodology || "Custom",
      engagementId: engagementId || null,
      notes: notes || "",
      status: "in_progress",
      startTime: admin.firestore.FieldValue.serverTimestamp(),
      findings: [],
      attachments: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await firestore.collection("manualTests").add(manualTest);

    // Log activity
    await firestore.collection("activityLogs").add({
      userId,
      type: "manual_test",
      title: `Started: ${title}`,
      description: `Manual ${testType} test on ${target}`,
      target,
      engagementId: engagementId || null,
      metadata: { manualTestId: docRef.id, testType },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      id: docRef.id,
    });
  } catch (error: any) {
    console.error("Error creating manual test:", error);
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
    const engagementId = searchParams.get("engagementId");
    const status = searchParams.get("status");

    let query = firestore
      .collection("manualTests")
      .where("userId", "==", userId)
      .orderBy("startTime", "desc");

    const snapshot = await query.get();
    let tests = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter in memory (Firestore has limitations on multiple where clauses)
    if (engagementId) {
      tests = tests.filter((t: any) => t.engagementId === engagementId);
    }
    if (status) {
      tests = tests.filter((t: any) => t.status === status);
    }

    return NextResponse.json({ tests });
  } catch (error: any) {
    console.error("Error fetching manual tests:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    // Verify ownership
    const testRef = firestore.collection("manualTests").doc(id);
    const testDoc = await testRef.get();

    if (!testDoc.exists) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    const testData = testDoc.data();
    if (testData?.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Handle completion
    if (updates.status === "completed" && testData?.status !== "completed") {
      updates.endTime = admin.firestore.FieldValue.serverTimestamp();
      // Calculate duration if startTime exists
      if (testData?.startTime) {
        const startTime = testData.startTime.toDate();
        const now = new Date();
        updates.duration = Math.round((now.getTime() - startTime.getTime()) / 60000);
      }
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await testRef.update(updates);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating manual test:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
