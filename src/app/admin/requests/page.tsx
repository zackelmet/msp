'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface PentestRequest {
  id: string;
  userId: string;
  userEmail: string;
  tier: 'manual_basic' | 'manual_advanced';
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
  pending: 'bg-yellow-100 text-yellow-800',
  reviewing: 'bg-blue-100 text-blue-800',
  scoping: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-gray-100 text-gray-800',
  rejected: 'bg-red-100 text-red-800',
};

const TIER_NAMES = {
  manual_basic: 'Basic Manual Pentest',
  manual_advanced: 'Advanced Manual Pentest',
};

export default function AdminRequestsPage() {
  const { currentUser: user } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<PentestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PentestRequest | null>(null);
  const [updating, setUpdating] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    tier: 'all',
  });

  // Simple admin check (you should implement proper role-based access)
  const isAdmin = user?.email?.includes('admin') || user?.email?.includes('hackeranalytics0');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!isAdmin) {
      toast.error('Access denied - Admin only');
      router.push('/app/dashboard');
      return;
    }
    fetchRequests();
  }, [user, isAdmin, router]);

  const fetchRequests = async () => {
    try {
      const response = await fetch(`/api/pentest-requests?isAdmin=true`);
      const data = await response.json();
      if (response.ok) {
        setRequests(data.requests);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (
    requestId: string,
    updates: Partial<PentestRequest>
  ) => {
    setUpdating(true);
    try {
      const response = await fetch('/api/pentest-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          updates,
          adminUserId: user?.uid,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update request');
      }

      toast.success('Request updated successfully');
      await fetchRequests();
      setSelectedRequest(null);
    } catch (error: any) {
      console.error('Error updating request:', error);
      toast.error(error.message || 'Failed to update request');
    } finally {
      setUpdating(false);
    }
  };

  const filteredRequests = requests.filter((req) => {
    if (filters.status !== 'all' && req.status !== filters.status) return false;
    if (filters.tier !== 'all' && req.tier !== filters.tier) return false;
    return true;
  });

  const statusCounts = requests.reduce((acc, req) => {
    acc[req.status] = (acc[req.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading requests...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Manual Pentest Requests</h1>
          <p className="text-gray-600 mt-2">Manage incoming pentest requests from clients</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-gray-900">{count}</div>
              <div className="text-sm text-gray-600 capitalize">{status.replace('_', ' ')}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Tier</label>
            <select
              value={filters.tier}
              onChange={(e) => setFilters({ ...filters, tier: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Tiers</option>
              <option value="manual_basic">Basic</option>
              <option value="manual_advanced">Advanced</option>
            </select>
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Submitted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No requests found
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{request.companyName}</div>
                      <div className="text-sm text-gray-500">
                        {request.targetDomains.slice(0, 2).join(', ')}
                        {request.targetDomains.length > 2 && ' +more'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{request.contactName}</div>
                      <div className="text-sm text-gray-500">{request.userEmail}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {TIER_NAMES[request.tier]}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          STATUS_COLORS[request.status as keyof typeof STATUS_COLORS]
                        }`}
                      >
                        {request.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => setSelectedRequest(request)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
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
      </div>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedRequest.companyName}
                  </h2>
                  <p className="text-gray-600">{TIER_NAMES[selectedRequest.tier]}</p>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Contact Info */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Contact Information</h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Contact:</span>{' '}
                      <span className="font-medium">{selectedRequest.contactName}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Email:</span>{' '}
                      <span className="font-medium">{selectedRequest.userEmail}</span>
                    </div>
                    {selectedRequest.phoneNumber && (
                      <div>
                        <span className="text-gray-600">Phone:</span>{' '}
                        <span className="font-medium">{selectedRequest.phoneNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scope */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Scope Details</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Target Domains:</span>
                      <ul className="list-disc list-inside ml-4 mt-1">
                        {selectedRequest.targetDomains.map((domain, idx) => (
                          <li key={idx} className="font-mono">{domain}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="text-gray-600">Applications:</span>
                      <ul className="list-disc list-inside ml-4 mt-1">
                        {selectedRequest.targetApplications.map((app, idx) => (
                          <li key={idx}>{app}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-3">
                      <span className="text-gray-600 font-medium">Description:</span>
                      <p className="mt-1 whitespace-pre-wrap">{selectedRequest.scopeDescription}</p>
                    </div>
                  </div>
                </div>

                {/* Technical Details */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Technical Details</h3>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div>Environment: <span className="font-medium capitalize">{selectedRequest.testingEnvironment}</span></div>
                    <div>
                      Components:
                      <ul className="list-disc list-inside ml-4">
                        {selectedRequest.hasWebApplications && <li>Web Applications</li>}
                        {selectedRequest.hasAPIs && <li>APIs</li>}
                        {selectedRequest.hasMobileApps && <li>Mobile Apps</li>}
                        {selectedRequest.hasInternalNetwork && <li>Internal Network</li>}
                      </ul>
                    </div>
                    {selectedRequest.complianceRequirements && selectedRequest.complianceRequirements.length > 0 && (
                      <div>
                        Compliance: <span className="font-medium">{selectedRequest.complianceRequirements.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-3">Admin Actions</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Update Status
                      </label>
                      <select
                        value={selectedRequest.status}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          updateRequestStatus(selectedRequest.id, { status: newStatus });
                        }}
                        disabled={updating}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Admin Notes
                      </label>
                      <textarea
                        defaultValue={selectedRequest.adminNotes || ''}
                        onBlur={(e) => {
                          if (e.target.value !== selectedRequest.adminNotes) {
                            updateRequestStatus(selectedRequest.id, {
                              adminNotes: e.target.value,
                            });
                          }
                        }}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        placeholder="Internal notes about this request..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
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
