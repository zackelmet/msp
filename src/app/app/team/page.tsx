"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserPlus, faCopy, faCircleCheck } from "@fortawesome/free-solid-svg-icons";

/**
 * Distributor "Team" — invite resellers onto your tree (invite-only). Generates a
 * branded invite link; the invitee sets up an account on our platform, parented
 * under you as a reseller.
 */
export default function TeamPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invite = async () => {
    setBusy(true);
    setError(null);
    setLink(null);
    try {
      const { getAuth } = await import("firebase/auth");
      const app = (await import("@/lib/firebase/firebaseClient")).default;
      const user = getAuth(app).currentUser;
      if (!user) {
        router.replace("/login");
        return;
      }
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ email: email.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not create invite");
      setLink(d.inviteUrl);
      setEmail("");
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    }
    setBusy(false);
  };

  const copy = () => {
    if (!link) return;
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const field =
    "w-full rounded-lg bg-[#0a141f] border border-[#4590e2]/20 px-4 py-3 text-white placeholder-[#5a7590] focus:border-[#4590e2] focus:outline-none text-sm";

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="text-[#7a9bb5] mt-1 text-sm">
            Invite your resellers. They set up an account on the platform, under you —
            their usage rolls up to your consolidated bill.
          </p>
        </div>

        <div className="bg-[#0d1e30] border border-[#4590e2]/20 rounded-xl p-6 space-y-4">
          <label className="block text-xs uppercase tracking-wide text-[#7a9bb5]">
            Reseller email
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="reseller@company.com"
              className={field}
            />
            <button
              onClick={invite}
              disabled={busy || !email.trim()}
              className="shrink-0 flex items-center gap-2 rounded-lg bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#3a7bc8] disabled:opacity-60"
            >
              <FontAwesomeIcon icon={faUserPlus} className="w-3.5 h-3.5" />
              {busy ? "…" : "Invite"}
            </button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}

          {link && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="flex items-center gap-2 text-sm text-emerald-100">
                <FontAwesomeIcon icon={faCircleCheck} className="w-4 h-4 text-emerald-400" />
                Invite created. Send them this link:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-[#0a141f] px-3 py-2 text-xs text-[#a9c6dd]">
                  {link}
                </code>
                <button
                  onClick={copy}
                  className="shrink-0 flex items-center gap-1.5 rounded-md border border-[#4590e2]/30 px-3 py-2 text-xs text-[#a9c6dd] hover:bg-[#4590e2]/10"
                >
                  <FontAwesomeIcon icon={faCopy} className="w-3 h-3" />
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-emerald-200/70">
                We also emailed it to them (if email is configured).
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
