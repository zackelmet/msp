"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserGroup,
  faStore,
  faShieldHalved,
  faGaugeHigh,
} from "@fortawesome/free-solid-svg-icons";

/**
 * Overview — the consolidated control-plane summary for a distributor/reseller:
 * their subtree size + AI-pentest IP usage, from the scoped /api/orgs data.
 * (No legacy target-group / scheduled-test stats — those don't exist in the
 * one-product-per-IP model.)
 */
export default function OverviewPage() {
  const router = useRouter();
  const [data, setData] = useState<{
    orgs: { type: string }[];
    pools: { consumed?: { ip?: number }; purchased?: { ip?: number } }[];
    caps: { caps?: { ip?: number } }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { getAuth, onAuthStateChanged } = await import("firebase/auth");
      const app = (await import("@/lib/firebase/firebaseClient")).default;
      const auth = getAuth(app);
      const unsub = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          router.replace("/login");
          return;
        }
        try {
          const res = await fetch("/api/orgs", {
            headers: { Authorization: `Bearer ${await user.getIdToken()}` },
          });
          if (!res.ok) throw new Error(`Failed to load overview (${res.status})`);
          setData(await res.json());
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Failed to load overview");
        } finally {
          setLoading(false);
        }
      });
      return unsub;
    })();
  }, [router]);

  const orgs = data?.orgs ?? [];
  const pools = data?.pools ?? [];
  const caps = data?.caps ?? [];
  const resellers = orgs.filter((o) => o.type === "reseller").length;
  const clients = orgs.filter((o) => o.type === "client").length;
  const consumed = pools[0]?.consumed?.ip ?? 0;
  const purchased = pools[0]?.purchased?.ip ?? 0;
  const allocated = caps.reduce((s, c) => s + (c?.caps?.ip ?? 0), 0);

  const cards = [
    { label: "Clients", value: clients, icon: faUserGroup, color: "text-green-400", border: "border-green-500/20" },
    { label: "Resellers", value: resellers, icon: faStore, color: "text-purple-400", border: "border-purple-500/20" },
    { label: "IPs consumed (cycle)", value: consumed, icon: faShieldHalved, color: "text-[#4590e2]", border: "border-[#4590e2]/20" },
    { label: "IP quota allocated", value: allocated, icon: faGaugeHigh, color: "text-yellow-400", border: "border-yellow-500/20" },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-8 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-[#7a9bb5] mt-1 text-sm">
            Your consolidated AI-pentest usage and organization.
          </p>
        </div>

        {err ? (
          <div className="bg-[#0d1e30] border border-red-400/30 rounded-xl p-6 text-red-400 text-sm">
            {err}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {loading
              ? [...Array(4)].map((_, i) => (
                  <div key={i} className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-5 animate-pulse h-24" />
                ))
              : cards.map((s) => (
                  <div key={s.label} className={`bg-[#0d1e30] border ${s.border} rounded-xl p-5`}>
                    <FontAwesomeIcon icon={s.icon} className={`w-4 h-4 ${s.color} mb-3`} />
                    <p className="text-2xl font-bold text-white tabular-nums">{s.value}</p>
                    <p className="text-[#7a9bb5] text-xs mt-1">{s.label}</p>
                  </div>
                ))}
          </div>
        )}

        {!loading && !err && purchased > 0 && (
          <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-5">
            <p className="text-xs uppercase tracking-wide text-[#7a9bb5] mb-2">
              Pool consumption this cycle
            </p>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-xl font-bold text-white tabular-nums">{consumed}</span>
              <span className="text-xs text-[#7a9bb5]">/ {purchased} IPs</span>
            </div>
            <div className="h-2 bg-[#0a141f] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#4590e2] rounded-full"
                style={{ width: `${Math.min(100, purchased ? (consumed / purchased) * 100 : 0)}%` }}
              />
            </div>
          </div>
        )}

        {!loading && !err && clients === 0 && resellers === 0 && (
          <p className="text-[#7a9bb5] text-sm">
            No clients or resellers yet — add them from the Platform tab.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
