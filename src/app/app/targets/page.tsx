"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLayerGroup, faPlus, faTrash, faPencil, faChevronRight,
} from "@fortawesome/free-solid-svg-icons";

const ENV_META: Record<string, { label: string; color: string }> = {
  web:     { label: "Web App",  color: "text-blue-400 bg-blue-400/10 border-blue-400/25"      },
  network: { label: "Network",  color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25" },
  cloud:   { label: "Cloud",    color: "text-purple-400 bg-purple-400/10 border-purple-400/25" },
  mobile:  { label: "Mobile",   color: "text-green-400 bg-green-400/10 border-green-400/25"   },
  mixed:   { label: "Mixed",    color: "text-orange-400 bg-orange-400/10 border-orange-400/25" },
};

export default function TargetsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    (async () => {
      const { getAuth, onAuthStateChanged } = await import("firebase/auth");
      const firebase_app = (await import("@/lib/firebase/firebaseClient")).default;
      const auth = getAuth(firebase_app);

      onAuthStateChanged(auth, async (user) => {
        if (!user) { router.replace("/login"); return; }
        const t = await user.getIdToken();
        setToken(t);
        const res = await fetch("/api/target-groups", { headers: { Authorization: `Bearer ${t}` } });
        const data = await res.json();
        setGroups(data.groups || []);
        setLoading(false);
      });
    })();
  }, [router]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this target group?")) return;
    setDeleting(id);
    await fetch(`/api/target-groups/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setDeleting(null);
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Target Groups</h1>
            <p className="text-[#7a9bb5] text-sm mt-1">Define client environments and the assets within them.</p>
          </div>
          <Link
            href="/app/targets/new"
            className="flex items-center gap-2 px-4 py-2 bg-[#4590e2] hover:bg-[#3a7bc8] text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
            New Group
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-5 animate-pulse h-36" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FontAwesomeIcon icon={faLayerGroup} className="w-10 h-10 text-[#4590e2]/20 mb-4" />
            <p className="text-white font-semibold">No target groups yet</p>
            <p className="text-[#7a9bb5] text-sm mt-1">Create your first group to start scheduling pentests.</p>
            <Link
              href="/app/targets/new"
              className="mt-4 px-4 py-2 bg-[#4590e2] hover:bg-[#3a7bc8] text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Create Target Group
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => {
              const env = ENV_META[g.envType] || ENV_META.mixed;
              return (
                <div
                  key={g.id}
                  className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-5 hover:border-[#4590e2]/35 transition-colors flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-semibold text-sm">{g.name}</p>
                      <p className="text-[#7a9bb5] text-xs mt-0.5">{g.clientName || "No client"}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${env.color}`}>
                      {env.label}
                    </span>
                  </div>
                  <div className="text-xs text-[#7a9bb5]">
                    <span className="text-white font-medium">{g.assetCount ?? 0}</span>{" "}
                    asset{(g.assetCount ?? 0) !== 1 ? "s" : ""}
                    {g.notes && <p className="mt-1 truncate opacity-70">{g.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3 mt-auto pt-2 border-t border-[#4590e2]/10">
                    <Link
                      href={`/app/targets/${g.id}`}
                      className="flex items-center gap-1 text-xs text-[#4590e2] hover:underline"
                    >
                      <FontAwesomeIcon icon={faPencil} className="w-2.5 h-2.5" />
                      Edit
                    </Link>
                    <Link
                      href={`/app/schedule?targetGroupId=${g.id}`}
                      className="flex items-center gap-1 text-xs text-purple-400 hover:underline"
                    >
                      Schedule
                      <FontAwesomeIcon icon={faChevronRight} className="w-2.5 h-2.5" />
                    </Link>
                    <button
                      onClick={() => handleDelete(g.id)}
                      disabled={deleting === g.id}
                      className="ml-auto text-xs text-red-400/50 hover:text-red-400 transition-colors disabled:opacity-40"
                    >
                      <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
