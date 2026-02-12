"use client";

import { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faBug,
  faSearch,
  faFilter,
  faExclamationTriangle,
  faExclamationCircle,
  faInfoCircle,
  faCheckCircle,
  faChevronRight,
  faShieldAlt,
} from "@fortawesome/free-solid-svg-icons";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useFindings } from "@/lib/hooks/useFindings";
import { useAuth } from "@/lib/context/AuthContext";
import { auth } from "@/lib/firebase/firebaseClient";
import { Severity, FindingStatus } from "@/lib/types/pentest";

const severityConfig: Record<Severity, { icon: any; color: string; bg: string }> = {
  critical: {
    icon: faExclamationCircle,
    color: "text-red-700",
    bg: "bg-red-100",
  },
  high: {
    icon: faExclamationTriangle,
    color: "text-orange-700",
    bg: "bg-orange-100",
  },
  medium: {
    icon: faExclamationTriangle,
    color: "text-yellow-700",
    bg: "bg-yellow-100",
  },
  low: {
    icon: faInfoCircle,
    color: "text-blue-700",
    bg: "bg-blue-100",
  },
  info: {
    icon: faInfoCircle,
    color: "text-gray-700",
    bg: "bg-gray-100",
  },
};

const statusLabels: Record<FindingStatus, string> = {
  open: "Open",
  confirmed: "Confirmed",
  false_positive: "False Positive",
  remediated: "Remediated",
  accepted_risk: "Accepted Risk",
};

export default function FindingsPage() {
  const { findings, loading } = useFindings();
  const { currentUser } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [target, setTarget] = useState("");
  const [affectedComponent, setAffectedComponent] = useState("");
  const [evidence, setEvidence] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [remediation, setRemediation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filteredFindings = findings.filter((finding) => {
    const matchesSearch =
      finding.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      finding.target.toLowerCase().includes(searchTerm.toLowerCase()) ||
      finding.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity =
      filterSeverity === "all" || finding.severity === filterSeverity;
    const matchesStatus =
      filterStatus === "all" || finding.status === filterStatus;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const stats = useMemo(() => {
    return {
      total: findings.length,
      critical: findings.filter((f) => f.severity === "critical").length,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
      open: findings.filter((f) => f.status === "open").length,
    };
  }, [findings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/findings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          severity,
          target,
          affectedComponent,
          evidence,
          stepsToReproduce,
          remediation,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create finding");
      }

      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error("Error creating finding:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setSeverity("medium");
    setTarget("");
    setAffectedComponent("");
    setEvidence("");
    setStepsToReproduce("");
    setRemediation("");
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Findings</h1>
            <p className="text-gray-500 mt-1">
              Track vulnerabilities and security findings
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white font-semibold rounded-lg hover:bg-cyan-600 transition-colors"
          >
            <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
            Add Finding
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
            <div className="text-sm text-gray-500">Critical</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
            <div className="text-sm text-gray-500">High</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.medium}</div>
            <div className="text-sm text-gray-500">Medium</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.low}</div>
            <div className="text-sm text-gray-500">Low</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-purple-600">{stats.open}</div>
            <div className="text-sm text-gray-500">Open</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <FontAwesomeIcon
                icon={faSearch}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"
              />
              <input
                type="text"
                placeholder="Search findings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 min-w-[140px]"
            >
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 min-w-[140px]"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="confirmed">Confirmed</option>
              <option value="remediated">Remediated</option>
              <option value="false_positive">False Positive</option>
              <option value="accepted_risk">Accepted Risk</option>
            </select>
          </div>
        </div>

        {/* Findings List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading findings...</div>
          ) : filteredFindings.length === 0 ? (
            <div className="p-8 text-center">
              <FontAwesomeIcon
                icon={faShieldAlt}
                className="w-12 h-12 text-gray-300 mb-4"
              />
              <h3 className="text-lg font-medium text-gray-900">
                No findings yet
              </h3>
              <p className="text-gray-500 mt-1">
                Add findings from your pentests.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white font-semibold rounded-lg hover:bg-cyan-600 transition-colors"
              >
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                Add Finding
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredFindings.map((finding) => {
                const sevConfig = severityConfig[finding.severity];
                return (
                  <div
                    key={finding.id}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${sevConfig.bg}`}>
                          <FontAwesomeIcon
                            icon={sevConfig.icon}
                            className={`w-4 h-4 ${sevConfig.color}`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">
                              {finding.title}
                            </h4>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${sevConfig.bg} ${sevConfig.color}`}
                            >
                              {finding.severity}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                              {finding.target}
                            </span>
                            <span>{statusLabels[finding.status]}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">
                          {formatTimestamp(finding.discoveredAt)}
                        </span>
                        <FontAwesomeIcon
                          icon={faChevronRight}
                          className="w-4 h-4 text-gray-400"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* New Finding Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Add Finding</h2>
                <p className="text-gray-500 mt-1">
                  Document a security vulnerability or issue
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      placeholder="e.g., SQL Injection in Login Form"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Severity *
                    </label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as Severity)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                      <option value="info">Info</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target *
                    </label>
                    <input
                      type="text"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      required
                      placeholder="e.g., https://example.com"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Affected Component
                    </label>
                    <input
                      type="text"
                      value={affectedComponent}
                      onChange={(e) => setAffectedComponent(e.target.value)}
                      placeholder="e.g., /api/login endpoint"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Describe the vulnerability..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Evidence / Proof of Concept
                  </label>
                  <textarea
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                    rows={3}
                    placeholder="Include payloads, screenshots description, etc."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Steps to Reproduce
                  </label>
                  <textarea
                    value={stepsToReproduce}
                    onChange={(e) => setStepsToReproduce(e.target.value)}
                    rows={3}
                    placeholder="1. Go to login page&#10;2. Enter payload in username field&#10;3. ..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Remediation Recommendation
                  </label>
                  <textarea
                    value={remediation}
                    onChange={(e) => setRemediation(e.target.value)}
                    rows={2}
                    placeholder="How to fix this vulnerability..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-cyan-500 text-white font-semibold rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Adding..." : "Add Finding"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
