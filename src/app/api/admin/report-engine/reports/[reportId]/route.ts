import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUid } from "@/lib/firebase/adminSession";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import {
  downloadReportPdf,
  getReportRecord,
} from "@/lib/report-engine/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAdminUid(uid: string): Promise<boolean> {
  const doc = await adminDb.collection("users").doc(uid).get();
  return doc.data()?.isAdmin === true;
}

export async function GET(
  _request: NextRequest,
  context: { params: { reportId: string } },
) {
  const uid = await getVerifiedUid();
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reportId = context.params.reportId;
  const report = await getReportRecord(reportId);

  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const isOwner = report.ownerUid === uid;
  const isSharedWithUser = Array.isArray(report.sharedWithUserIds)
    ? report.sharedWithUserIds.includes(uid)
    : false;
  const admin = isOwner || isSharedWithUser ? false : await isAdminUid(uid);

  if (!admin && !isOwner && !isSharedWithUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fileBytes = await downloadReportPdf(report.storagePath);
  if (!fileBytes) {
    return NextResponse.json(
      { error: "Stored report file not found." },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(fileBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${report.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
