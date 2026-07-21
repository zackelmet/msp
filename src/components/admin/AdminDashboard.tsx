"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faSearch,
  faCircleNotch,
  faCheckCircle,
  faUpload,
  faArrowLeft,
  faArrowRight,
  faFilePdf,
  faFileWord,
  faTimes,
  faShieldHalved,
  faDollarSign,
  faInbox,
  faComments,
} from "@fortawesome/free-solid-svg-icons";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserSuggestion {
  uid: string;
  email: string;
}

interface PentestItem {
  pentestId: string;
  target: string;
  type: string;
  status: string;
  createdAt: string | null;
  reportUrl: string | null;
}

interface Stats {
  totalUsers: number;
  totalPentests: number;
  completedPentests: number;
  pentestsLast7Days: number;
  revenue30Days: {
    cents: number;
    count: number;
    averageOrderCents: number;
    unavailable: boolean;
  };
}

interface QueueItem {
  pentestId: string;
  userEmail: string;
  target: string;
  type: string;
  status: string;
  batchName: string | null;
  createdAt: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const dollars = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-500/20 text-green-300 border-green-500/30",
  running: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  in_progress: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  pending: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  failed: "bg-red-500/20 text-red-300 border-red-500/30",
};

function StatusBadge({ status }: { status: string }) {
  const cls =
    STATUS_STYLES[status] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}
    >
      {status}
    </span>
  );
}

