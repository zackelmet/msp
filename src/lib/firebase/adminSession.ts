import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/firebaseAdmin";

/**
 * Server-verified admin identity.
 *
 * The old `/admin` gate trusted a raw, client-set `uid` cookie (forgeable → auth
 * bypass). Instead we use a Firebase **session cookie** (`__session`): minted
 * server-side from a fresh ID token via the Admin SDK and cryptographically
 * verified on read. httpOnly + signed → a client cannot fabricate one.
 */

export const SESSION_COOKIE = "__session";
/** 5 days. Firebase allows up to 14. */
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

/** Verified uid from the session cookie, or undefined if missing/invalid/revoked. */
export async function getVerifiedUid(): Promise<string | undefined> {
  const cookie = cookies().get(SESSION_COOKIE)?.value;
  if (!cookie) return undefined;
  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    return decoded.uid;
  } catch {
    return undefined;
  }
}
