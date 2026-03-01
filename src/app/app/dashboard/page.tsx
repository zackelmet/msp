"use client";

export const runtime = 'edge';

import { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faShieldHalved,
  faRocket,
  faSatelliteDish,
  faGlobe,
  faServer,
  faPlus,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import { useUserData } from "@/lib/hooks/useUserData";
import { useUserScans } from "@/lib/hooks/useUserScans";
import { useAuth } from "@/lib/context/AuthContext";
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { userData, loading } = useUserData();
  const { currentUser } = useAuth();
  const { scans: userScans = [], loading: scansLoading } = useUserScans(
    currentUser?.uid ?? null,
  );
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedPentestType, setSelectedPentestType] = useState<'web_app' | 'external_ip' | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const credits = useMemo(() => {
    return {
      web_app: userData?.credits?.web_app || 0,
      external_ip: userData?.credits?.external_ip || 0,
    };
  }, [userData]);

  const recentScans = useMemo(() => {
    return userScans.slice(0, 5);
  }, [userScans]);

  const handlePurchaseCredits = async (pentestType: 'web_app' | 'external_ip', quantity: number) => {
    setLoadingCheckout(true);

    try {
      const priceId = pentestType === 'web_app' 
        ? (process.env.NEXT_PUBLIC_STRIPE_PRICE_WEB_APP || process.env.NEXT_PUBLIC_STRIPE_PRICE_AI_SINGLE)
        : process.env.NEXT_PUBLIC_STRIPE_PRICE_AI_SINGLE;

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: priceId,
          mode: 'payment',
          quantity: quantity,
          userId: currentUser?.uid,
          email: currentUser?.email,
          metadata: {
            pentestType: pentestType,
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
    } finally {
      setLoadingCheckout(false);
    }
  };

  const openPurchaseModal = (type: 'web_app' | 'external_ip') => {
    setSelectedPentestType(type);
    setPurchaseQuantity(1);
    setShowPurchaseModal(true);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-500">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">Manage your pentests and credits</p>
        </div>

        {/* Credits Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Web App Credits Card */}
          <div className="bg-gradient-to-br from-[#0a141f] to-[#0a141f]/80 border border-[#4590e2]/30 rounded-xl p-6 shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg bg-[#4590e2]/20 border border-[#4590e2]/40">
                <FontAwesomeIcon icon={faGlobe} className="text-2xl text-[#4590e2]" />
              </div>
              <button
                onClick={() => openPurchaseModal('web_app')}
                className="p-2 rounded-lg bg-[#4590e2]/10 hover:bg-[#4590e2]/20 border border-[#4590e2]/30 hover:border-[#4590e2]/50 transition-colors"
                title="Purchase Web App credits"
              >
                <FontAwesomeIcon icon={faPlus} className="text-[#4590e2]" />
              </button>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Web App Credits</p>
              <p className="text-5xl font-bold text-white mb-2">{credits.web_app}</p>
              <p className="text-xs text-gray-500">$500 per credit</p>
            </div>
          </div>

          {/* External IP Credits Card */}
          <div className="bg-gradient-to-br from-[#0a141f] to-[#0a141f]/80 border border-[#4590e2]/30 rounded-xl p-6 shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg bg-[#4590e2]/20 border border-[#4590e2]/40">
                <FontAwesomeIcon icon={faServer} className="text-2xl text-[#4590e2]" />
              </div>
              <button
                onClick={() => openPurchaseModal('external_ip')}
                className="p-2 rounded-lg bg-[#4590e2]/10 hover:bg-[#4590e2]/20 border border-[#4590e2]/30 hover:border-[#4590e2]/50 transition-colors"
                title="Purchase External IP credits"
              >
                <FontAwesomeIcon icon={faPlus} className="text-[#4590e2]" />
              </button>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">External IP Credits</p>
              <p className="text-5xl font-bold text-white mb-2">{credits.external_ip}</p>
              <p className="text-xs text-gray-500">$199 per credit</p>
            </div>
          </div>

          {/* Start Pentest CTA Card */}
          <Link 
            href="/app/new-pentest"
            className="bg-gradient-to-br from-[#4590e2] to-[#3a7bc8] border border-[#4590e2] rounded-xl p-6 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex flex-col items-center justify-center text-center group"
          >
            <div className="p-4 rounded-full bg-white/10 mb-3 group-hover:bg-white/20 transition-colors">
              <FontAwesomeIcon icon={faRocket} className="text-4xl text-white" />
            </div>
            <p className="text-white font-bold text-xl mb-1">Start New Pentest</p>
            <p className="text-white/80 text-sm">Configure and launch</p>
          </Link>
        </div>

        {/* No credits banner */}
        {credits.web_app === 0 && credits.external_ip === 0 && (
          <div className="bg-gradient-to-r from-[#4590e2]/10 to-[#4590e2]/5 border border-[#4590e2]/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-[#4590e2]/20 border border-[#4590e2]/40">
                <FontAwesomeIcon icon={faShieldHalved} className="text-2xl text-[#4590e2]" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xl text-white mb-2">
                  Purchase Credits to Get Started
                </h3>
                <p className="text-gray-300 mb-4">
                  Choose between Web Application pentests ($500) or External IP pentests ($199). 
                  Our Anthropic Claude agentic systems conduct comprehensive security assessments delivered within 24-48 hours.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => openPurchaseModal('web_app')}
                    className="px-6 py-3 bg-[#4590e2] hover:bg-[#3a7bc8] text-white font-semibold rounded-lg transition-colors"
                  >
                    Buy Web App Credits
                  </button>
                  <button
                    onClick={() => openPurchaseModal('external_ip')}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg border border-white/20 transition-colors"
                  >
                    Buy External IP Credits
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Pentests */}
        {recentScans.length > 0 && (
          <div className="bg-gradient-to-br from-[#0a141f] to-[#0a141f]/80 border border-white/10 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Recent Pentests</h2>
              <Link
                href="/app/scans"
                className="text-[#4590e2] hover:text-[#3a7bc8] text-sm font-semibold transition-colors"
              >
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {recentScans.map((scan: any) => (
                <div
                  key={scan.scanId}
                  className="p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 hover:border-[#4590e2]/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-[#4590e2] text-white text-xs font-semibold rounded-full uppercase">
                          {scan.type}
                        </span>
                        <span className="font-semibold text-white">
                          {scan.target}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        {scan.status === "completed"
                          ? "✓ Completed"
                          : scan.status === "in_progress"
                            ? "⏳ Running..."
                            : "⏸ Queued"}
                      </p>
                    </div>
                    <Link
                      href={`/app/pentests/${scan.scanId}`}
                      className="px-4 py-2 bg-[#4590e2]/20 hover:bg-[#4590e2]/30 text-[#4590e2] font-semibold rounded-lg border border-[#4590e2]/30 transition-colors text-sm"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {recentScans.length === 0 && (
          <div className="bg-gradient-to-br from-[#0a141f] to-[#0a141f]/80 border border-white/10 rounded-xl p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="p-4 rounded-full bg-white/5 inline-flex mb-4">
                <FontAwesomeIcon icon={faShieldHalved} className="text-5xl text-gray-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No Pentests Yet</h3>
              <p className="text-gray-400 mb-6">
                Start your first AI-powered penetration test to identify vulnerabilities in your infrastructure.
              </p>
              <Link
                href="/app/new-pentest"
                className="inline-block px-8 py-3 bg-[#4590e2] hover:bg-[#3a7bc8] text-white font-semibold rounded-lg transition-colors"
              >
                Launch First Pentest
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Purchase Modal */}
      {showPurchaseModal && selectedPentestType && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a141f] border border-[#4590e2]/30 rounded-xl p-8 max-w-lg w-full shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Purchase Credits</h2>
                <p className="text-gray-400">
                  {selectedPentestType === 'web_app' ? 'Web Application Pentest' : 'External IP Pentest'}
                </p>
              </div>
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <FontAwesomeIcon icon={faXmark} className="text-gray-400 hover:text-white text-xl" />
              </button>
            </div>

            {/* Pentest Type Info */}
            <div className="bg-white/5 border border-[#4590e2]/20 rounded-lg p-6 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 rounded-lg bg-[#4590e2]/20 border border-[#4590e2]/40">
                  <FontAwesomeIcon 
                    icon={selectedPentestType === 'web_app' ? faGlobe : faServer} 
                    className="text-2xl text-[#4590e2]" 
                  />
                </div>
                <div>
                  <p className="text-white font-bold text-xl">
                    ${selectedPentestType === 'web_app' ? '500' : '199'} per credit
                  </p>
                  <p className="text-gray-400 text-sm">
                    {selectedPentestType === 'web_app' 
                      ? 'Up to 3 roles, 10 endpoints' 
                      : 'Gateways & firewalls'}
                  </p>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2">
                <p className="text-xs text-gray-400 font-semibold uppercase mb-2">Includes:</p>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-[#4590e2] mt-0.5">✓</span>
                    <span>Autonomous AI penetration testing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#4590e2] mt-0.5">✓</span>
                    <span>Powered by Anthropic Claude</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#4590e2] mt-0.5">✓</span>
                    <span>Results within 24-48 hours</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#4590e2] mt-0.5">✓</span>
                    <span>Detailed vulnerability report</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="bg-white/5 border border-[#4590e2]/20 rounded-lg p-6 mb-6">
              <label className="block text-center mb-4">
                <span className="text-lg font-semibold text-white">Number of Credits</span>
              </label>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setPurchaseQuantity(Math.max(1, purchaseQuantity - 1))}
                  className="px-5 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-2xl transition-colors text-white border border-white/20"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={purchaseQuantity}
                  onChange={(e) => setPurchaseQuantity(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                  className="w-28 px-4 py-3 bg-white/10 border border-[#4590e2]/40 rounded-lg text-center text-3xl font-bold focus:outline-none focus:border-[#4590e2] text-white"
                />
                <button
                  onClick={() => setPurchaseQuantity(Math.min(50, purchaseQuantity + 1))}
                  className="px-5 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-2xl transition-colors text-white border border-white/20"
                >
                  +
                </button>
              </div>
              <p className="text-center mt-6 text-xl text-gray-300">
                Total: <span className="text-[#4590e2] font-bold text-4xl">
                  ${((selectedPentestType === 'web_app' ? 500 : 199) * purchaseQuantity).toLocaleString()}
                </span>
              </p>
            </div>

            {/* Checkout Button */}
            <button
              onClick={() => handlePurchaseCredits(selectedPentestType, purchaseQuantity)}
              disabled={loadingCheckout}
              className="w-full py-4 bg-[#4590e2] hover:bg-[#3a7bc8] text-white font-bold rounded-lg text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loadingCheckout ? 'Processing...' : `Proceed to Checkout`}
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
