import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — MSP Pentesting",
  description:
    "AI penetration testing billed per live IP. Self-serve pay-as-you-go, or volume pricing for distributors and MSPs at scale.",
};

/**
 * Public pricing — one product (AI pentest, per live IP) in two tiers:
 *  - Self-serve (Tier 2): the entry rate, shown + self-serve sign-up.
 *  - Distributor / volume (Tier 1): volume discounts + net terms, form-gated.
 * Human-led (manual) pentests are a quiet on-request option (→ contact sales).
 */

const check = (
  <svg
    className="w-5 h-5 text-emerald-400 mr-3 flex-shrink-0 mt-0.5"
    fill="currentColor"
    viewBox="0 0 20 20"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const SELF_SERVE_FEATURES = [
  "AI penetration test, $20 per live IP",
  "Buy IP credits in any amount — no subscription",
  "Credits never expire; one credit = one live IP tested",
  "Graduated pricing — cheaper per IP as you buy more",
  "Findings + downloadable reports in your dashboard",
];

const DISTRIBUTOR_FEATURES = [
  "Everything in self-serve, plus:",
  "Volume pricing — rate drops to $8 then $6 / IP as you scale",
  "Net-30 consolidated billing — one invoice across all clients",
  "Multi-tenant org tree — resellers and end clients",
  "White-label reports and client portal",
  "Dedicated onboarding and support",
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0a141f] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-[#4590e2] text-xs font-semibold uppercase tracking-[0.2em] mb-3">
            AI Penetration Testing · Per IP
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            Simple pricing — pay per IP you test
          </h1>
          <p className="text-lg text-[#7a9bb5] max-w-2xl mx-auto">
            One product: an AI pentest, billed only for the live IPs it tests.
            Start self-serve, or talk to us for volume pricing and consolidated
            billing at scale.
          </p>
        </div>

        {/* Two tiers */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch">
          {/* Self-serve */}
          <div className="rounded-2xl border border-[#4590e2]/20 bg-[#0d1e30] p-8 flex flex-col">
            <h3 className="text-xl font-bold text-white">Self-serve</h3>
            <p className="mt-1 text-sm text-[#7a9bb5]">
              Prepaid credits — buy what you need, no subscription.
            </p>
            <div className="mt-6 flex items-baseline">
              <span className="text-5xl font-extrabold text-white">$20</span>
              <span className="ml-2 text-[#7a9bb5]">/ live IP</span>
            </div>
            <ul className="mt-8 space-y-3 flex-grow">
              {SELF_SERVE_FEATURES.map((f) => (
                <li key={f} className="flex items-start">
                  {check}
                  <span className="text-sm text-gray-200">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/login?redirect=/app"
              className="mt-8 w-full inline-flex items-center justify-center rounded-lg bg-[#4590e2] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#3a7bc8]"
            >
              Get started
            </Link>
          </div>

          {/* Distributor / volume — form-gated */}
          <div className="relative rounded-2xl border border-[#4590e2] bg-[#0d1e30] p-8 flex flex-col shadow-xl">
            <div className="absolute -top-3 left-8 rounded-full bg-[#4590e2] px-3 py-1 text-xs font-semibold text-white">
              For MSPs &amp; distributors
            </div>
            <h3 className="text-xl font-bold text-white">Distributor / Volume</h3>
            <p className="mt-1 text-sm text-[#7a9bb5]">
              Volume pricing and net terms for resellers and MSPs at scale.
            </p>
            <div className="mt-6 flex items-baseline">
              <span className="text-5xl font-extrabold text-white">Custom</span>
              <span className="ml-2 text-[#7a9bb5]">volume pricing</span>
            </div>
            <ul className="mt-8 space-y-3 flex-grow">
              {DISTRIBUTOR_FEATURES.map((f, i) => (
                <li key={f} className="flex items-start">
                  {i === 0 ? (
                    <span className="text-sm font-medium text-[#7a9bb5]">
                      {f}
                    </span>
                  ) : (
                    <>
                      {check}
                      <span className="text-sm text-gray-200">{f}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <Link
              href="/contact-sales"
              className="mt-8 w-full inline-flex items-center justify-center rounded-lg border border-[#4590e2] bg-transparent px-6 py-3 font-semibold text-white transition-colors hover:bg-[#4590e2]/10"
            >
              Contact sales
            </Link>
          </div>
        </div>

        {/* Human-led / manual — quiet on-request */}
        <div className="mt-10 max-w-4xl mx-auto rounded-xl border border-[#4590e2]/15 bg-[#0d1e30]/50 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-[#7a9bb5]">
            Need a <span className="text-white font-medium">human-led</span>{" "}
            engagement? Manual pentests by CEH- and OSCP-certified professionals
            are available on request.
          </p>
          <Link
            href="/contact-sales"
            className="shrink-0 text-sm font-semibold text-[#4590e2] hover:underline"
          >
            Talk to us →
          </Link>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto mt-20">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "What counts as a “live IP”?",
                a: "Each distinct IP, host, or URL an AI pentest actually tests. Ranges (CIDRs) expand to their live hosts. You're billed only for what's tested — re-tests included.",
              },
              {
                q: "When am I charged?",
                a: "Self-serve is prepaid — you buy IP credits upfront and spend them as you launch pentests (they don't expire). Distributors are billed post-paid, monthly, on consolidated consumption across their whole subtree, with net terms available.",
              },
              {
                q: "How do the volume discounts work?",
                a: "Self-serve is graduated: the first 100 IPs at $20, the next band at $18, and 1,000+ at $12 — bigger purchases get a lower effective rate. Distributors and MSPs at scale get substantially lower volume rates (down to $6/IP) on consolidated billing — contact sales.",
              },
              {
                q: "Do you offer human-led (manual) pentests?",
                a: "Yes — manual engagements by CEH- and OSCP-certified professionals are available on request. Contact sales to scope one.",
              },
            ].map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-[#4590e2]/15 bg-[#0d1e30] p-6"
              >
                <h3 className="text-base font-semibold text-white mb-2">
                  {item.q}
                </h3>
                <p className="text-sm text-[#7a9bb5]">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
