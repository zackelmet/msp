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
      severity,
      target,
      affectedComponent,
      cveIds,
      cvssScore,
      evidence,
      stepsToReproduce,
      remediation,
      references,
      engagementId,
      scanId,
      manualTestId,
    } = body;

    if (!title || !severity || !target) {
      return NextResponse.json(
        { error: "Missing required fields: title, severity, target" },
        { status: 400 }
      );
    }

    const finding = {
      userId,
      title,
      description: description || "",
      severity,
      status: "open",
      target,
      affectedComponent: affectedComponent || null,
      cveIds: cveIds || [],
      cvssScore: cvssScore || null,
      evidence: evidence || null,
      stepsToReproduce: stepsToReproduce || null,
      remediation: remediation || null,
      references: references || [],
      engagementId: engagementId || null,
      scanId: scanId || null,
      manualTestId: manualTestId || null,
      attachments: [],
      discoveredAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await firestore.collection("findings").add(finding);

    // Log activity
    await firestore.collection("activityLogs").add({
      userId,
      type: "finding_added",
      title: `Finding: ${title}`,
      description: `${severity.toUpperCase()} severity finding on ${target}`,
      target,
      engagementId: engagementId || null,
      metadata: { findingId: docRef.id, severity },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update manual test if linked
    if (manualTestId) {
      const testRef = firestore.collection("manualTests").doc(manualTestId);
      await testRef.update({
        findings: admin.firestore.FieldValue.arrayUnion(docRef.id),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      success: true,
      id: docRef.id,
    });
  } catch (error: any) {
    console.error("Error creating finding:", error);
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
    const severity = searchParams.get("severity");
    const status = searchParams.get("status");

    const query = firestore
      .collection("findings")
      .where("userId", "==", userId)
      .orderBy("discoveredAt", "desc");

    const snapshot = await query.get();
    let findings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter in memory
    if (engagementId) {
      findings = findings.filter((f: any) => f.engagementId === engagementId);
    }
    if (severity) {
      findings = findings.filter((f: any) => f.severity === severity);
    }
    if (status) {
      findings = findings.filter((f: any) => f.status === status);
    }

    return NextResponse.json({ findings });
  } catch (error: any) {
    console.error("Error fetching findings:", error);
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
    const findingRef = firestore.collection("findings").doc(id);
    const findingDoc = await findingRef.get();

    if (!findingDoc.exists) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    }

    const findingData = findingDoc.data();
    if (findingData?.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Handle status changes
    if (updates.status === "confirmed" && findingData?.status !== "confirmed") {
      updates.confirmedAt = admin.firestore.FieldValue.serverTimestamp();
    }
    if (updates.status === "remediated" && findingData?.status !== "remediated") {
      updates.remediatedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await findingRef.update(updates);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating finding:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
