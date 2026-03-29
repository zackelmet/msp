"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faTriangleExclamation, faTrash, faShield } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "@/lib/context/AuthContext";

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const router = useRouter();

  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm" | "reauth" | "deleting">("idle");
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [memberSince, setMemberSince] = useState("");

  useEffect(() => {
    if (currentUser?.metadata?.creationTime) {
      setMemberSince(new Date(currentUser.metadata.creationTime).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      }));
    }
  }, [currentUser]);

  const handleDeleteAccount = async () => {
    setDeleteError("");
    setDeleteStep("deleting");
    try {
      const { getAuth, reauthenticateWithCredential, EmailAuthProvider, deleteUser } = await import("firebase/auth");
      const firebase_app = (await import("@/lib/firebase/firebaseClient")).default;
      const auth = getAuth(firebase_app);
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");

      // Re-authenticate first if email/password provider
      const isEmailProvider = user.providerData.some((p) => p.providerId === "password");
      if (isEmailProvider) {
        if (!password) {
          setDeleteStep("reauth");
          setDeleteError("Please enter your password to confirm.");
          return;
        }
        const credential = EmailAuthProvider.credential(user.email!, password);
        await reauthenticateWithCredential(user, credential);
      }

      // Delete Firestore user doc via API then delete auth user
      await fetch("/api/users/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid }),
      });

      await deleteUser(user);
      router.replace("/login");
    } catch (err: any) {
      const msg = err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential"
        ? "Incorrect password. Please try again."
        : err?.message || "Failed to delete account.";
      setDeleteError(msg);
      setDeleteStep("reauth");
    }
  };

  const inputCls = "w-full bg-[#0a141f] border border-[#4590e2]/20 rounded-lg px-3 py-2 text-sm text-white placeholder-[#7a9bb5] focus:outline-none focus:border-[#4590e2]/60 transition-colors disabled:opacity-50 cursor-not-allowed font-mono";

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-[#7a9bb5] text-sm mt-1">Your account information and preferences.</p>
        </div>

        {/* Account Info Card */}
        <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#4590e2]/15 border border-[#4590e2]/25 flex items-center justify-center">
              <FontAwesomeIcon icon={faUser} className="w-4 h-4 text-[#4590e2]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Account</h2>
              <p className="text-xs text-[#7a9bb5]">Your profile details</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-[#7a9bb5]">Email address</label>
              <input
                type="email"
                value={currentUser?.email || ""}
                disabled
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#7a9bb5]">Account ID</label>
              <input
                type="text"
                value={currentUser?.uid || ""}
                disabled
                className={inputCls + " text-xs"}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#7a9bb5]">Member since</label>
              <input
                type="text"
                value={memberSince || "—"}
                disabled
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#7a9bb5]">Sign-in providers</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {currentUser?.providerData?.map((p) => (
                  <span
                    key={p.providerId}
                    className="text-xs px-2 py-0.5 rounded-full bg-[#4590e2]/10 border border-[#4590e2]/25 text-[#7ab8f5]"
                  >
                    {p.providerId === "password" ? "Email / Password" :
                     p.providerId === "google.com" ? "Google" :
                     p.providerId === "microsoft.com" ? "Microsoft" :
                     p.providerId}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Security Card */}
        <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#4590e2]/15 border border-[#4590e2]/25 flex items-center justify-center">
              <FontAwesomeIcon icon={faShield} className="w-4 h-4 text-[#4590e2]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Security</h2>
              <p className="text-xs text-[#7a9bb5]">Manage your account security</p>
            </div>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-[#4590e2]/10">
            <div>
              <p className="text-sm text-white">Email verified</p>
              <p className="text-xs text-[#7a9bb5] mt-0.5">
                {currentUser?.emailVerified ? "Your email has been verified." : "Your email is not yet verified."}
              </p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${
              currentUser?.emailVerified
                ? "text-green-400 bg-green-400/10 border-green-400/30"
                : "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
            }`}>
              {currentUser?.emailVerified ? "Verified" : "Unverified"}
            </span>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-[#0d1e30] border border-red-500/20 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <FontAwesomeIcon icon={faTriangleExclamation} className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Danger Zone</h2>
              <p className="text-xs text-[#7a9bb5]">Irreversible account actions</p>
            </div>
          </div>

          {deleteStep === "idle" && (
            <div className="flex items-start justify-between gap-4 pt-2 border-t border-red-500/10">
              <div>
                <p className="text-sm text-white">Delete account</p>
                <p className="text-xs text-[#7a9bb5] mt-0.5">
                  Permanently remove your account and all associated data. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setDeleteStep("confirm")}
                className="shrink-0 px-3 py-1.5 text-xs font-semibold text-red-400 border border-red-400/30 hover:bg-red-400/10 rounded-lg transition-colors"
              >
                Delete account
              </button>
            </div>
          )}

          {deleteStep === "confirm" && (
            <div className="space-y-4 pt-2 border-t border-red-500/10">
              <p className="text-sm text-red-300 font-semibold">Are you absolutely sure?</p>
              <p className="text-xs text-[#7a9bb5]">
                This will permanently delete your account, all target groups, scheduled tests, and pentest data.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteStep("idle")}
                  className="px-4 py-2 text-xs font-semibold text-white border border-[#4590e2]/30 hover:bg-[#4590e2]/10 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const isEmailProvider = currentUser?.providerData?.some((p) => p.providerId === "password");
                    setDeleteStep(isEmailProvider ? "reauth" : "deleting");
                    if (!isEmailProvider) handleDeleteAccount();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg transition-colors"
                >
                  Yes, delete my account
                </button>
              </div>
            </div>
          )}

          {deleteStep === "reauth" && (
            <div className="space-y-4 pt-2 border-t border-red-500/10">
              <p className="text-sm text-white">Confirm your password to continue</p>
              {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a141f] border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white placeholder-[#7a9bb5] focus:outline-none focus:border-red-500/60 transition-colors"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setDeleteStep("idle"); setPassword(""); setDeleteError(""); }}
                  className="px-4 py-2 text-xs font-semibold text-white border border-[#4590e2]/30 hover:bg-[#4590e2]/10 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={!password}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg transition-colors disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={faTrash} className="w-3 h-3 mr-1.5" />
                  Delete permanently
                </button>
              </div>
            </div>
          )}

          {deleteStep === "deleting" && (
            <div className="flex items-center gap-3 py-2 border-t border-red-500/10">
              <div className="w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
              <p className="text-sm text-[#7a9bb5]">Deleting your account...</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
