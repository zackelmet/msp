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
      clientName,
      projectName,
      scope,
      outOfScope,
      startDate,
      endDate,
      notes,
    } = body;

    if (!clientName || !projectName || !scope || scope.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: clientName, projectName, scope" },
        { status: 400 }
      );
    }

    const engagement = {
      clientName,
      projectName,
      scope,
      outOfScope: outOfScope || [],
      status: "planning",
      startDate: startDate
        ? admin.firestore.Timestamp.fromDate(new Date(startDate))
        : admin.firestore.FieldValue.serverTimestamp(),
      endDate: endDate
        ? admin.firestore.Timestamp.fromDate(new Date(endDate))
        : null,
      notes: notes || "",
      createdBy: userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await firestore.collection("engagements").add(engagement);

    // Log activity
    await firestore.collection("activityLogs").add({
      userId,
      type: "engagement_started",
      title: `New Engagement: ${clientName} - ${projectName}`,
      description: `Created engagement with ${scope.length} targets in scope`,
      engagementId: docRef.id,
      metadata: { clientName, projectName, scopeCount: scope.length },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      id: docRef.id,
    });
  } catch (error: any) {
    console.error("Error creating engagement:", error);
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
    const status = searchParams.get("status");

    const query = firestore
      .collection("engagements")
      .where("createdBy", "==", userId)
      .orderBy("createdAt", "desc");

    const snapshot = await query.get();
    let engagements = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (status) {
      engagements = engagements.filter((e: any) => e.status === status);
    }

    return NextResponse.json({ engagements });
  } catch (error: any) {
    console.error("Error fetching engagements:", error);
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
    const engagementRef = firestore.collection("engagements").doc(id);
    const engagementDoc = await engagementRef.get();

    if (!engagementDoc.exists) {
      return NextResponse.json(
        { error: "Engagement not found" },
        { status: 404 }
      );
    }

    const engagementData = engagementDoc.data();
    if (engagementData?.createdBy !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Handle status changes
    if (updates.status === "completed" && engagementData?.status !== "completed") {
      updates.endDate = admin.firestore.FieldValue.serverTimestamp();

      // Log activity
      await firestore.collection("activityLogs").add({
        userId,
        type: "engagement_completed",
        title: `Completed: ${engagementData.clientName} - ${engagementData.projectName}`,
        description: `Engagement marked as completed`,
        engagementId: id,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Handle date conversions
    if (updates.startDate && typeof updates.startDate === "string") {
      updates.startDate = admin.firestore.Timestamp.fromDate(
        new Date(updates.startDate)
      );
    }
    if (updates.endDate && typeof updates.endDate === "string") {
      updates.endDate = admin.firestore.Timestamp.fromDate(
        new Date(updates.endDate)
      );
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await engagementRef.update(updates);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating engagement:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
