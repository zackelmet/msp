"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";

const ENV_TYPES = ["web", "network", "cloud", "mobile", "mixed"] as const;

interface Asset {
  id: string;
  label: string;
  value: string;
  type: "url" | "ip" | "cidr" | "domain" | "other";
}

export default function NewTargetGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [envType, setEnvType] = useState<string>("web");
  const [notes, setNotes] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetLabel, setAssetLabel] = useState("");
  const [assetValue, setAssetValue] = useState("");
  const [assetType, setAssetType] = useState<Asset["type"]>("url");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addAsset = () => {
    if (!assetValue.trim()) return;
    setAssets((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: assetLabel.trim() || assetValue.trim(), value: assetValue.trim(), type: assetType },
    ]);
    setAssetLabel("");
    setAssetValue("");
  };

  const removeAsset = (id: string) => setAssets((prev) => prev.filter((a) => a.id !== id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Group name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const { getAuth } = await import("firebase/auth");
      const firebase_app = (await import("@/lib/firebase/firebaseClient")).default;
      const user = getAuth(firebase_app).currentUser;
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();
      const res = await fetch("/api/target-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), clientName: clientName.trim(), envType, assets, notes: notes.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
      router.push("/app/targets");
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-[#0a141f] border border-[#4590e2]/20 rounded-lg px-3 py-2 text-sm text-white placeholder-[#7a9bb5] focus:outline-none focus:border-[#4590e2]/60 transition-colors";

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/app/targets" className="text-[#7a9bb5] hover:text-white transition-colors">
            <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-bold text-white">New Target Group</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Group Details</h2>
            <div className="space-y-1">
              <label className="text-xs text-[#7a9bb5]">Group Name *</label>
              <input className={inputCls} placeholder="e.g. Acme Corp Web" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#7a9bb5]">Client Name</label>
              <input className={inputCls} placeholder="e.g. Acme Corporation" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#7a9bb5]">Environment Type</label>
              <select className={inputCls} value={envType} onChange={(e) => setEnvType(e.target.value)}>
                {ENV_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#7a9bb5]">Notes</label>
              <textarea className={inputCls + " resize-none"} rows={3} placeholder="Scope notes, exclusions, etc." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Assets</h2>
            {assets.length > 0 && (
              <div className="space-y-2">
                {assets.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 bg-[#0a141f] rounded-lg px-3 py-2">
                    <span className="text-xs text-[#7a9bb5] w-12 shrink-0">{a.type}</span>
                    <span className="text-sm text-white flex-1 truncate">{a.value}</span>
                    {a.label !== a.value && <span className="text-xs text-[#7a9bb5]">{a.label}</span>}
                    <button type="button" onClick={() => removeAsset(a.id)} className="text-red-400/50 hover:text-red-400 transition-colors">
                      <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <select className={inputCls} value={assetType} onChange={(e) => setAssetType(e.target.value as Asset["type"])}>
                {(["url","ip","cidr","domain","other"] as const).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input className={inputCls} placeholder="Value (e.g. 10.0.0.1)" value={assetValue} onChange={(e) => setAssetValue(e.target.value)} />
              <input className={inputCls} placeholder="Label (optional)" value={assetLabel} onChange={(e) => setAssetLabel(e.target.value)} />
            </div>
            <button type="button" onClick={addAsset} className="flex items-center gap-1 text-xs text-[#4590e2] hover:underline">
              <FontAwesomeIcon icon={faPlus} className="w-2.5 h-2.5" />
              Add asset
            </button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-[var(--brand)] hover:bg-[#3a7bc8] disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            {saving ? "Saving..." : "Create Target Group"}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
