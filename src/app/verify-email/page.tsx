"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Helper: lazily get Firebase auth (safe on server — never called during SSR)
async function getFirebaseAuth() {
  const { getAuth } = await import("firebase/auth");
  const { default: firebase_app } = await import("@/lib/firebase/firebaseClient");
  return getAuth(firebase_app);
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On mount (client only): check auth state and redirect if needed
  useEffect(() => {
    getFirebaseAuth().then((auth) => {
      const user = auth.currentUser;
      if (!user) {
        router.replace("/login");
        return;
      }
      if (user.emailVerified || user.providerData[0]?.providerId !== "password") {
        router.replace("/app/dashboard");
        return;
      }
      setUserEmail(user.email);
    });
  }, [router]);

  const handleContinue = async () => {
    setChecking(true);
    setError(null);
    try {
      const { reload } = await import("firebase/auth");
      const auth = await getFirebaseAuth();
      await reload(auth.currentUser!);
      if (auth.currentUser?.emailVerified) {
        router.push("/app/dashboard");
      } else {
        setError("Email not verified yet. Please check your inbox and click the link.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    try {
      const { sendEmailVerification } = await import("firebase/auth");
      const auth = await getFirebaseAuth();
      await sendEmailVerification(auth.currentUser!);
      setResent(true);
    } catch (err: any) {
      if (err?.code === "auth/too-many-requests") {
        setError("Too many requests. Please wait a few minutes before resending.");
      } else {
        setError("Failed to resend verification email. Please try again.");
      }
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    const auth = await getFirebaseAuth();
    await auth.signOut();
    router.push("/login");
  };

  return (
    <div className="relative min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="neon-card p-8 space-y-6 text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 mx-auto">
            <svg
              className="w-8 h-8 text-[var(--accent)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Check your inbox</h1>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed">
              We sent a verification link to{" "}
              <span className="text-[var(--text)] font-medium">{userEmail}</span>.
              Click the link to activate your account.
            </p>
          </div>

          {error && (
            <div className="text-sm text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {resent && !error && (
            <div className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-3">
              Verification email resent — check your inbox.
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleContinue}
              disabled={checking}
              className="neon-primary-btn w-full py-3 font-semibold disabled:opacity-60"
            >
              {checking ? "Checking…" : "I've verified my email →"}
            </button>

            <button
              onClick={handleResend}
              disabled={resending}
              className="neon-outline-btn w-full py-3 font-semibold disabled:opacity-60"
            >
              {resending ? "Sending…" : "Resend verification email"}
            </button>
          </div>

          <button
            onClick={handleSignOut}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] underline"
          >
            Sign out and use a different account
          </button>
        </div>
      </div>
    </div>
  );
}
