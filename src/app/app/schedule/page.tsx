"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarAlt,
  faPlus,
  faTrash,
  faClock,
} from "@fortawesome/free-solid-svg-icons";

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  approved: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  running: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  completed: "text-green-400 bg-green-400/10 border-green-400/30",
  cancelled: "text-red-400 bg-red-400/10 border-red-400/30",
};

export default function SchedulePage() {
  return (
    <Suspense>
      <SchedulePageInner />
    </Suspense>
  );
}

function SchedulePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillGroupId = searchParams.get("targetGroupId") || "";

  const [groups, setGroups] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const [targetGroupId, setTargetGroupId] = useState(prefillGroupId);
  const [testType, setTestType] = useState("automated");
  const [frequency, setFrequency] = useState("once");
  const [scheduledDate, setScheduledDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    (async () => {
      const { getAuth, onAuthStateChanged } = await import("firebase/auth");
      const firebase_app = (await import("@/lib/firebase/firebaseClient"))
        .default;
      const auth = getAuth(firebase_app);

      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          router.replace("/login");
          return;
        }
        const t = await user.getIdToken();
        setToken(t);
        const h = { Authorization: `Bearer ${t}` };
        const [tgRes, stRes] = await Promise.all([
          fetch("/api/target-groups", { headers: h }),
          fetch("/api/scheduled-tests", { headers: h }),
        ]);
        const [tgData, stData] = await Promise.all([
          tgRes.json(),
          stRes.json(),
        ]);
        setGroups(tgData.groups || []);
        setTests(stData.tests || []);
        setLoading(false);
      });
    })();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetGroupId || !scheduledDate) {
      setFormError("Select a target group and date.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    const group = groups.find((g) => g.id === targetGroupId);
    try {
      const res = await fetch("/api/scheduled-tests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetGroupId,
          targetGroupName: group?.name || "",
          clientName: group?.clientName || "",
          testType,
          frequency,
          scheduledDate,
          notes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const created = await res.json();
      setTests((prev) => [
        {
          id: created.id,
          targetGroupId,
          targetGroupName: group?.name,
          clientName: group?.clientName,
          testType,
          frequency,
          scheduledDate,
          notes,
          status: "pending",
          createdAt: created.createdAt,
        },
        ...prev,
      ]);
      setTargetGroupId(prefillGroupId);
      setTestType("automated");
      setFrequency("once");
      setScheduledDate("");
      setNotes("");
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this scheduled test?")) return;
    setDeleting(id);
    await fetch(`/api/scheduled-tests/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setTests((prev) => prev.filter((t) => t.id !== id));
    setDeleting(null);
  };

  const inputCls =
    "w-full bg-[#0a141f] border border-[#4590e2]/20 rounded-lg px-3 py-2 text-sm text-white placeholder-[#7a9bb5] focus:outline-none focus:border-[#4590e2]/60 transition-colors";

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Schedule Tests</h1>
        <p className="text-[#7a9bb5] text-sm mt-1">
          Schedule automated or manual pentests for your target groups.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-5 space-y-4 h-fit"
        >
          <h2 className="text-sm font-semibold text-white">
            New Scheduled Test
          </h2>

          {groups.length === 0 && !loading && (
            <div className="text-xs text-yellow-400/80 bg-yellow-400/5 border border-yellow-400/20 rounded-lg p-3">
              You need to{" "}
              <Link href="/app/targets/new" className="underline">
                create a target group
              </Link>{" "}
              first.
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-[#7a9bb5]">Target Group *</label>
            <select
              className={inputCls}
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              required
            >
              <option value="">Select...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {g.clientName ? ` — ${g.clientName}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#7a9bb5]">Test Type</label>
            <select
              className={inputCls}
              value={testType}
              onChange={(e) => setTestType(e.target.value)}
            >
              <option value="automated">Automated</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#7a9bb5]">Frequency</label>
            <select
              className={inputCls}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              <option value="once">One-time</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#7a9bb5]">Date *</label>
            <input
              type="date"
              className={inputCls}
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#7a9bb5]">Notes</label>
            <textarea
              className={inputCls + " resize-none"}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {formError && <p className="text-xs text-red-400">{formError}</p>}

          <button
            type="submit"
            disabled={submitting || groups.length === 0}
            className="w-full py-2.5 bg-[var(--brand)] hover:bg-[#3a7bc8] disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
            {submitting ? "Scheduling..." : "Schedule Test"}
          </button>
        </form>

        <div className="lg:col-span-3 bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl overflow-hidden h-fit">
          <div className="px-5 py-4 border-b border-[#4590e2]/15">
            <h2 className="text-sm font-semibold text-white">
              Scheduled Tests
            </h2>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-[#0a141f] rounded animate-pulse"
                />
              ))}
            </div>
          ) : tests.length === 0 ? (
            <div className="p-5 space-y-4">
              <div className="flex flex-col items-center text-center py-6">
                <FontAwesomeIcon
                  icon={faCalendarAlt}
                  className="w-8 h-8 text-[#4590e2]/25 mb-3"
                />
                <p className="text-white text-sm font-semibold">
                  No tests scheduled yet
                </p>
                <p className="text-xs text-[#7a9bb5] mt-1 max-w-xs">
                  Use the form on the left to schedule your first test. You can
                  set a one-time date or a recurring cadence.
                </p>
              </div>
              <div className="border-t border-[#4590e2]/10 pt-4 space-y-3">
                {[
                  {
                    label: "Automated",
                    body: "Runs a comprehensive scan against your target group — results appear in Test History.",
                  },
                  {
                    label: "Manual",
                    body: "Flags the engagement for your team to kick off a hands-on pentest.",
                  },
                  {
                    label: "Recurring",
                    body: "Set weekly, monthly, or quarterly cadences to stay continuously assessed.",
                  },
                ].map((t) => (
                  <div key={t.label} className="flex gap-3">
                    <span className="shrink-0 w-2 h-2 rounded-full bg-[#4590e2]/40 mt-1.5" />
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {t.label}
                      </p>
                      <p className="text-xs text-[#7a9bb5] leading-relaxed">
                        {t.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#4590e2]/10">
              {tests.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-4">
                  <FontAwesomeIcon
                    icon={faClock}
                    className="w-3.5 h-3.5 text-[#7a9bb5] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {t.targetGroupName || "—"}
                    </p>
                    <p className="text-xs text-[#7a9bb5]">
                      {t.testType} · {t.frequency} ·{" "}
                      {t.scheduledDate
                        ? new Date(t.scheduledDate).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border capitalize shrink-0 ${STATUS_COLORS[t.status] || STATUS_COLORS.pending}`}
                  >
                    {t.status}
                  </span>
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={deleting === t.id}
                    className="text-red-400/40 hover:text-red-400 transition-colors shrink-0 disabled:opacity-30"
                  >
                    <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
