"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/context/AuthContext";
import toast from "react-hot-toast";

/**
 * Manual pentest requests admin section (formerly /admin/requests). Renders
 * inside the consolidated AdminConsole tabs. The /admin page already gates on
 * admin server-side, so the standalone login/isAdmin redirect was removed;
 * useAuth is kept only to stamp the acting admin's uid on updates.
 *
 * Styled to match the dark admin theme (bg-[#0d1e30] cards, #4590e2 accent,
 * #7a9bb5 muted text) — same palette as PentestsSection/UsersSection.
 */
interface PentestRequest {
  id: string;
  userId: string;
  userEmail: string;
  tier: string;
  status: string;
  contactName: string;
  companyName: string;
  phoneNumber?: string;
  targetDomains: string[];
  targetApplications: string[];
  scopeDescription: string;
  testingEnvironment: string;
  hasWebApplications: boolean;
  hasAPIs: boolean;
  hasMobileApps: boolean;
  hasInternalNetwork: boolean;
  complianceRequirements?: string[];
  specificConcerns?: string;
  preferredStartDate?: string;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  estimatedCost?: number;
  estimatedDuration?: string;
  adminNotes?: string;
  engagementId?: string;
}

const STATUS_COLORS = {
  pending: "text-yellow-400 bg-yellow-400/10 border border-yellow-400/30",
  reviewing: "text-blue-400 bg-blue-400/10 border border-blue-400/30",
  scoping: "text-purple-400 bg-purple-400/10 border border-purple-400/30",
  approved: "text-green-400 bg-green-400/10 border border-green-400/30",
  in_progress: "text-indigo-400 bg-indigo-400/10 border border-indigo-400/30",
  completed: "text-[#7a9bb5] bg-[#4590e2]/10 border border-[#4590e2]/30",
  rejected: "text-red-400 bg-red-400/10 border border-red-400/30",
};

const TIER_NAMES: Record<string, string> = {
  manual_basic: "Legacy: Basic Manual Pentest",
  manual_advanced: "Legacy: Advanced Manual Pentest",
  external_ip_1_50: "External IP Manual Pentest (1-50)",
  external_ip_51_100: "External IP Manual Pentest (51-100)",
  external_ip_101_plus_base: "External IP Manual Pentest (101+ Quote)",
};

const getTierLabel = (tier: string) =>
  TIER_NAMES[tier] || tier.replaceAll("_", " ");

