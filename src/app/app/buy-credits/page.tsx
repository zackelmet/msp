"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faReceipt,
  faInfoCircle,
  faCreditCard,
  faCircleCheck,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";

/**
 * Billing — post-paid, metered, per live IP tested. Mirrors the live Stripe
 * graduated metered price ($10 / $8 / $6). No upfront purchase; the consolidated
 * buyer is invoiced monthly on actual consumption.
 */
const BANDS = [
  { label: "1 – 100 IPs", from: 0, to: 100, rate: 10 },
  { label: "101 – 1,000 IPs", from: 100, to: 1000, rate: 8 },
  { label: "1,001+ IPs", from: 1000, to: Infinity, rate: 6 },
];

function estimateBill(ips: number): number {
  let remaining = Math.max(0, ips);
  let cost = 0;
  for (const b of BANDS) {
    const width = b.to - b.from;
    const n = Math.min(remaining, width);
    if (n <= 0) break;
    cost += n * b.rate;
    remaining -= n;
  }
  return cost;
}

export default function BillingPage() {
  const router = useRouter();
  const [consumed, setConsumed] = useState<number>(0);
  const [hasPool, setHasPool] = useState(false);
  const [loading, setLoading] = useState(true);
  const [billingStatus, setBillingStatus] = useState<{
    isSupplier: boolean;
    activated?: boolean;
    paymentTier?: "auto" | "net30" | null;
    suspended?: boolean;
  } | null>(null);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    (async () => {
      const { getAuth, onAuthStateChanged } = await import("firebase/auth");
      const app = (await import("@/lib/firebase/firebaseClient")).default;
      const auth = getAuth(app);
      const unsub = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          router.replace("/login");
          return;
        }
        try {
          const token = await user.getIdToken();
          const auth = { Authorization: `Bearer ${token}` };
          const [orgsRes, billRes] = await Promise.all([
            fetch("/api/orgs", { headers: auth }),
            fetch("/api/billing/status", { headers: auth }),
          ]);
          if (orgsRes.ok) {
            const d = await orgsRes.json();
            const pool = (d.pools || [])[0];
            if (pool) {
              setHasPool(true);
              setConsumed(pool?.consumed?.ip ?? 0);
            }
          }
          if (billRes.ok) setBillingStatus(await billRes.json());
        } catch {
          /* ignore */
        }
        setLoading(false);
      });
      return unsub;
    })();
  }, [router]);

  const bill = useMemo(() => estimateBill(consumed), [consumed]);

  const startBillingSetup = async () => {
    setActivating(true);
    try {
      const { getAuth } = await import("firebase/auth");
      const app = (await import("@/lib/firebase/firebaseClient")).default;
      const user = getAuth(app).currentUser;
      if (!user) {
        router.replace("/login");
        return;
      }
      const res = await fetch("/api/billing/setup-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const d = await res.json();
      if (res.ok && d.url) {
        window.location.href = d.url; // → Stripe Checkout (card collection)
      } else {
        alert(d.error || "Could not start billing setup");
        setActivating(false);
      }
    } catch {
      alert("Could not start billing setup");
      setActivating(false);
    }
  };

  // Show the card-on-file CTA to a supplier admin who isn't yet on auto-charge.
  const showActivateCard =
    billingStatus?.isSupplier && billingStatus.paymentTier !== "auto";

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing</h1>
          <p className="text-[#7a9bb5] mt-1 text-sm">
            Post-paid, monthly — billed for the AI pentests run across your
            organization, per live IP tested. No upfront purchase.
          </p>
        </div>

        {/* Payment method / suspension banner */}
        {!loading && billingStatus?.suspended && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
            />
            <p className="text-red-200">
              A recent invoice payment failed. Please update your payment method to
              avoid interruption.
            </p>
          </div>
        )}
        {!loading && showActivateCard && (
          <div className="rounded-xl border border-[#4590e2]/30 bg-[#0d1e30] p-6">
            <div className="flex items-start gap-3">
              <FontAwesomeIcon
                icon={faCreditCard}
                className="mt-0.5 h-5 w-5 shrink-0 text-[#4590e2]"
              />
              <div className="flex-1">
                <h2 className="text-base font-semibold text-white">
                  Add a payment method to activate billing
                </h2>
                <p className="mt-1 text-sm text-[#7a9bb5]">
                  Put a card on file so your monthly usage auto-charges. No charge now
                  — you&apos;re billed at month-end on actual consumption.
                </p>
                <button
                  onClick={startBillingSetup}
                  disabled={activating}
                  className="mt-4 rounded-lg bg-[#4590e2] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3a7fc9] disabled:opacity-60"
                >
                  {activating ? "Redirecting…" : "Add payment method"}
                </button>
              </div>
            </div>
          </div>
        )}
        {!loading && billingStatus?.paymentTier === "auto" && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
            <FontAwesomeIcon
              icon={faCircleCheck}
              className="h-4 w-4 shrink-0 text-emerald-400"
            />
            <p className="text-emerald-100">
              Card on file — monthly usage auto-charges.
            </p>
          </div>
        )}

        {/* This cycle */}
        <div className="bg-[#0d1e30] border border-[#4590e2]/20 rounded-xl p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[#7a9bb5] mb-3">
            <FontAwesomeIcon icon={faReceipt} className="w-3.5 h-3.5" /> This cycle
          </div>
          {loading ? (
            <div className="h-10 w-40 bg-[#0a141f] rounded animate-pulse" />
          ) : hasPool ? (
            <div className="flex flex-wrap items-end gap-10">
              <div>
                <p className="text-3xl font-bold text-white tabular-nums">
                  {consumed}
                </p>
                <p className="text-[#7a9bb5] text-xs mt-1">IPs tested</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-[#4590e2] tabular-nums">
                  ${bill.toLocaleString()}
                </p>
                <p className="text-[#7a9bb5] text-xs mt-1">
                  Estimated invoice (graduated)
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[#7a9bb5] text-sm">
              Your usage rolls up to your distributor&apos;s consolidated invoice
              — nothing to pay here directly.
            </p>
          )}
          <p className="text-[11px] text-[#7a9bb5] mt-4">
            Invoiced at month-end on actual consumption. Re-tests count. Only the
            consolidated buyer is billed.
          </p>
        </div>

        {/* Rate card */}
        <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#4590e2]/10">
            <h2 className="text-sm font-semibold text-white">
              Rate card — per IP / month (graduated)
            </h2>
            <p className="text-[11px] text-[#7a9bb5] mt-0.5">
              Higher volume, lower per-IP rate. Applied in bands, so growth is
              rewarded automatically.
            </p>
          </div>
          <div className="divide-y divide-[#4590e2]/10">
            {BANDS.map((b) => (
              <div
                key={b.label}
                className="flex items-center justify-between px-6 py-3.5"
              >
                <span className="text-sm text-white">{b.label}</span>
                <span className="text-sm font-semibold text-[#4590e2] tabular-nums">
                  ${b.rate.toFixed(2)} / IP
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-3 text-xs text-[#7a9bb5] bg-[#4590e2]/5 border border-[#4590e2]/15 rounded-xl p-4">
          <FontAwesomeIcon
            icon={faInfoCircle}
            className="w-4 h-4 text-[#4590e2] mt-0.5 shrink-0"
          />
          <p>
            Graduated example: 1,500 IPs in a month = 100×$10 + 900×$8 + 500×$6 ={" "}
            <b className="text-white">$11,200</b> (~$7.47 / IP effective).
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