function StepIndicator({ step }: { step: number }) {
  if (step > 3) return null;
  return (
    <div className="flex items-center gap-2 mb-8">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
            n === step
              ? "bg-[var(--brand)] border-[#4590e2] text-white"
              : n < step
                ? "bg-[#4590e2]/20 border-[#4590e2]/40 text-[#4590e2]"
                : "bg-white/5 border-white/10 text-gray-500"
          }`}
        >
          {n === 1 ? "Client" : n === 2 ? "Pentest" : "Upload"}
        </span>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [feedback, setFeedback] = useState<any[]>([]);

  // Wizard state
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [pentests, setPentests] = useState<PentestItem[]>([]);
  const [selectedPentest, setSelectedPentest] = useState<PentestItem | null>(
    null,
  );
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{
    type: "error" | "success";
    msg: string;
  } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadStats = useCallback(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const r = await fetch("/api/admin/active-pentests");
      if (r.ok) setQueue((await r.json()).queue || []);
    } catch {
      /* ignore */
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const loadFeedback = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/feedback");
      if (r.ok) setFeedback((await r.json()).feedback || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadQueue();
    loadFeedback();
  }, [loadStats, loadQueue, loadFeedback]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (email.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/search-users?q=${encodeURIComponent(email)}`,
        );
        const data = await res.json();
        if (Array.isArray(data)) setSuggestions(data);
      } catch {}
    }, 250);
  }, [email]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showToast = (type: "error" | "success", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFetchPentests = async () => {
    if (!email.trim()) return;
    try {
      const res = await fetch(
        `/api/admin/user-pentests?userEmail=${encodeURIComponent(email.trim())}`,
      );
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error || "User not found");
        return;
      }
      if (!Array.isArray(data) || data.length === 0) {
        showToast("error", "No pentests found for this user");
        return;
      }
      setPentests(data);
      setSelectedPentest(null);
      setStep(2);
    } catch {
      showToast("error", "Network error");
    }
  };

  const handleUpload = async () => {
    if (!selectedPentest || !file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("pentestId", selectedPentest.pentestId);
      fd.append("file", file);
      const res = await fetch("/api/admin/upload-report", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error || "Upload failed");
        return;
      }
      setStep(4);
      loadQueue();
      loadStats();
    } catch (err: any) {
      showToast("error", err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setEmail("");
    setSuggestions([]);
    setPentests([]);
    setSelectedPentest(null);
    setFile(null);
  };

  const statCards = [
    {
      label: "Total Users",
      value: stats ? stats.totalUsers.toLocaleString() : null,
      icon: faUsers,
      color: "text-[#4590e2]",
    },
    {
      label: "Total Pentests",
      value: stats ? stats.totalPentests.toLocaleString() : null,
      icon: faShieldHalved,
      color: "text-purple-400",
    },
    {
      label: "Completed",
      value: stats ? stats.completedPentests.toLocaleString() : null,
      icon: faCheckCircle,
      color: "text-green-400",
    },
    {
      label: "Revenue (30d)",
      value: stats
        ? stats.revenue30Days.unavailable
          ? "n/a"
          : dollars(stats.revenue30Days.cents)
        : null,
      icon: faDollarSign,
      color: "text-yellow-400",
      sub:
        stats && !stats.revenue30Days.unavailable
          ? `${stats.revenue30Days.count} orders · ${dollars(stats.revenue30Days.averageOrderCents)} avg`
          : undefined,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-8 space-y-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl border shadow-xl text-sm font-semibold ${
            toast.type === "error"
              ? "bg-red-500/20 border-red-500/40 text-red-200"
              : "bg-green-500/20 border-green-500/40 text-green-200"
          }`}
        >
          {toast.msg}
          <button onClick={() => setToast(null)}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      {/* Analytics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="bg-white/5 border border-white/10 rounded-xl p-5"
          >
            <FontAwesomeIcon icon={s.icon} className={`text-lg ${s.color}`} />
            <p className="text-2xl font-bold text-white mt-3">
              {s.value === null ? (
                <FontAwesomeIcon
                  icon={faCircleNotch}
                  className="animate-spin text-gray-400 text-base"
                />
              ) : (
                s.value
              )}
            </p>
            <p className="text-xs text-gray-500 uppercase tracking-wide mt-1">
              {s.label}
            </p>
            {s.sub && <p className="text-[10px] text-gray-600 mt-1">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Delivery queue */}
      <DeliveryQueue
        queue={queue}
        loading={queueLoading}
        onDelivered={() => {
          loadQueue();
          loadStats();
        }}
        onError={(m) => showToast("error", m)}
      />

      <div className="border-t border-white/10" />

      {/* Wizard */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 lg:p-8">
        <h2 className="text-xl font-bold text-white mb-6">
          Upload Pentest Report
        </h2>
        <StepIndicator step={step} />

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <label className="block text-sm text-gray-400 font-medium mb-1">
              Client email address
            </label>
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <FontAwesomeIcon
                  icon={faSearch}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="client@example.com"
                  className="w-full bg-white/5 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#4590e2]/60 focus:ring-1 focus:ring-[#4590e2]/30 text-sm"
                />
              </div>
              {showDropdown && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d1e2e] border border-white/15 rounded-xl overflow-hidden shadow-2xl z-20">
                  {suggestions.map((s) => (
                    <button
                      key={s.uid}
                      className="w-full text-left px-4 py-2.5 hover:bg-white/5 text-sm text-white transition-colors"
                      onMouseDown={() => {
                        setEmail(s.email);
                        setShowDropdown(false);
                        setSuggestions([]);
                      }}
                    >
                      {s.email}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleFetchPentests}
              disabled={!email.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-[var(--brand)] hover:bg-[#3a7bc8] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-colors"
            >
              Next <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <FontAwesomeIcon
                icon={faCheckCircle}
                className="text-[#4590e2]"
              />
              <span className="text-white font-medium">{email}</span>
              <button
                onClick={() => setStep(1)}
                className="ml-1 text-[#4590e2] hover:underline text-xs"
              >
                Change
              </button>
            </div>
            <label className="block text-sm text-gray-400 font-medium mb-1">
              Select pentest
            </label>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {pentests.map((p) => (
                <button
                  key={p.pentestId}
                  onClick={() => setSelectedPentest(p)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${
                    selectedPentest?.pentestId === p.pentestId
                      ? "border-[#4590e2]/60 bg-[#4590e2]/10"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.08]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">
                        {p.target}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {p.type} · {formatDate(p.createdAt)}
                        {p.reportUrl && (
                          <span className="ml-2 text-green-400">
                            ✓ has report
                          </span>
                        )}
                      </p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                <FontAwesomeIcon icon={faArrowLeft} /> Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!selectedPentest}
                className="flex items-center gap-2 px-6 py-2.5 bg-[var(--brand)] hover:bg-[#3a7bc8] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-colors"
              >
                Next <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && selectedPentest && (
          <div className="space-y-5">
            <div className="bg-[#4590e2]/10 border border-[#4590e2]/30 rounded-xl px-4 py-3 text-sm">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">
                Uploading report for
              </p>
              <p className="text-white font-semibold">
                {selectedPentest.target}
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                {selectedPentest.type} · {formatDate(selectedPentest.createdAt)}
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 font-medium mb-2">
                Report file (PDF or DOCX)
              </label>
              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white/15 hover:border-[#4590e2]/50 rounded-xl px-6 py-10 cursor-pointer transition-colors group">
                <div className="p-3 rounded-xl bg-white/5 group-hover:bg-[#4590e2]/10 transition-colors">
                  {file ? (
                    <FontAwesomeIcon
                      icon={
                        file.type === "application/pdf" ? faFilePdf : faFileWord
                      }
                      className="text-[#4590e2] text-2xl"
                    />
                  ) : (
                    <FontAwesomeIcon
                      icon={faUpload}
                      className="text-gray-500 text-2xl"
                    />
                  )}
                </div>
                {file ? (
                  <div className="text-center">
                    <p className="text-white text-sm font-semibold">
                      {file.name}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">
                    Click to select a PDF or DOCX file
                  </p>
                )}
                <input
                  type="file"
                  accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                <FontAwesomeIcon icon={faArrowLeft} /> Back
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="flex items-center gap-2 px-6 py-2.5 bg-[var(--brand)] hover:bg-[#3a7bc8] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-colors"
              >
                {uploading ? (
                  <>
                    <FontAwesomeIcon
                      icon={faCircleNotch}
                      className="animate-spin"
                    />{" "}
                    Uploading…
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faUpload} /> Upload Report
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="text-center py-8 space-y-5">
            <div className="inline-flex p-5 rounded-full bg-green-500/15 border border-green-500/30">
              <FontAwesomeIcon
                icon={faCheckCircle}
                className="text-green-400 text-4xl"
              />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Report Uploaded
              </h3>
              <p className="text-gray-400">
                The report for{" "}
                <span className="text-white font-semibold">{email}</span> has
                been uploaded and the pentest is now marked as completed.
              </p>
            </div>
            <button
              onClick={resetWizard}
              className="px-8 py-3 bg-[var(--brand)] hover:bg-[#3a7bc8] text-white font-semibold rounded-xl text-sm transition-colors"
            >
              Upload Another Report
            </button>
          </div>
        )}
      </div>

      {/* Feedback */}
      <FeedbackWindow feedback={feedback} />
    </div>
  );
}

// ─── Delivery Queue ───────────────────────────────────────────────────────────

function DeliveryQueue({
  queue,
  loading,
  onDelivered,
  onError,
}: {
  queue: QueueItem[];
  loading: boolean;
  onDelivered: () => void;
  onError: (msg: string) => void;
}) {
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const upload = async (pentestId: string, file: File) => {
    setUploadingId(pentestId);
    try {
      const fd = new FormData();
      fd.append("pentestId", pentestId);
      fd.append("file", file);
      const r = await fetch("/api/admin/upload-report", {
        method: "POST",
        body: fd,
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "Upload failed");
      }
      onDelivered();
    } catch (e: any) {
      onError(e.message || "Upload failed");
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <FontAwesomeIcon icon={faInbox} className="text-[#4590e2]" />
          Delivery Queue
        </h2>
        <span className="text-xs text-gray-500">{queue.length} pending</span>
      </div>

      {loading ? (
        <div className="px-6 py-10 text-center text-sm text-gray-500">
          Loading…
        </div>
      ) : queue.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-gray-500">
          Nothing awaiting delivery. 🎉
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {queue.map((q) => (
            <div
              key={q.pentestId}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3.5"
            >
              <div className="min-w-0">
                <p className="text-sm text-white font-mono truncate">
                  {q.target}
                </p>
                <p className="text-xs text-gray-500">
                  {q.userEmail} · {q.type}
                  {q.batchName ? ` · ${q.batchName}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={q.status} />
                <label className="cursor-pointer text-xs px-3 py-1.5 border border-[#4590e2]/40 text-[#4590e2] hover:bg-[#4590e2]/10 rounded-lg transition-colors flex items-center gap-1.5">
                  {uploadingId === q.pentestId ? (
                    <FontAwesomeIcon
                      icon={faCircleNotch}
                      className="animate-spin"
                    />
                  ) : (
                    <FontAwesomeIcon icon={faUpload} />
                  )}
                  Upload report
                  <input
                    type="file"
                    accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    disabled={uploadingId !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(q.pentestId, f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

function FeedbackWindow({ feedback }: { feedback: any[] }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <FontAwesomeIcon icon={faComments} className="text-[#4590e2]" />
          Recent Feedback
        </h2>
      </div>
      {feedback.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-gray-500">
          No feedback yet.
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {feedback.map((f) => (
            <div key={f.id} className="px-6 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#4590e2]">{f.userEmail}</span>
                {f.rating != null && (
                  <span className="text-xs text-yellow-400">
                    {"★".repeat(Math.max(0, Math.min(5, Number(f.rating))))}
                  </span>
                )}
              </div>
              <p className="text-sm text-white mt-1">{f.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
