"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGaugeHigh,
  faUsers,
  faShieldHalved,
  faInbox,
} from "@fortawesome/free-solid-svg-icons";
import AdminDashboard from "@/components/admin/AdminDashboard";
import UsersSection from "@/components/admin/sections/UsersSection";
import PentestsSection from "@/components/admin/sections/PentestsSection";
import RequestsSection from "@/components/admin/sections/RequestsSection";

/**
 * Consolidated admin console: a single page with tabbed sections (Overview,
 * Users, Pentests, Requests), replacing the former separate /admin/* pages.
 * The active tab is driven by the `?tab=` query param so tabs are deep-linkable
 * and the old routes can redirect here.
 */
const TABS = [
  { id: "overview", label: "Overview", icon: faGaugeHigh },
  { id: "users", label: "Users", icon: faUsers },
  { id: "pentests", label: "Pentests", icon: faShieldHalved },
  { id: "requests", label: "Requests", icon: faInbox },
] as const;

type TabId = (typeof TABS)[number]["id"];

function AdminConsoleInner() {
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab");
  const active: TabId = TABS.some((t) => t.id === raw)
    ? (raw as TabId)
    : "overview";

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-1">Admin</h1>
        <p className="text-gray-400 text-sm">
          Delivery, users, pentests, and incoming requests — all in one place.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/10 mb-8 overflow-x-auto">
        {TABS.map((t) => {
          const isActive = t.id === active;
          return (
            <Link
              key={t.id}
              href={`/admin?tab=${t.id}`}
              scroll={false}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-[#4590e2] text-[#4590e2]"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              <FontAwesomeIcon icon={t.icon} className="w-4 h-4" />
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Active section */}
      {active === "overview" && <AdminDashboard />}
      {active === "users" && <UsersSection />}
      {active === "pentests" && <PentestsSection />}
      {active === "requests" && <RequestsSection />}
    </div>
  );
}

export default function AdminConsole() {
  // useSearchParams requires a Suspense boundary.
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading…</div>}>
      <AdminConsoleInner />
    </Suspense>
  );
}
