"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTenantBranding } from "@/lib/tenant";

/**
 * Invite accept page. The invitee sets up an account (created on our single
 * Firebase) which is then attached, via /api/invites/accept, as a reseller under
 * the inviting distributor. Branded to the tenant when on their subdomain.
 */
export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params?.token || "");
  const { tenant } = useTenantBranding();

  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setInvite(d))
      .catch(() => setInvite(null))
      .finally(() => setLoading(false));
  }, [token]);

  const finish = async (getUser: () => Promise<any>) => {
    setBusy(true);
    setError(null);
    try {
      const user = await getUser();
      const idToken = await user.getIdToken();
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ token }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not accept invite");
      router.replace("/app/dashboard");
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
      setBusy(false);
    }
  };

  const acceptWithPassword = () =>
    finish(async () => {
      const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } =
        await import("firebase/auth");
      const app = (await import("@/lib/firebase/firebaseClient")).default;
      const auth = getAuth(app);
      try {
        return (await createUserWithEmailAndPassword(auth, invite.email, password)).user;
      } catch (e: any) {
        // Already has an account → sign in and attach.
        if (e?.code === "auth/email-already-in-use") {
          return (await signInWithEmailAndPassword(auth, invite.email, password)).user;
        }
        throw e;
      }
    });

  const acceptWithGoogle = () =>
    finish(async () => {
      const { getAuth, GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
      const app = (await import("@/lib/firebase/firebaseClient")).default;
      return (await signInWithPopup(getAuth(app), new GoogleAuthProvider())).user;
    });

  const brandName = tenant?.name || invite?.parentName || "the portal";
  const field =
    "w-full rounded-lg bg-[#0a141f] border border-[#4590e2]/20 px-4 py-3 text-white placeholder-[#5a7590] focus:border-[#4590e2] focus:outline-none text-sm";

  return (
    <div className="min-h-screen bg-[#0a141f] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {loading ? (
          <div className="h-64 bg-[#0d1e30] rounded-2xl animate-pulse" />
        ) : !invite || invite.error || invite.status === "accepted" ? (
          <div className="rounded-2xl border border-[#4590e2]/20 bg-[#0d1e30] p-8 text-center">
            <p className="text-white font-semibold">This invite isn&apos;t valid.</p>
            <p className="text-[#7a9bb5] text-sm mt-1">
              It may have expired or already been used. Ask your provider for a new one.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#4590e2]/20 bg-[#0d1e30] p-8">
            {tenant?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logoUrl} alt={brandName} className="h-12 object-contain mb-4" />
            )}
            <h1 className="text-2xl font-bold text-white">Join {brandName}</h1>
            <p className="text-[#7a9bb5] text-sm mt-1">
              You&apos;ve been invited as <span className="text-white">{invite.email}</span>. Set a
              password to finish setting up your account.
            </p>

            <div className="mt-6 space-y-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                className={field}
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                onClick={acceptWithPassword}
                disabled={busy || password.length < 6}
                className="w-full rounded-lg bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#3a7bc8] disabled:opacity-60"
              >
                {busy ? "Setting up…" : "Accept invite"}
              </button>
              <button
                onClick={acceptWithGoogle}
                disabled={busy}
                className="w-full rounded-lg border border-[#4590e2]/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4590e2]/10 disabled:opacity-60"
              >
                Continue with Google
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
