"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLayerGroup,
  faPlus,
  faTrash,
  faPencil,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";

const ENV_META: Record<string, { label: string; color: string }> = {
  web: {
    label: "Web App",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/25",
  },
  network: {
    label: "Network",
    color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25",
  },
  cloud: {
    label: "Cloud",
    color: "text-purple-400 bg-purple-400/10 border-purple-400/25",
  },
  mobile: {
    label: "Mobile",
    color: "text-green-400 bg-green-400/10 border-green-400/25",
  },
  mixed: {
    label: "Mixed",
    color: "text-orange-400 bg-orange-400/10 border-orange-400/25",
  },
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
      const firebase_app = (await import("@/lib/firebase/firebaseClient"))
        .default;
      const auth = getAuth(firebase_app);

      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          router.replace("/login");
          return;
        }
        const t = await user.getIdToken();
        setToken(t);
        const res = await fetch("/api/target-groups", {
          headers: { Authorization: `Bearer ${t}` },
        });
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
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Target Groups</h1>
          <p className="text-[#7a9bb5] text-sm mt-1">
            Define client environments and the assets within them.
          </p>
        </div>
        <Link
          href="/app/targets/new"
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[#3a7bc8] text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
          New Group
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-5 animate-pulse h-36"
            />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center py-10 text-center bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl px-8">
            <div className="w-14 h-14 rounded-xl bg-[#4590e2]/10 border border-[#4590e2]/20 flex items-center justify-center mb-4">
              <FontAwesomeIcon
                icon={faLayerGroup}
                className="w-6 h-6 text-[#4590e2]"
              />
            </div>
            <p className="text-white font-semibold text-base">
              No target groups yet
            </p>
            <p className="text-[#7a9bb5] text-sm mt-2 max-w-sm">
              Target groups let you organise the environments and assets you
              want tested — one group per client or project.
            </p>
            <Link
              href="/app/targets/new"
              className="mt-5 px-5 py-2.5 bg-[var(--brand)] hover:bg-[#3a7bc8] text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Create your first group
            </Link>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                title: "Group by client or project",
                body: "Keep each client's assets separate so you can schedule tests independently.",
              },
              {
                title: "Track asset inventory",
                body: "Add URLs, IPs, CIDR ranges, and domains — all stored alongside the group.",
              },
              {
                title: "Schedule in one click",
                body: "Once a group exists, scheduling a pentest takes seconds from this page.",
              },
            ].map((tip) => (
              <div
                key={tip.title}
                className="bg-[#0d1e30] border border-[#4590e2]/10 rounded-xl p-4"
              >
                <p className="text-sm font-semibold text-white mb-1">
                  {tip.title}
                </p>
                <p className="text-xs text-[#7a9bb5] leading-relaxed">
                  {tip.body}
                </p>
              </div>
            ))}
          </div>
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
                    <p className="text-[#7a9bb5] text-xs mt-0.5">
                      {g.clientName || "No client"}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${env.color}`}
                  >
                    {env.label}
                  </span>
                </div>
                <div className="text-xs text-[#7a9bb5]">
                  <span className="text-white font-medium">
                    {g.assetCount ?? 0}
                  </span>{" "}
                  asset{(g.assetCount ?? 0) !== 1 ? "s" : ""}
                  {g.notes && (
                    <p className="mt-1 truncate opacity-70">{g.notes}</p>
                  )}
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
                    <FontAwesomeIcon
                      icon={faChevronRight}
                      className="w-2.5 h-2.5"
                    />
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
  );
}
