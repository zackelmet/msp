"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLayerGroup,
  faCalendarCheck,
  faCircleCheck,
  faShieldHalved,
  faChevronRight,
  faPlus,
  faClock,
} from "@fortawesome/free-solid-svg-icons";

const STATUS_COLORS: Record<string, string> = {
  pending:   "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  approved:  "text-blue-400 bg-blue-400/10 border-blue-400/30",
  running:   "text-purple-400 bg-purple-400/10 border-purple-400/30",
  completed: "text-green-400 bg-green-400/10 border-green-400/30",
  cancelled: "text-red-400 bg-red-400/10 border-red-400/30",
};

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [stats, setStats] = useState({ targetGroups: 0, scheduledTests: 0, completedTests: 0, totalPentests: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { getAuth, onAuthStateChanged } = await import("firebase/auth");
      const firebase_app = (await import("@/lib/firebase/firebaseClient")).default;
      const auth = getAuth(firebase_app);

      const unsub = onAuthStateChanged(auth, async (user) => {
        if (!user) { router.replace("/login"); return; }
        setUserName(user.email?.split("@")[0] || "there");
        const token = await user.getIdToken();
        const h = { Authorization: `Bearer ${token}` };

        const [tgRes, stRes] = await Promise.all([
          fetch("/api/target-groups", { headers: h }),
          fetch("/api/scheduled-tests", { headers: h }),
        ]);
        const [tgData, stData] = await Promise.all([tgRes.json(), stRes.json()]);

        const allTests: any[] = stData.tests || [];
        setStats({
          targetGroups: (tgData.groups || []).length,
          scheduledTests: allTests.length,
          completedTests: allTests.filter((t) => t.status === "completed").length,
          totalPentests: allTests.filter((t) => ["running", "completed"].includes(t.status)).length,
        });
        setRecent(allTests.slice(0, 5));
        setLoading(false);
      });

      return unsub;
    })();
  }, [router]);

  const statCards = [
    { label: "Target Groups",   value: stats.targetGroups,   icon: faLayerGroup,    href: "/app/targets",  color: "text-[#4590e2]",  border: "border-[#4590e2]/20" },
    { label: "Scheduled Tests", value: stats.scheduledTests, icon: faCalendarCheck, href: "/app/schedule", color: "text-purple-400", border: "border-purple-500/20" },
    { label: "Completed Tests", value: stats.completedTests, icon: faCircleCheck,   href: "/app/schedule", color: "text-green-400",  border: "border-green-500/20"  },
    { label: "Active Pentests", value: stats.totalPentests,  icon: faShieldHalved,  href: "/app/pentests", color: "text-yellow-400", border: "border-yellow-500/20" },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Welcome back, <span className="text-[#4590e2]">{userName}</span>
            </h1>
            <p className="text-[#7a9bb5] mt-1 text-sm">Here&apos;s an overview of your pentest activity.</p>
          </div>
          <Link
            href="/app/schedule"
            className="flex items-center gap-2 px-4 py-2 bg-[#4590e2] hover:bg-[#3a7bc8] text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
            Schedule Test
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? [...Array(4)].map((_, i) => (
                <div key={i} className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-5 animate-pulse h-24" />
              ))
            : statCards.map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  className={`bg-[#0d1e30] border ${s.border} rounded-xl p-5 hover:opacity-90 transition-opacity group`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <FontAwesomeIcon icon={s.icon} className={`w-4 h-4 ${s.color}`} />
                    <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3 text-[#7a9bb5] group-hover:text-white transition-colors" />
                  </div>
                  <div className="text-2xl font-bold text-white">{s.value}</div>
                  <div className="text-xs text-[#7a9bb5] mt-1">{s.label}</div>
                </Link>
              ))}
        </div>

        <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#4590e2]/15">
            <h2 className="text-sm font-semibold text-white">Upcoming &amp; Recent Tests</h2>
            <Link href="/app/schedule" className="text-xs text-[#4590e2] hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-[#0a141f] rounded animate-pulse" />)}
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <FontAwesomeIcon icon={faCalendarCheck} className="w-8 h-8 text-[#4590e2]/20 mb-3" />
              <p className="text-[#7a9bb5] text-sm">No tests scheduled yet.</p>
              <Link href="/app/schedule" className="mt-3 text-xs text-[#4590e2] hover:underline">Schedule your first test &rarr;</Link>
            </div>
          ) : (
            <div className="divide-y divide-[#4590e2]/10">
              {recent.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={faClock} className="w-3.5 h-3.5 text-[#7a9bb5]" />
                    <div>
                      <p className="text-sm font-medium text-white">{t.targetGroupName || "Unnamed Group"}</p>
                      <p className="text-xs text-[#7a9bb5]">{t.clientName || "—"} · {t.testType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#7a9bb5] hidden sm:block">
                      {t.scheduledDate ? new Date(t.scheduledDate).toLocaleDateString() : "—"}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${STATUS_COLORS[t.status] || STATUS_COLORS.pending}`}>
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { href: "/app/targets",  icon: faLayerGroup,    color: "text-[#4590e2]",  bg: "bg-[#4590e2]/10 border-[#4590e2]/20",   title: "Manage Target Groups", sub: "Define client environments and assets" },
            { href: "/app/schedule", icon: faCalendarCheck, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20",  title: "Schedule a Pentest",    sub: "Pick a target group and set a date"    },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-5 hover:border-[#4590e2]/35 transition-colors group flex items-center gap-4"
            >
              <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${a.bg}`}>
                <FontAwesomeIcon icon={a.icon} className={`w-4 h-4 ${a.color}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white group-hover:text-[#4590e2] transition-colors">{a.title}</p>
                <p className="text-xs text-[#7a9bb5] mt-0.5">{a.sub}</p>
              </div>
              <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3 text-[#7a9bb5] ml-auto group-hover:text-[#4590e2] transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
