import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { adminDb } from "@/lib/firebase/firebaseAdmin";

export const dynamic = "force-dynamic";

async function isAdminUid(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  const doc = await adminDb.collection("users").doc(uid).get();
  return doc.data()?.isAdmin === true;
}

export default async function AdminPage() {
  const uid = cookies().get("uid")?.value;
  if (!(await isAdminUid(uid))) redirect("/app/dashboard");

  const [usersSnap, pentestsSnap, requestsSnap, scheduledSnap] = await Promise.all([
    adminDb.collection("users").count().get(),
    adminDb.collection("pentests").count().get(),
    adminDb.collection("pentest-requests").count().get(),
    adminDb.collection("scheduledTests").count().get(),
  ]);

  const stats = [
    { label: "Total Users",       value: usersSnap.data().count,    href: "/admin/users" },
    { label: "Pentests",          value: pentestsSnap.data().count,  href: "/admin/pentests" },
    { label: "Pentest Requests",  value: requestsSnap.data().count,  href: "/admin/requests" },
    { label: "Scheduled Tests",   value: scheduledSnap.data().count, href: "/admin/pentests" },
  ];

  return (
    <div className="min-h-screen bg-[#0a141f] p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Overview</h1>
            <p className="text-[#7a9bb5] text-sm mt-1">Platform health at a glance.</p>
          </div>
          <Link href="/app/dashboard" className="text-xs text-[#4590e2] hover:underline">← Back to dashboard</Link>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-5 hover:border-[#4590e2]/40 transition-colors"
            >
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-[#7a9bb5] mt-1">{s.label}</div>
            </Link>
          ))}
        </div>

        {/* Admin nav */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { href: "/admin/users",    title: "Manage Users",      sub: "View all users, adjust credits" },
            { href: "/admin/pentests", title: "All Pentests",       sub: "View and update pentest status" },
            { href: "/admin/requests", title: "Pentest Requests",   sub: "Review incoming requests" },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-5 hover:border-[#4590e2]/40 transition-colors"
            >
              <p className="text-sm font-semibold text-white">{a.title}</p>
              <p className="text-xs text-[#7a9bb5] mt-1">{a.sub}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
