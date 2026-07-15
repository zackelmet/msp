"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarCheck,
  faCircleCheck,
  faShieldHalved,
  faLayerGroup,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  approved: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  running: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  completed: "text-green-400 bg-green-400/10 border-green-400/30",
  cancelled: "text-red-400 bg-red-400/10 border-red-400/30",
};

/**
 * Monitoring — usage + recent pentest activity. The Acronis "Monitoring"
 * section: at-a-glance counts and the latest runs. (Subtree usage rollup for
 * distributors/resellers is a later iteration; this covers the caller's activity.)
 */
export default function MonitoringPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    targetGroups: 0,
    scheduledTests: 0,
    completedTests: 0,
    activePentests: 0,
  });
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        const h = { Authorization: `Bearer ${await user.getIdToken()}` };
        try {
          const [tgRes, stRes] = await Promise.all([
            fetch("/api/target-groups", { headers: h }),
            fetch("/api/scheduled-tests", { headers: h }),
          ]);
          const [tg, st] = await Promise.all([tgRes.json(), stRes.json()]);
          const tests: any[] = st.tests || [];
          setStats({
            targetGroups: (tg.groups || []).length,
            scheduledTests: tests.length,
            completedTests: tests.filter((t) => t.status === "completed").length,
            activePentests: tests.filter((t) =>
              ["running", "completed"].includes(t.status),
            ).length,
          });
          setRecent(tests.slice(0, 8));
        } catch {
          /* leave zeros */
        }
        setLoading(false);
      });
      return unsub;
    })();
  }, [router]);

  const cards = [
    { label: "Clients", value: stats.targetGroups, icon: faLayerGroup, color: "text-[#4590e2]", border: "border-[#4590e2]/20" },
    { label: "Scheduled", value: stats.scheduledTests, icon: faCalendarCheck, color: "text-purple-400", border: "border-purple-500/20" },
    { label: "Completed", value: stats.completedTests, icon: faCircleCheck, color: "text-green-400", border: "border-green-500/20" },
    { label: "Active Pentests", value: stats.activePentests, icon: faShieldHalved, color: "text-yellow-400", border: "border-yellow-500/20" },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-8 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-white">Monitoring</h1>
          <p className="text-[#7a9bb5] mt-1 text-sm">
            Usage and recent pentest activity.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? [...Array(4)].map((_, i) => (
                <div key={i} className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-5 animate-pulse h-24" />
              ))
            : cards.map((s) => (
                <div key={s.label} className={`bg-[#0d1e30] border ${s.border} rounded-xl p-5`}>
                  <FontAwesomeIcon icon={s.icon} className={`w-4 h-4 ${s.color} mb-3`} />
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-[#7a9bb5] text-xs mt-1">{s.label}</p>
                </div>
              ))}
        </div>

        <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#4590e2]/10">
            <h2 className="text-white font-medium text-sm">Recent activity</h2>
            <Link href="/app/pentests" className="text-[#4590e2] text-xs flex items-center gap-1 hover:text-white">
              View all <FontAwesomeIcon icon={faArrowRight} className="w-2.5 h-2.5" />
            </Link>
          </div>
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-[#0a141f] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <p className="px-5 py-8 text-center text-[#7a9bb5] text-sm">No pentest activity yet.</p>
          ) : (
            <div className="divide-y divide-[#4590e2]/10">
              {recent.map((t, i) => (
                <div key={t.id || i} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-sm text-white flex-1 truncate">
                    {t.targetUrl || t.name || t.batchName || "Pentest"}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border capitalize ${
                      STATUS_COLORS[t.status] || "text-[#7a9bb5] bg-white/5 border-white/10"
                    }`}
                  >
                    {t.status || "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
