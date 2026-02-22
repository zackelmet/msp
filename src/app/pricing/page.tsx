'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { loadStripe } from '@stripe/stripe-js';
import toast from 'react-hot-toast';

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

const AI_PENTEST_TIERS: PricingTier[] = [
  {
    id: 'ai_single',
    name: 'Single AI Pentest',
    price: 199,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_AI_SINGLE || '',
    description: 'One-time AI-driven automated penetration test',
    type: 'one-time',
    cta: 'Purchase Scan',
    features: [
      'AI-powered vulnerability scanning',
      'Nmap network discovery',
      'OpenVAS vulnerability assessment',
      'OWASP ZAP web application testing',
      'Automated findings report',
      'Up to 5 targets per scan',
      'Export results (PDF/JSON)',
    ],
  },
  {
    id: 'ai_monthly',
    name: 'Unlimited AI Pentests',
    price: 499,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_AI_MONTHLY || '',
    description: 'Unlimited AI-driven pentests, run anytime',
    type: 'subscription',
    cta: 'Subscribe Now',
    popular: true,
    features: [
      'Unlimited AI-powered scans',
      'Priority scan queue',
      'Advanced scan configurations',
      'Automated scheduling',
      'Historical trend analysis',
      'Unlimited targets',
      'API access',
      'Email alerts',
    ],
  },
];

const MANUAL_PENTEST_TIERS: PricingTier[] = [
  {
    id: 'manual_basic',
    name: 'Basic Manual Pentest',
    price: 2000,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_MANUAL_BASIC || '',
    description: 'Professional manual testing by certified experts',
    type: 'one-time',
    cta: 'Request Service',
    features: [
      'Certified pentesting team',
      'Up to 3 targets/applications',
      'OWASP Top 10 coverage',
      '40 hours of testing',
      'Executive summary report',
      'Detailed technical findings',
      'Remediation recommendations',
      '2 weeks engagement timeline',
    ],
  },
  {
    id: 'manual_advanced',
    name: 'Advanced Manual Pentest',
    price: 5000,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_MANUAL_ADVANCED || '',
    description: 'Comprehensive testing for complex infrastructure',
    type: 'one-time',
    cta: 'Request Service',
    popular: true,
    features: [
      'Senior pentesting specialists',
      'Unlimited targets',
      'Full-scope testing (web, network, API, mobile)',
      '120 hours of testing',
      'Executive and board-level reports',
      'Detailed technical documentation',
      'Remediation support and retesting',
      'Compliance mapping (PCI-DSS, SOC2)',
      '4-6 weeks engagement timeline',
      'Dedicated project manager',
    ],
  },
];

export default function PricingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser: user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    // Check for canceled checkout
    if (searchParams.get('canceled')) {
      toast.error('Checkout canceled');
    }
  }, [searchParams]);

  const handleCheckout = async (tier: PricingTier) => {
    if (!user) {
      router.push('/login?redirect=/pricing');
      return;
    }

    // For manual pentests, redirect to request form instead of immediate checkout
    if (tier.id.startsWith('manual_')) {
      router.push(`/app/request-pentest?tier=${tier.id}`);
      return;
    }

    setLoading(tier.id);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: tier.priceId,
          userId: user.uid,
          email: user.email,
          productType: tier.type,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
      setLoading(null);
    }
  };

  const renderTierCard = (tier: PricingTier) => (
    <div
      key={tier.id}
      className={`relative rounded-lg border ${
        tier.popular
          ? 'border-blue-500 shadow-xl scale-105'
          : 'border-gray-200 shadow-lg'
      } bg-white p-8 flex flex-col`}
    >
      {tier.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
          Most Popular
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
        <p className="text-gray-600 text-sm mb-4">{tier.description}</p>
        <div className="flex items-baseline">
          <span className="text-5xl font-extrabold text-gray-900">
            ${tier.price.toLocaleString()}
          </span>
          {tier.type === 'subscription' && (
            <span className="ml-2 text-gray-600">/month</span>
          )}
        </div>
      </div>

      <ul className="space-y-3 mb-8 flex-grow">
        {tier.features.map((feature, idx) => (
          <li key={idx} className="flex items-start">
            <svg
              className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-gray-700 text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => handleCheckout(tier)}
        disabled={loading === tier.id}
        className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
          tier.popular
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-800 hover:bg-gray-900 text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading === tier.id ? 'Loading...' : tier.cta}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-extrabold text-gray-900 mb-4">
            Pricing Plans
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose the right penetration testing solution for your needs.
            From AI-driven automated scans to comprehensive manual testing.
          </p>
        </div>

        {/* AI Pentests Section */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              AI-Driven Automated Pentests
            </h2>
            <p className="text-gray-600">
              Lightning-fast vulnerability scanning powered by AI
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {AI_PENTEST_TIERS.map(renderTierCard)}
          </div>
        </div>

        {/* Manual Pentests Section */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Manual Penetration Testing
            </h2>
            <p className="text-gray-600">
              Expert-led security assessments by certified professionals
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {MANUAL_PENTEST_TIERS.map(renderTierCard)}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mt-20">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                What&apos;s the difference between AI and manual pentests?
              </h3>
              <p className="text-gray-600">
                AI pentests use automated scanning tools to quickly identify common vulnerabilities.
                Manual pentests involve human experts who perform deep analysis, test business logic,
                and find complex security issues that automated tools might miss.
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                How long does a manual pentest take?
              </h3>
              <p className="text-gray-600">
                Basic engagements typically take 2 weeks, while advanced pentests require 4-6 weeks
                depending on scope and complexity. We&apos;ll provide a detailed timeline during consultation.
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Can I cancel my AI pentest subscription?
              </h3>
              <p className="text-gray-600">
                Yes, you can cancel your subscription anytime from your account dashboard.
                You&apos;ll retain access until the end of your current billing period.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
