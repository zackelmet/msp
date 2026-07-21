import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { getCaller, canManageOrgs } from "@/lib/org/access";
import { getOrg, resolveBranding } from "@/lib/org/tree";
import { sendEmail } from "@/lib/email/send";

export const dynamic = "force-dynamic";

/**
 * POST /api/invites  { email }
 *
 * A distributor (or reseller admin) invites a RESELLER onto their tree. Creates a
 * pending invite; on accept (/invite/<token>) the new user is created on our
 * Firebase and parented under the inviter as a reseller_admin. Invite-only — no
 * open signup on a distributor subdomain. Returns the branded invite URL.
 */
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !canManageOrgs(caller)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const parentOrgId = caller.orgPath?.[0] ?? caller.orgId;
  if (!parentOrgId) {
    return NextResponse.json({ error: "No org to invite under" }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const email = String(body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const parent = await getOrg(parentOrgId);
  if (!parent) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }
  const branding = await resolveBranding(parent);
  const slug = branding.cname || null;

  const token = randomUUID();
  await adminDb.collection("invites").doc(token).set({
    token,
    email,
    role: "reseller_admin",
    parentOrgId,
    parentName: parent.name || parentOrgId,
    tenantSlug: slug,
    status: "pending",
    createdBy: caller.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const host = slug ? `https://${slug}.msppentesting.com` : origin;
  const inviteUrl = `${host}/invite/${token}`;

  // Best-effort email (env-gated no-op if Resend unset).
  await sendEmail({
    to: email,
    subject: `You're invited to ${parent.name || "the portal"}`,
    html: `<p>You've been invited to join <strong>${parent.name || "the portal"}</strong> on MSP Pentesting.</p>
      <p><a href="${inviteUrl}">Accept your invite &amp; set up your account →</a></p>`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, inviteUrl, token });
}
