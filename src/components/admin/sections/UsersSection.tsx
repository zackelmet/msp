"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faSave,
  faUserShield,
  faBuilding,
} from "@fortawesome/free-solid-svg-icons";

/**
 * Users admin section (formerly /admin/users). Renders inside the consolidated
 * AdminConsole tabs; page chrome (full-screen wrapper, back arrow) removed.
 */
export default function UsersSection() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [elevating, setElevating] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [creditEdits, setCreditEdits] = useState<
    Record<string, Record<string, number>>
  >({});

  // Elevate a self-serve reseller into a distributor (their own supplier tree).
  const makeDistributor = async (uid: string, email: string) => {
    if (
      !confirm(
        `Make ${email} a distributor? This creates their own supplier tree and moves them to supplier_admin. They'll then activate billing (card or net-30).`,
      )
    )
      return;
    setElevating(uid);
    setNote(null);
    try {
      const res = await fetch("/api/admin/orgs/elevate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Elevation failed");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === uid ? { ...u, role: "supplier_admin", orgId: d.supplierOrgId } : u,
        ),
      );
      setNote(`✓ ${email} is now a distributor (${d.supplierOrgId}). Activate their billing next.`);
    } catch (e: any) {
      setNote(`✗ ${e.message || "Elevation failed"}`);
    }
    setElevating(null);
  };

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/all-users");
      if (res.status === 403) {
        router.replace("/app/dashboard");
        return;
      }
      const data = await res.json();
      setUsers(data);
      setFiltered(data);
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    const q = query.toLowerCase();
    setFiltered(
      q ? users.filter((u) => u.email?.toLowerCase().includes(q)) : users,
    );
  }, [query, users]);

  const handleCreditChange = (uid: string, key: string, val: string) => {
    setCreditEdits((prev) => ({
      ...prev,
      [uid]: { ...(prev[uid] || {}), [key]: parseInt(val, 10) || 0 },
    }));
  };

  const saveCredits = async (uid: string) => {
    const credits = creditEdits[uid];
    if (!credits) return;
    setSaving(uid);
    await fetch("/api/admin/update-credits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUid: uid, credits }),
    });
    setUsers((prev) =>
      prev.map((u) =>
        u.id === uid
          ? { ...u, credits: { ...(u.credits || {}), ...credits } }
          : u,
      ),
    );
    setCreditEdits((prev) => {
      const n = { ...prev };
      delete n[uid];
      return n;
    });
    setSaving(null);
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        <FontAwesomeIcon
          icon={faSearch}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7a9bb5]"
        />
        <input
          className="w-full bg-[#0d1e30] border border-[#4590e2]/20 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-[#7a9bb5] focus:outline-none focus:border-[#4590e2]/50"
          placeholder="Search by email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {note && (
        <div className="rounded-lg border border-[#4590e2]/25 bg-[#4590e2]/10 px-4 py-2.5 text-sm text-[#a9c6dd]">
          {note}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-[#0d1e30] rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl overflow-hidden divide-y divide-[#4590e2]/10">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-[#7a9bb5] text-sm">
              No users found.
            </p>
          ) : (
            filtered.map((u) => {
              const credits: Record<string, number> = u.credits || {};
              const allKeys = Array.from(
                new Set([...Object.keys(credits), "web_app"]),
              );
              return (
                <div
                  key={u.id}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {u.isAdmin && (
                      <FontAwesomeIcon
                        icon={faUserShield}
                        className="w-3.5 h-3.5 text-[#4590e2] shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {u.email}
                      </p>
                      <p className="text-xs text-[#7a9bb5] truncate">{u.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {allKeys.map((key) => (
                      <div key={key} className="flex items-center gap-1">
                        <span className="text-xs text-[#7a9bb5]">{key}:</span>
                        <input
                          type="number"
                          className="w-14 bg-[#0a141f] border border-[#4590e2]/20 rounded px-2 py-0.5 text-xs text-white text-center focus:outline-none focus:border-[#4590e2]/50"
                          defaultValue={credits[key] ?? 0}
                          onChange={(e) =>
                            handleCreditChange(u.id, key, e.target.value)
                          }
                        />
                      </div>
                    ))}
                    {creditEdits[u.id] && (
                      <button
                        onClick={() => saveCredits(u.id)}
                        disabled={saving === u.id}
                        className="flex items-center gap-1 px-2 py-1 bg-[var(--brand)] hover:bg-[#3a7bc8] text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                      >
                        <FontAwesomeIcon
                          icon={faSave}
                          className="w-2.5 h-2.5"
                        />
                        {saving === u.id ? "…" : "Save"}
                      </button>
                    )}
                    {u.role === "reseller_admin" && (
                      <button
                        onClick={() => makeDistributor(u.id, u.email)}
                        disabled={elevating === u.id}
                        title="Create their own supplier tree and promote to distributor"
                        className="flex items-center gap-1.5 px-2.5 py-1 border border-[#4590e2]/40 text-[#a9c6dd] hover:bg-[#4590e2]/10 text-xs rounded-lg transition-colors disabled:opacity-50"
                      >
                        <FontAwesomeIcon icon={faBuilding} className="w-2.5 h-2.5" />
                        {elevating === u.id ? "Elevating…" : "Make distributor"}
                      </button>
                    )}
                    {u.role === "supplier_admin" && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-medium">
                        Distributor
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
