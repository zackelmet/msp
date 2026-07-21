"use client";

import { useMemo, useState } from "react";
import {
  computeAiPentestPricing,
  AI_PENTEST_MIN_QTY,
  AI_PENTEST_MAX_QTY,
} from "@/lib/pricing/aiPentest";

const dollars = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/**
 * Prepaid "buy IP credits" purchase for self-serve resellers under MSPP.
 * Granular quantity (any number of IPs, e.g. 26), priced with the shared
 * graduated model (single source of truth for display + the server charge),
 * → Stripe Checkout via /api/checkout; the webhook grants credits.ai_pentest.
 */
export default function BuyCreditsPanel({
  userId,
  email,
  balance,
}: {
  userId: string;
  email: string | null;
  balance: number | null;
}) {
  const [qty, setQty] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricing = useMemo(() => computeAiPentestPricing(qty || 0), [qty]);
  const valid = qty >= AI_PENTEST_MIN_QTY && qty <= AI_PENTEST_MAX_QTY;

  const buy = async () => {
    if (!valid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType: "ai_pentest",
          quantity: pricing.quantity,
          userId,
          email,
          successUrl: "/app/ai-pentest-launch?purchased=1",
          cancelUrl: "/app/buy-credits?canceled=1",
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.url) throw new Error(d.error || "Checkout failed");
      window.location.href = d.url;
    } catch (e: any) {
      setError(e.message || "Could not start checkout");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Buy pentest credits</h1>
        <p className="text-[#7a9bb5] mt-1 text-sm">
          One credit = one live IP tested. Buy any amount — they never expire and
          are spent when you launch a pentest.
          {balance !== null && (
            <>
              {" "}
              You currently have{" "}
              <span className="text-white font-semibold">{balance}</span>.
            </>
          )}
        </p>
      </div>

      <div className="bg-[#0d1e30] border border-[#4590e2]/20 rounded-xl p-6">
        <label className="block text-xs uppercase tracking-wide text-[#7a9bb5] mb-2">
          How many IP credits?
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={AI_PENTEST_MIN_QTY}
            max={AI_PENTEST_MAX_QTY}
            value={qty}
            onChange={(e) =>
              setQty(Math.floor(Number(e.target.value) || 0))
            }
            className="w-32 rounded-lg bg-[#0a141f] border border-[#4590e2]/20 px-4 py-3 text-white text-lg focus:border-[#4590e2] focus:outline-none"
          />
          <div className="flex gap-2">
            {[10, 25, 50, 100].map((n) => (
              <button
                key={n}
                onClick={() => setQty(n)}
                className="rounded-md border border-[#4590e2]/25 px-3 py-1.5 text-sm text-[#a9c6dd] hover:bg-[#4590e2]/10"
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Price breakdown */}
        <div className="mt-6 divide-y divide-[#4590e2]/10 border-t border-[#4590e2]/10">
          {pricing.breakdown.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between py-2.5 text-sm"
            >
              <span className="text-[#7a9bb5]">
                {row.ips} × {dollars(row.ratePerIpCents)}/IP
                <span className="text-[#5a7590]"> ({row.label})</span>
              </span>
              <span className="text-white tabular-nums">
                {dollars(row.subtotalCents)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-white tabular-nums">
              {dollars(pricing.totalCents)}
            </p>
            <p className="text-xs text-[#7a9bb5] mt-1">
              {pricing.quantity} IP credit{pricing.quantity === 1 ? "" : "s"} ·{" "}
              {dollars(pricing.blendedRatePerIpCents)}/IP effective
            </p>
          </div>
          <button
            onClick={buy}
            disabled={!valid || loading}
            className="rounded-lg bg-[var(--brand)] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#3a7bc8] disabled:opacity-60"
          >
            {loading ? "Redirecting…" : `Buy ${pricing.quantity} credits`}
          </button>
        </div>
        {!valid && (
          <p className="mt-2 text-xs text-red-400">
            Enter between {AI_PENTEST_MIN_QTY} and{" "}
            {AI_PENTEST_MAX_QTY.toLocaleString()} IP credits.
          </p>
        )}
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>

      <p className="text-[11px] text-[#7a9bb5]">
        Volume pricing is graduated — the rate drops as you buy more, so bigger
        purchases get a lower effective per-IP rate.
      </p>
    </div>
  );
}
