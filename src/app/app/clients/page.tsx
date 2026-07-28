"use client";

import PlatformSection from "@/components/admin/sections/PlatformSection";
import { useAuth } from "@/lib/context/AuthContext";

/**
 * In-app control plane for distributors/resellers (Acronis-style). Reuses the
 * PlatformSection UI but points it at the ROLE-SCOPED /api/orgs endpoints, so a
 * supplier_admin/reseller_admin manages only their own subtree. The platform
 * admin console (/admin) stays separate and Zack-only.
 */
export default function ClientsPage() {
  const { currentUser } = useAuth();

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (!currentUser) return {};
    const token = await currentUser.getIdToken();
    return { Authorization: `Bearer ${token}` };
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-1">Platform</h1>
      <p className="text-[#7a9bb5] text-sm mb-6">
        Drill into your resellers and clients, and set their pentest quotas.
      </p>
      <PlatformSection apiBase="/api/orgs" getAuthHeaders={getAuthHeaders} />
    </div>
  );
}
