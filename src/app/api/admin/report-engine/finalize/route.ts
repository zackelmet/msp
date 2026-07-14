import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminStorage } from "@/lib/firebase/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizePathPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function decodeBase64(input: string, field: string) {
  try {
    return Buffer.from(input, "base64");
  } catch {
    throw new Error(`Invalid base64 payload for ${field}`);
  }
}

function readBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

/**
 * Machine-to-machine finalize endpoint. An external job (e.g. an Apps Script
 * pipeline) posts pre-rendered PDF + DOCX artifacts, gated by a shared bearer
 * token (APPS_SCRIPT_FINALIZE_BEARER_TOKEN). Stores both to Cloud Storage and
 * records the report.
 */
export async function POST(request: NextRequest) {
  try {
    const expectedToken = process.env.APPS_SCRIPT_FINALIZE_BEARER_TOKEN;
    if (!expectedToken) {
      return NextResponse.json(
        { error: "APPS_SCRIPT_FINALIZE_BEARER_TOKEN is not configured" },
        { status: 500 },
      );
    }

    const providedToken = readBearerToken(request);
    if (!providedToken || providedToken !== expectedToken) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const required = [
      "jobId",
      "clientName",
      "projectTitle",
      "pdfFileName",
      "docxFileName",
      "pdfBase64",
      "docxBase64",
    ];

    for (const key of required) {
      if (!body?.[key] || typeof body[key] !== "string") {
        return NextResponse.json(
          { error: `Missing required field: ${key}` },
          { status: 400 },
        );
      }
    }

    const client = sanitizePathPart(body.clientName || "client");
    const project = sanitizePathPart(body.projectTitle || "report");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const baseName = `${timestamp}-${project}`;

    const pdfPath = `reports/${client}/${baseName}.pdf`;
    const docxPath = `reports/${client}/${baseName}.docx`;

    const bucket = adminStorage.bucket();
    const pdfBytes = decodeBase64(body.pdfBase64, "pdfBase64");
    const docxBytes = decodeBase64(body.docxBase64, "docxBase64");

    await bucket.file(pdfPath).save(pdfBytes, {
      contentType: "application/pdf",
      resumable: false,
      metadata: {
        metadata: {
          jobId: body.jobId,
          source: "apps-script",
          requestedByUid: body.requestedByUid || "",
          requestedByEmail: body.requestedByEmail || "",
        },
      },
    });

    await bucket.file(docxPath).save(docxBytes, {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      resumable: false,
      metadata: {
        metadata: {
          jobId: body.jobId,
          source: "apps-script",
          requestedByUid: body.requestedByUid || "",
          requestedByEmail: body.requestedByEmail || "",
        },
      },
    });

    const reportId = adminDb.collection("reports").doc().id;
    const fileName = `${baseName}.pdf`;
    const docxFileName = `${baseName}.docx`;

    await adminDb
      .collection("reports")
      .doc(reportId)
      .set({
        id: reportId,
        source: "apps-script",
        ownerUid: body.requestedByUid || "",
        requestedByEmail: body.requestedByEmail || "",
        sharedWithUserIds: [],
        storagePath: pdfPath,
        docxStoragePath: docxPath,
        fileName,
        docxFileName,
        clientName: body.clientName,
        projectTitle: body.projectTitle,
        driveDocUrl: body.driveDocUrl || null,
        createdAt: FieldValue.serverTimestamp(),
      });

    const expiresAt = Date.now() + 15 * 60 * 1000;
    const [pdfSignedUrl] = await bucket.file(pdfPath).getSignedUrl({
      action: "read",
      expires: expiresAt,
      responseDisposition: `inline; filename="${fileName}"`,
      responseType: "application/pdf",
    });

    const [docxSignedUrl] = await bucket.file(docxPath).getSignedUrl({
      action: "read",
      expires: expiresAt,
      responseDisposition: `attachment; filename="${docxFileName}"`,
      responseType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    return NextResponse.json({
      status: "success",
      reportId,
      fileName,
      pdfSignedUrl,
      pdfSignedUrlExpiresAt: expiresAt,
      docxSignedUrl,
      docxSignedUrlExpiresAt: expiresAt,
      accessUrl: `/api/admin/report-engine/reports/${reportId}`,
      driveDocUrl: body.driveDocUrl || null,
    });
  } catch (error) {
    console.error("Finalize from Apps Script failed:", error);
    return NextResponse.json(
      { error: "Failed to finalize report artifacts." },
      { status: 500 },
    );
  }
}
