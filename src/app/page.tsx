"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/context/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClipboardList,
  faShieldHalved,
  faFileLines,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";

export default function Home() {
  const { currentUser, isLoadingAuth } = useAuth();

  return (
    <main className="min-h-screen bg-[#0a141f] text-white">

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4590e2]/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 py-24 lg:py-40 text-center relative space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#4590e2]/10 border border-[#4590e2]/30 text-[#4590e2] text-sm font-semibold mb-2">
            <Image
              src="/msp pentesting logo (1) (3) (1).png"
              alt="MSP Pentesting"
              width={20}
              height={20}
              className="w-5 h-5"
            />
            MSP Pentesting Client Portal
          </div>
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-tight">
            Request and track your
            <span className="block text-[#4590e2] mt-1">penetration tests</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Submit pentest requests, monitor progress in real time, and download
            your reports — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            {!isLoadingAuth && !currentUser ? (
              <>
                <Link
                  href="/login"
                  className="px-10 py-4 bg-[#4590e2] hover:bg-[#3a7bc8] text-white font-bold rounded-lg transition-colors text-lg"
                >
                  Log In to Your Portal
                </Link>
                <a
                  href="https://msppentesting.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-10 py-4 bg-white/5 hover:bg-white/10 border border-white/20 text-white font-semibold rounded-lg transition-colors text-lg"
                >
                  Not a client yet? →
                </a>
              </>
            ) : !isLoadingAuth && currentUser ? (
              <Link
                href="/app/dashboard"
                className="px-10 py-4 bg-[#4590e2] hover:bg-[#3a7bc8] text-white font-bold rounded-lg transition-colors text-lg"
              >
                Go to Dashboard
                <FontAwesomeIcon icon={faArrowRight} className="ml-3" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 border-t border-white/10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-3">How it works</h2>
            <p className="text-gray-400 text-lg">Three steps from request to report</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: faClipboardList,
                title: "Submit a Request",
                desc: "Log in and submit an AI or manual pentest request. Provide your target, scope, and any notes for our team.",
              },
              {
                step: "02",
                icon: faShieldHalved,
                title: "We Test",
                desc: "Our team conducts your penetration test — AI-automated or manually by OSCP-certified experts.",
              },
              {
                step: "03",
                icon: faFileLines,
                title: "Get Your Report",
                desc: "Receive a detailed findings report with severity ratings, exploitation details, and remediation guidance.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative bg-white/5 border border-white/10 hover:border-[#4590e2]/40 rounded-xl p-8 transition-colors"
              >
                <span className="absolute top-6 right-6 text-[#4590e2]/20 font-extrabold text-5xl leading-none select-none">
                  {item.step}
                </span>
                <div className="p-3 rounded-lg bg-[#4590e2]/15 border border-[#4590e2]/30 inline-flex mb-5">
                  <FontAwesomeIcon icon={item.icon} className="text-[#4590e2] text-2xl" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400 leading-relaxed text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 border-t border-white/10 bg-gradient-to-r from-[#4590e2]/10 to-transparent">
        <div className="max-w-3xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-3xl font-bold">Not yet an MSP Pentesting client?</h2>
          <p className="text-gray-400 text-lg">
            Visit{" "}
            <a
              href="https://msppentesting.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#4590e2] hover:underline font-semibold"
            >
              msppentesting.com
            </a>{" "}
            to learn about our services and get a quote.
          </p>
          <a
            href="https://msppentesting.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-10 py-4 bg-[#4590e2] hover:bg-[#3a7bc8] text-white font-bold rounded-lg transition-colors text-lg"
          >
            Visit MSP Pentesting
          </a>
        </div>
      </section>

    </main>
  );
}
