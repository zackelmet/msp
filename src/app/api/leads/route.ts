import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { sendEmail, opsEmail, salesLeadOpsEmail } from "@/lib/email/send";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/leads — public "Contact sales" capture for the distributor / volume
 * tier (the higher tier is form-gated, not self-serve). Stores a lead doc and
 * alerts Zack via Resend (env-gated no-op if RESEND unset). No auth by design.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = String(body?.name || "")
    .trim()
    .slice(0, 200);
  const email = String(body?.email || "")
    .trim()
    .slice(0, 200);
  const company = String(body?.company || "")
    .trim()
    .slice(0, 200);
  const topic = String(body?.topic || "")
    .trim()
    .slice(0, 100);
  const ipEstimate = String(body?.ipEstimate || "")
    .trim()
    .slice(0, 100);
  const message = String(body?.message || "")
    .trim()
    .slice(0, 4000);

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "A valid email is required" },
      { status: 400 },
    );
  }
  // Honeypot: bots fill hidden fields. Silently accept (200) without storing.
  if (body?.website) {
    return NextResponse.json({ ok: true });
  }

  try {
    await adminDb.collection("leads").add({
      name,
      email,
      company,
      topic,
      ipEstimate,
      message,
      source: "pricing_contact_sales",
      status: "new",
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e: any) {
    console.error("lead persist failed:", e?.message ?? e);
    return NextResponse.json(
      { error: "Could not submit — try again" },
      { status: 500 },
    );
  }

  const to = opsEmail() || "zack@msppentesting.com";
  if (to) {
    const tmpl = salesLeadOpsEmail({
      name,
      email,
      company,
      topic,
      ipEstimate,
      message,
    });
    await sendEmail({ to, replyTo: email, ...tmpl }).catch((e) =>
      console.error("lead email failed:", e?.message ?? e),
    );
  }

  return NextResponse.json({ ok: true });
}