export default function RequestsSection() {
  const { currentUser: user } = useAuth();
  const [requests, setRequests] = useState<PentestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PentestRequest | null>(
    null,
  );
  const [updating, setUpdating] = useState(false);
  const [filters, setFilters] = useState({ status: "all", tier: "all" });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch(`/api/pentest-requests?isAdmin=true`);
      const data = await response.json();
      if (response.ok) {
        setRequests(data.requests);
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (
    requestId: string,
    updates: Partial<PentestRequest>,
  ) => {
    setUpdating(true);
    try {
      const response = await fetch("/api/pentest-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          updates,
          adminUserId: user?.uid,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update request");
      }

      toast.success("Request updated successfully");
      await fetchRequests();
      setSelectedRequest(null);
    } catch (error: any) {
      console.error("Error updating request:", error);
      toast.error(error.message || "Failed to update request");
    } finally {
      setUpdating(false);
    }
  };

  const filteredRequests = requests.filter((req) => {
    if (filters.status !== "all" && req.status !== filters.status) return false;
    if (filters.tier !== "all" && req.tier !== filters.tier) return false;
    return true;
  });

  const statusCounts = requests.reduce(
    (acc, req) => {
      acc[req.status] = (acc[req.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-[#7a9bb5]">Loading requests...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div
            key={status}
            className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-4"
          >
            <div className="text-2xl font-bold text-white">{count}</div>
            <div className="text-sm text-[#7a9bb5] capitalize">
              {status.replace("_", " ")}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-4 mb-6 flex gap-4">
        <div>
          <label className="block text-sm font-medium text-[#7a9bb5] mb-2">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 bg-[#0a141f] border border-[#4590e2]/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#4590e2]/50"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="reviewing">Reviewing</option>
            <option value="scoping">Scoping</option>
            <option value="approved">Approved</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#7a9bb5] mb-2">
            Package
          </label>
          <select
            value={filters.tier}
            onChange={(e) => setFilters({ ...filters, tier: e.target.value })}
            className="px-4 py-2 bg-[#0a141f] border border-[#4590e2]/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#4590e2]/50"
          >
            <option value="all">All Packages</option>
            <option value="external_ip_1_50">External IP (1-50)</option>
            <option value="external_ip_51_100">External IP (51-100)</option>
            <option value="external_ip_101_plus_base">
              External IP (101+ Quote)
            </option>
            <option value="manual_basic">Legacy: Basic</option>
            <option value="manual_advanced">Legacy: Advanced</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-[#4590e2]/10">
          <thead className="bg-[#0a141f]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#7a9bb5] uppercase">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#7a9bb5] uppercase">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#7a9bb5] uppercase">
                Package
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#7a9bb5] uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#7a9bb5] uppercase">
                Submitted
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#7a9bb5] uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#4590e2]/10">
            {filteredRequests.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-8 text-center text-[#7a9bb5]"
                >
                  No requests found
                </td>
              </tr>
            ) : (
              filteredRequests.map((request) => (
                <tr key={request.id} className="hover:bg-[#4590e2]/5">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-white">
                      {request.companyName}
                    </div>
                    <div className="text-sm text-[#7a9bb5]">
                      {request.targetDomains.slice(0, 2).join(", ")}
                      {request.targetDomains.length > 2 && " +more"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-white">
                      {request.contactName}
                    </div>
                    <div className="text-sm text-[#7a9bb5]">
                      {request.userEmail}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#c3d4e3]">
                    {getTierLabel(request.tier)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                        STATUS_COLORS[
                          request.status as keyof typeof STATUS_COLORS
                        ]
                      }`}
                    >
                      {request.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#7a9bb5]">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="text-[#4590e2] hover:text-white font-medium"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {selectedRequest.companyName}
                  </h2>
                  <p className="text-[#7a9bb5]">
                    {getTierLabel(selectedRequest.tier)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-[#7a9bb5] hover:text-white"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-6 text-[#c3d4e3]">
                {/* Contact Info */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-white">
                    Contact Information
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[#7a9bb5]">Contact:</span>{" "}
                      <span className="font-medium">
                        {selectedRequest.contactName}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#7a9bb5]">Email:</span>{" "}
                      <span className="font-medium">
                        {selectedRequest.userEmail}
                      </span>
                    </div>
                    {selectedRequest.phoneNumber && (
                      <div>
                        <span className="text-[#7a9bb5]">Phone:</span>{" "}
                        <span className="font-medium">
                          {selectedRequest.phoneNumber}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scope */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-white">Scope Details</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-[#7a9bb5]">Target Domains:</span>
                      <ul className="list-disc list-inside ml-4 mt-1">
                        {selectedRequest.targetDomains.map((domain, idx) => (
                          <li key={idx} className="font-mono">
                            {domain}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="text-[#7a9bb5]">Applications:</span>
                      <ul className="list-disc list-inside ml-4 mt-1">
                        {selectedRequest.targetApplications.map((app, idx) => (
                          <li key={idx}>{app}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-3">
                      <span className="text-[#7a9bb5] font-medium">
                        Description:
                      </span>
                      <p className="mt-1 whitespace-pre-wrap">
                        {selectedRequest.scopeDescription}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Technical Details */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-white">
                    Technical Details
                  </h3>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div>
                      Environment:{" "}
                      <span className="font-medium capitalize">
                        {selectedRequest.testingEnvironment}
                      </span>
                    </div>
                    <div>
                      Components:
                      <ul className="list-disc list-inside ml-4">
                        {selectedRequest.hasWebApplications && (
                          <li>Web Applications</li>
                        )}
                        {selectedRequest.hasAPIs && <li>APIs</li>}
                        {selectedRequest.hasMobileApps && <li>Mobile Apps</li>}
                        {selectedRequest.hasInternalNetwork && (
                          <li>Internal Network</li>
                        )}
                      </ul>
                    </div>
                    {selectedRequest.complianceRequirements &&
                      selectedRequest.complianceRequirements.length > 0 && (
                        <div>
                          Compliance:{" "}
                          <span className="font-medium">
                            {selectedRequest.complianceRequirements.join(", ")}
                          </span>
                        </div>
                      )}
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="border-t border-[#4590e2]/15 pt-6">
                  <h3 className="text-lg font-semibold mb-3 text-white">Admin Actions</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#7a9bb5] mb-2">
                        Update Status
                      </label>
                      <select
                        value={selectedRequest.status}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          updateRequestStatus(selectedRequest.id, {
                            status: newStatus,
                          });
                        }}
                        disabled={updating}
                        className="w-full px-4 py-2 bg-[#0a141f] border border-[#4590e2]/20 rounded-lg text-sm text-white placeholder-[#7a9bb5] focus:outline-none focus:border-[#4590e2]/50"
                      >
                        <option value="pending">Pending</option>
                        <option value="reviewing">Reviewing</option>
                        <option value="scoping">Scoping</option>
                        <option value="approved">Approved</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#7a9bb5] mb-2">
                        Admin Notes
                      </label>
                      <textarea
                        defaultValue={selectedRequest.adminNotes || ""}
                        onBlur={(e) => {
                          if (e.target.value !== selectedRequest.adminNotes) {
                            updateRequestStatus(selectedRequest.id, {
                              adminNotes: e.target.value,
                            });
                          }
                        }}
                        rows={3}
                        className="w-full px-4 py-2 bg-[#0a141f] border border-[#4590e2]/20 rounded-lg text-sm text-white placeholder-[#7a9bb5] focus:outline-none focus:border-[#4590e2]/50"
                        placeholder="Internal notes about this request..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-6 py-2 bg-[#4590e2]/10 text-[#c3d4e3] border border-[#4590e2]/20 rounded-lg hover:bg-[#4590e2]/20"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
