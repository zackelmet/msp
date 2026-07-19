import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/firebaseAdmin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/firebase/adminSession";

export const dynamic = "force-dynamic";

/**
 * POST { idToken } — mint an httpOnly Firebase session cookie from a fresh ID
 * token. Called by the client right after sign-in. This is the server-verified
 * identity the /admin surface trusts (replaces the forgeable `uid` cookie).
 */
export async function POST(req: NextRequest) {
  let idToken: string | undefined;
  try {
    idToken = (await req.json())?.idToken;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!idToken) {
    return NextResponse.json({ error: "idToken required" }, { status: 400 });
  }
  try {
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });
    return res;
  } catch (e: any) {
    console.error("session create failed:", e?.message ?? e);
    return NextResponse.json(
      { error: e?.message || "Could not create session" },
      { status: 401 },
    );
  }
}

/** Clear the session cookie (logout). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
