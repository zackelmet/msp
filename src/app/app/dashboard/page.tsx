"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import PlatformSection from "@/components/admin/sections/PlatformSection";
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
  faBullseye,
  faFileLines,
  faArrowRight,
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
  // Control-plane roles (distributor/reseller) land on the clients grid as home.
  const [role, setRole] = useState<string | null>(null);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { getAuth } = await import("firebase/auth");
    const app = (await import("@/lib/firebase/firebaseClient")).default;
    const u = getAuth(app).currentUser;
    if (!u) return {};
    return { Authorization: `Bearer ${await u.getIdToken()}` };
  };

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

        // Distributors/resellers get the Acronis clients grid as their home;
        // skip the per-user pentest-activity stats.
        try {
          const meRes = await fetch(`/api/auth/isAdmin?uid=${user.uid}`);
          const me = await meRes.json();
          if (me.role === "supplier_admin" || me.role === "reseller_admin") {
            setRole(me.role);
            setLoading(false);
            return;
          }
        } catch {
          /* fall through to the standard dashboard */
        }

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

  // Acronis "clients grid = home" for distributors/resellers.
  if (role === "supplier_admin" || role === "reseller_admin") {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-1">Platform</h1>
          <p className="text-[#7a9bb5] mb-6 text-sm">
            Drill into your resellers and clients, and set their pentest quotas.
          </p>
          <PlatformSection apiBase="/api/orgs" getAuthHeaders={getAuthHeaders} />
        </div>
      </DashboardLayout>
    );
  }

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

        {/* How it works / getting started */}
        <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-white">Getting Started</h2>
              <p className="text-xs text-[#7a9bb5] mt-0.5">Three steps to your first pentest</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                step: "01",
                href: "/app/targets/new",
                icon: faBullseye,
                color: "text-[#4590e2]",
                bg: "bg-[#4590e2]/10 border-[#4590e2]/20",
                done: stats.targetGroups > 0,
                title: "Create a Target Group",
                sub: "Define the client environment, assets, and scope you want tested.",
              },
              {
                step: "02",
                href: "/app/schedule",
                icon: faCalendarCheck,
                color: "text-purple-400",
                bg: "bg-purple-500/10 border-purple-500/20",
                done: stats.scheduledTests > 0,
                title: "Schedule a Test",
                sub: "Pick a target group, test type, and date. Automated or manual.",
              },
              {
                step: "03",
                href: "/app/manual-pentest",
                icon: faFileLines,
                color: "text-green-400",
                bg: "bg-green-500/10 border-green-500/20",
                done: false,
                title: "Request a Manual Pentest",
                sub: "Need a deeper assessment? Submit a scoping form and get a custom quote.",
              },
            ].map((s) => (
              <Link
                key={s.step}
                href={s.href}
                className="relative bg-[#0a141f] border border-[#4590e2]/10 hover:border-[#4590e2]/30 rounded-xl p-5 transition-colors group flex flex-col gap-3"
              >
                {s.done && (
                  <span className="absolute top-3 right-3 text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
                    Done
                  </span>
                )}
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${s.bg}`}>
                  <FontAwesomeIcon icon={s.icon} className={`w-3.5 h-3.5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#7a9bb5] mb-1">STEP {s.step}</p>
                  <p className="text-sm font-semibold text-white group-hover:text-[#4590e2] transition-colors leading-snug">{s.title}</p>
                  <p className="text-xs text-[#7a9bb5] mt-1.5 leading-relaxed">{s.sub}</p>
                </div>
                <FontAwesomeIcon icon={faArrowRight} className={`w-3 h-3 mt-auto ${s.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
