"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/context/AuthContext";
import { loadStripe } from '@stripe/stripe-js';
import toast from 'react-hot-toast';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRobot,
  faBolt,
  faChartLine,
  faLock,
  faBullseye,
  faShield,
} from "@fortawesome/free-solid-svg-icons";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PricingTier {
  id: string;
  name: string;
  price: number;
  priceId: string;
  description: string;
  features: string[];
  popular?: boolean;
  type: 'one-time' | 'subscription';
  cta: string;
}

const PRICING_TIERS: PricingTier[] = [
  {
    id: 'external_ip',
    name: 'External IP Pentest',
    price: 199,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_AI_SINGLE || '',
    description: 'Gateways, firewalls, and external infrastructure',
    type: 'one-time',
    cta: 'Purchase Credit',
    features: [
      '1 External IP pentest credit',
      'Autonomous AI penetration testing',
      'Powered by Anthropic Claude agents',
      'Network vulnerability assessment',
      'Firewall & gateway testing',
      'Detailed findings report',
      'Remediation guidance',
      'Results within 24 hours',
    ],
  },
  {
    id: 'web_app',
    name: 'Web Application Pentest',
    price: 500,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_WEB_APP || '',
    description: 'Up to 3 user roles and 10 endpoints',
    type: 'one-time',
    cta: 'Purchase Credit',
    popular: true,
    features: [
      '1 Web Application pentest credit',
      'Autonomous AI penetration testing',
      'Powered by Anthropic Claude agents',
      'Up to 3 user roles tested',
      'Up to 10 API endpoints',
      'Authentication & authorization testing',
      'Detailed findings report',
      'Results within 48 hours',
    ],
  },
];

export default function Home() {
  const { currentUser } = useAuth();
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);

  const handleStartPentest = () => {
    if (!currentUser) {
      window.location.href = `/login?returnUrl=${encodeURIComponent('/app/new-pentest')}`;
      return;
    }
    window.location.href = '/app/new-pentest';
  };

  const handleCheckout = async (tier: PricingTier) => {
    if (!currentUser) {
      window.location.href = `/login?returnUrl=${encodeURIComponent('/#pricing')}`;
      return;
    }

    setLoadingCheckout(tier.id);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: tier.priceId,
          mode: 'payment',
          quantity: 1,
          userId: currentUser.uid,
          email: currentUser.email,
          metadata: { pentestType: tier.id }, // 'web_app' or 'external_ip'
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create checkout session');

      // Redirect directly to Stripe-hosted checkout URL
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      const { default: toast } = await import('react-hot-toast');
      toast.error(error.message || 'Failed to start checkout');
    } finally {
      setLoadingCheckout(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a141f] text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4590e2]/10 via-transparent to-transparent" />
        <div className="max-w-7xl mx-auto px-6 py-20 lg:py-32 relative">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight">
              <span className="block text-white">Penetration Testing</span>
              <span className="block text-[#4590e2] mt-2">Made Simple</span>
            </h1>
            <p className="text-xl lg:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              AI-powered penetration testing driven by Anthropic Claude agentic systems. 
              Choose between Web Application ($500) or External IP ($199) pentests.
            </p>
            <div className="flex justify-center pt-4">
              <button
                onClick={handleStartPentest}
                className="px-12 py-5 bg-[#4590e2] hover:bg-[#3a7bc8] text-white font-bold rounded-lg transition-colors text-xl"
              >
                Start Your Pentest
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-[#0a141f]/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Why Choose <span className="text-[#4590e2]">MSP Pentesting</span>
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Professional security testing without the complexity
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="bg-white/5 border border-[#4590e2]/20 rounded-lg p-8 hover:border-[#4590e2]/40 transition-colors"
              >
                <div className="text-[#4590e2] mb-4">
                  <FontAwesomeIcon icon={feature.icon} className="text-4xl" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-white">
                  {feature.title}
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Simple, Transparent <span className="text-[#4590e2]">Pricing</span>
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Purchase credits for the pentests you need
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {PRICING_TIERS.map((tier) => (
              <PricingCard
                key={tier.id}
                tier={tier}
                onSelect={() => handleCheckout(tier)}
                loading={loadingCheckout === tier.id}
                currentUser={currentUser}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-[#4590e2]/20 to-[#4590e2]/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            Ready to Secure Your Systems?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Get started with AI-powered penetration testing. Purchase credits and run your first test in minutes.
          </p>
          <button
            onClick={handleStartPentest}
            className="inline-block px-10 py-5 bg-[#4590e2] hover:bg-[#3a7bc8] text-white font-bold rounded-lg transition-colors text-xl"
          >
            {currentUser ? "Start Your Pentest" : "Get Started"}
          </button>
        </div>
      </section>
    </main>
  );
}

const features = [
  {
    icon: faRobot,
    title: "AI-Powered Pentests",
    description:
      "Advanced Anthropic Claude agentic systems autonomously conduct penetration tests, identifying vulnerabilities and security weaknesses across your infrastructure.",
  },
  {
    icon: faBolt,
    title: "Fast Results",
    description:
      "Complete comprehensive security assessments delivered within 24 hours of target submission.",
  },
  {
    icon: faChartLine,
    title: "Actionable Reports",
    description:
      "Get detailed findings with severity ratings, exploitation steps, and clear remediation guidance you can act on immediately.",
  },
  {
    icon: faLock,
    title: "Compliance Ready",
    description:
      "Meet PCI-DSS, HIPAA, SOC 2, and other compliance requirements with our comprehensive testing methodology.",
  },
  {
    icon: faBullseye,
    title: "Transparent Pricing",
    description:
      "$199 per External IP pentest or $500 per Web Application pentest. No subscriptions, no hidden fees, no surprises.",
  },
  {
    icon: faShield,
    title: "Complete Coverage",
    description:
      "Comprehensive AI-powered penetration testing performed by advanced Anthropic Claude agentic systems that autonomously identify and exploit vulnerabilities.",
  },
];

interface PricingCardProps {
  tier: PricingTier;
  onSelect: () => void;
  loading: boolean;
  currentUser: any;
}

function PricingCard({ tier, onSelect, loading, currentUser }: PricingCardProps) {
  return (
    <div
      className={`relative bg-white/5 rounded-xl p-8 border-2 transition-all hover:scale-105 ${
        tier.popular
          ? "border-[#4590e2] shadow-lg shadow-[#4590e2]/20"
          : "border-white/10"
      }`}
    >
      {tier.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#4590e2] text-white px-4 py-1 rounded-full text-sm font-bold">
          MOST POPULAR
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
        <p className="text-gray-400 text-sm mb-4">{tier.description}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-extrabold text-white">
            ${tier.price.toLocaleString()}
          </span>
          {tier.type === 'subscription' && (
            <span className="text-gray-400">/month</span>
          )}
        </div>
      </div>

      <ul className="space-y-3 mb-8">
        {tier.features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-3 text-gray-300">
            <span className="text-[#4590e2] mt-1">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect()}
        disabled={loading}
        className={`w-full py-4 rounded-lg font-bold text-lg transition-colors ${
          tier.popular
            ? "bg-[#4590e2] hover:bg-[#3a7bc8] text-white"
            : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading ? "Processing..." : currentUser ? tier.cta : "Sign In to Purchase"}
      </button>
    </div>
  );
}
