"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBolt,
  faArrowRight,
  faCircleCheck,
  faInfoCircle,
  faHeadset,
} from "@fortawesome/free-solid-svg-icons";
import {
  AI_PENTEST_TIERS,
  computeAiPentestPricing,
} from "@/lib/pricing/aiPentest";

export default function BuyCreditsPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justPurchased, setJustPurchased] = useState(false);
  const [canceled, setCanceled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setJustPurchased(params.get("success") === "true");
    setCanceled(params.get("canceled") === "true");
  }, []);

  const pricing = useMemo(
    () => computeAiPentestPricing(quantity || 1),
    [quantity],
  );

  useEffect(() => {
    let unsubDoc: (() => void) | undefined;
    (async () => {
      const { getAuth, onAuthStateChanged } = await import("firebase/auth");
      const { getFirestore, doc, onSnapshot } = await import(
        "firebase/firestore"
      );
      const firebase_app = (await import("@/lib/firebase/firebaseClient"))
        .default;
      const auth = getAuth(firebase_app);
      const db = getFirestore(firebase_app);

      onAuthStateChanged(auth, (user) => {
        if (!user) {
          router.replace("/login");
          return;
        }
        setUid(user.uid);
        setEmail(user.email);
        unsubDoc = onSnapshot(doc(db, "users", user.uid), (snap) => {
          setBalance(snap.data()?.credits?.ai_pentest ?? 0);
        });
      });
    })();
    return () => unsubDoc?.();
  }, [router]);

  const handleBuy = async () => {
    if (!uid) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType: "ai_pentest",
          quantity: pricing.quantity,
          userId: uid,
          email,
          successUrl: "/app/buy-credits?success=true",
          cancelUrl: "/app/buy-credits?canceled=true",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout");
      }
      window.location.href = data.url;
    } catch (e: any) {
      setError(e.message || "Something went wrong");
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FontAwesomeIcon icon={faBolt} className="text-[#4590e2]" />
            Buy AI Pentest Credits
          </h1>
          <p className="text-[#7a9bb5] mt-1 text-sm">
            One credit launches an autonomous AI pentest against one IP, domain,
            or URL. Volume pricing — the more you buy, the lower the per-IP rate.
          </p>
        </div>

        {justPurchased && (
          <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 text-green-300 rounded-xl px-5 py-4 text-sm">
            <FontAwesomeIcon icon={faCircleCheck} />
            Payment received. Your credits will appear below within a few seconds.
          </div>
        )}
        {canceled && (
          <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 rounded-xl px-5 py-4 text-sm">
            <FontAwesomeIcon icon={faInfoCircle} />
            Checkout canceled — no charge was made.
          </div>
        )}

        {/* Current balance */}
        <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl px-6 py-5 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#7a9bb5]">
              Your AI Pentest Credits
            </div>
            <div className="text-3xl font-bold text-white mt-1">
              {balance === null ? "—" : balance}
            </div>
          </div>
          <Link
            href="/app/ai-pentest-launch"
            className="flex items-center gap-2 px-4 py-2 border border-[#4590e2]/40 text-[#4590e2] hover:bg-[#4590e2]/10 text-sm font-semibold rounded-lg transition-colors"
          >
            Launch a Pentest
            <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
          </Link>
        </div>

        {/* Tier table */}
        <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#4590e2]/15">
            <h2 className="text-sm font-semibold text-white">Volume Pricing</h2>
          </div>
          <div className="divide-y divide-[#4590e2]/10">
            {AI_PENTEST_TIERS.map((t) => {
              const active = t.label === pricing.tierLabel;
              return (
                <div
                  key={t.label}
                  className={`flex items-center justify-between px-6 py-4 ${
                    active ? "bg-[#4590e2]/10" : ""
                  }`}
                >
                  <span
                    className={`text-sm ${active ? "text-[#4590e2] font-semibold" : "text-white"}`}
                  >
                    {t.label}
                  </span>
                  <span
                    className={`text-sm ${active ? "text-[#4590e2] font-semibold" : "text-[#7a9bb5]"}`}
                  >
                    ${t.ratePerIpCents / 100} / IP
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quantity + total */}
        <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl px-6 py-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs uppercase tracking-widest text-[#7a9bb5] mb-2">
                Number of IPs
              </label>
              <input
                type="number"
                min={1}
                max={10000}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-[#0a141f] border border-[#4590e2]/20 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-[#4590e2]"
              />
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest text-[#7a9bb5]">
                Total
              </div>
              <div className="text-3xl font-bold text-white">
                ${pricing.totalDollars.toLocaleString()}
              </div>
              <div className="text-xs text-[#7a9bb5]">
                {pricing.quantity} × ${pricing.ratePerIpDollars}/IP
              </div>
            </div>
          </div>

          {pricing.nextTier && (
            <div className="flex items-center gap-2 text-xs text-[#4590e2] bg-[#4590e2]/5 border border-[#4590e2]/20 rounded-lg px-4 py-2.5">
              <FontAwesomeIcon icon={faInfoCircle} />
              Add {pricing.nextTier.addIps} more IP
              {pricing.nextTier.addIps === 1 ? "" : "s"} to reach $
              {pricing.nextTier.ratePerIpCents / 100}/IP.
            </div>
          )}

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}

          <button
            onClick={handleBuy}
            disabled={submitting || !uid || pricing.quantity < 1}
            className="w-full px-4 py-3.5 bg-[#4590e2] hover:bg-[#3a7bc8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              "Redirecting to checkout…"
            ) : (
              <>
                Buy {pricing.quantity} Credit{pricing.quantity === 1 ? "" : "s"}{" "}
                — ${pricing.totalDollars.toLocaleString()}
                <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
              </>
            )}
          </button>
        </div>

        {/* Continuous testing CTA */}
        <div className="bg-gradient-to-r from-[#0d1e30] to-[#0d1e30] border border-[#4590e2]/20 rounded-xl px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <FontAwesomeIcon
              icon={faHeadset}
              className="text-[#4590e2] mt-0.5"
            />
            <div>
              <p className="text-sm font-semibold text-white">
                Testing continuously?
              </p>
              <p className="text-xs text-[#7a9bb5] mt-0.5">
                We offer deeper discounts for ongoing / recurring pentesting
                programs. Let&apos;s put together a custom plan.
              </p>
            </div>
          </div>
          <a
            href="mailto:zack@msppentesting.com?subject=Continuous%20AI%20Pentesting%20Discount"
            className="whitespace-nowrap px-4 py-2 border border-[#4590e2]/40 text-[#4590e2] hover:bg-[#4590e2]/10 text-sm font-semibold rounded-lg transition-colors text-center"
          >
            Contact Sales
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}
