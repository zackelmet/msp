'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PentestRequest {
  id: string;
  tier: string;
  companyName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  engagementId?: string;
}

interface Engagement {
  id: string;
  clientName: string;
  scope: string;
  status: string;
  startDate: string;
  completionDate?: string;
}

interface Finding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: string;
  description: string;
  evidence?: string;
  remediation?: string;
  cvss?: number;
  cve?: string;
  target?: string;
  foundAt: string;
}

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-blue-100 text-blue-800 border-blue-300',
  info: 'bg-gray-100 text-gray-800 border-gray-300',
};

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  reviewing: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-gray-100 text-gray-800',
};

export default function MyResultsPage() {
  const { currentUser: user } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<PentestRequest[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'requests' | 'engagements' | 'findings'>('requests');

  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/app/my-results');
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch requests
      const requestsRes = await fetch(`/api/pentest-requests?userId=${user.uid}`);
      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setRequests(requestsData.requests || []);
      }

      // Fetch engagements
      const engagementsRes = await fetch(`/api/engagements?userId=${user.uid}`);
      if (engagementsRes.ok) {
        const engagementsData = await engagementsRes.json();
        setEngagements(engagementsData.engagements || []);
      }

      // Fetch findings
      const findingsRes = await fetch(`/api/findings?userId=${user.uid}`);
      if (findingsRes.ok) {
        const findingsData = await findingsRes.json();
        setFindings(findingsData.findings || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityStats = () => {
    const stats = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    findings.forEach((finding) => {
      stats[finding.severity]++;
    });
    return stats;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading your results...</div>
      </div>
    );
  }

  const severityStats = getSeverityStats();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Pentest Results</h1>
          <p className="text-gray-600 mt-2">
            View your pentest requests, engagements, and security findings
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-gray-900">{requests.length}</div>
            <div className="text-sm text-gray-600">Total Requests</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-gray-900">{engagements.length}</div>
            <div className="text-sm text-gray-600">Active Engagements</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-gray-900">{findings.length}</div>
            <div className="text-sm text-gray-600">Total Findings</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-red-600">
              {severityStats.critical + severityStats.high}
            </div>
            <div className="text-sm text-gray-600">Critical/High Severity</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {[
                { id: 'requests', label: 'Requests', count: requests.length },
                { id: 'engagements', label: 'Engagements', count: engagements.length },
                { id: 'findings', label: 'Findings', count: findings.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Requests Tab */}
            {activeTab === 'requests' && (
              <div>
                {requests.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 mb-4">No pentest requests yet</p>
                    <Link
                      href="/pricing"
                      className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Request a Pentest
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {requests.map((request) => (
                      <div
                        key={request.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {request.companyName}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              Tier: {request.tier.replace('manual_', '').toUpperCase()}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              Submitted: {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 text-xs font-semibold rounded-full ${
                              STATUS_COLORS[request.status as keyof typeof STATUS_COLORS] ||
                              'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {request.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        {request.engagementId && (
                          <div className="mt-3 pt-3 border-t">
                            <Link
                              href={`/app/engagements/${request.engagementId}`}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              View Engagement →
                            </Link>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Engagements Tab */}
            {activeTab === 'engagements' && (
              <div>
                {engagements.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No active engagements</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {engagements.map((engagement) => (
                      <div
                        key={engagement.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {engagement.clientName}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">{engagement.scope}</p>
                            <p className="text-sm text-gray-500 mt-1">
                              Started: {new Date(engagement.startDate).toLocaleDateString()}
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 text-xs font-semibold rounded-full ${
                              STATUS_COLORS[engagement.status as keyof typeof STATUS_COLORS] ||
                              'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {engagement.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Findings Tab */}
            {activeTab === 'findings' && (
              <div>
                {findings.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No findings yet</p>
                  </div>
                ) : (
                  <div>
                    {/* Severity Filter/Stats */}
                    <div className="flex gap-2 mb-6 flex-wrap">
                      {Object.entries(severityStats).map(([severity, count]) => (
                        <div
                          key={severity}
                          className={`px-4 py-2 rounded-lg border ${
                            SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS]
                          }`}
                        >
                          <span className="font-semibold capitalize">{severity}:</span>{' '}
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>

                    {/* Findings List */}
                    <div className="space-y-4">
                      {findings
                        .sort((a, b) => {
                          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
                          return severityOrder[a.severity] - severityOrder[b.severity];
                        })
                        .map((finding) => (
                          <div
                            key={finding.id}
                            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <h3 className="font-semibold text-gray-900">{finding.title}</h3>
                              <span
                                className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                  SEVERITY_COLORS[finding.severity]
                                }`}
                              >
                                {finding.severity.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mb-3">{finding.description}</p>
                            {finding.target && (
                              <p className="text-sm text-gray-600 mb-2">
                                <span className="font-medium">Target:</span> {finding.target}
                              </p>
                            )}
                            {finding.cvss && (
                              <p className="text-sm text-gray-600 mb-2">
                                <span className="font-medium">CVSS Score:</span> {finding.cvss}
                              </p>
                            )}
                            {finding.cve && (
                              <p className="text-sm text-gray-600 mb-2">
                                <span className="font-medium">CVE:</span> {finding.cve}
                              </p>
                            )}
                            {finding.remediation && (
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-sm font-medium text-gray-700 mb-1">
                                  Remediation:
                                </p>
                                <p className="text-sm text-gray-600">{finding.remediation}</p>
                              </div>
                            )}
                            <p className="text-xs text-gray-500 mt-3">
                              Found: {new Date(finding.foundAt).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
