"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/context/AuthContext";

// ─── Inline SVG hexagon background grid ───────────────────────────────────────
const HEX_SVG_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='104' viewBox='0 0 120 104'%3E%3Cpolygon points='60,2 112,29 112,75 60,102 8,75 8,29' fill='none' stroke='%234590e2' stroke-width='0.6' opacity='0.18'/%3E%3C/svg%3E")`;

// ─── Single decorative hexagon (used as bg accent shapes) ─────────────────────
function DecorativeHex({
  size,
  opacity,
  className,
}: {
  size: number;
  opacity: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size * 0.866}
      viewBox="0 0 100 86.6"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ opacity }}
      aria-hidden
    >
      <polygon
        points="50,0 100,25 100,75 50,86.6 0,75 0,25"
        stroke="#4590e2"
        strokeWidth="1.5"
        fill="#4590e2"
        fillOpacity="0.06"
      />
    </svg>
  );
}

// ─── Step icon wrapped in a hexagon clip ──────────────────────────────────────
function HexIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative inline-flex items-center justify-center mb-6">
      {/* hex background */}
      <svg
        width="64"
        height="56"
        viewBox="0 0 64 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0"
        aria-hidden
      >
        <polygon
          points="32,2 61,17 61,47 32,54 3,47 3,17"
          fill="#4590e2"
          fillOpacity="0.15"
          stroke="#4590e2"
          strokeWidth="1.2"
          strokeOpacity="0.5"
        />
      </svg>
      <span className="relative z-10 text-[#4590e2] text-2xl leading-none">{children}</span>
    </div>
  );
}

export default function Home() {
  const { currentUser, isLoadingAuth } = useAuth();

  return (
    <main className="min-h-screen bg-[#0a141f] text-white overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">

        {/* Hex grid tile background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: HEX_SVG_URI, backgroundSize: "120px 104px" }}
        />

        {/* Radial gradient fade over the hex grid */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,#0a141f00_0%,#0a141f_70%)]" />

        {/* Blue glow top-left */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#4590e2]/10 blur-[120px] pointer-events-none" />

        {/* Large faded decorative hexagons */}
        <DecorativeHex
          size={520}
          opacity={0.12}
          className="absolute -right-24 top-1/2 -translate-y-1/2 hidden lg:block"
        />
        <DecorativeHex
          size={280}
          opacity={0.08}
          className="absolute -left-20 bottom-0 hidden md:block"
        />

        {/* Content */}
        <div className="max-w-4xl mx-auto px-6 py-28 lg:py-44 text-center relative z-10 space-y-8">

          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#4590e2]/10 border border-[#4590e2]/30 text-[#4590e2] text-sm font-semibold">
            <Image
              src="/msp pentesting logo (1) (3) (1).png"
              alt="MSP Pentesting"
              width={20}
              height={20}
              className="w-5 h-5"
            />
            MSP PENTESTING CLIENT PORTAL
          </div>

          <h1
            className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-tight"
            style={{ fontFamily: "var(--font-chakra-petch)" }}
          >
            Request and track your{" "}
            <span
              className="block mt-1"
              style={{
                backgroundImage: "linear-gradient(135deg,#4590e2,#4590e261,#24397b)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              penetration tests
            </span>
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
                  className="relative px-10 py-4 text-white font-bold text-lg overflow-hidden group"
                  style={{ fontFamily: "var(--font-chakra-petch)" }}
                >
                  {/* glowing border button */}
                  <span className="absolute inset-0 border border-[#4590e2]/60 group-hover:border-[#4590e2] transition-colors" />
                  <span className="absolute inset-0 bg-[#4590e2]/10 group-hover:bg-[#4590e2]/20 transition-colors" />
                  {/* edge-cut corners */}
                  <span className="absolute top-0 right-0 w-3 h-3 bg-[#0a141f] rotate-45 translate-x-1.5 -translate-y-1.5" />
                  <span className="absolute bottom-0 left-0 w-3 h-3 bg-[#0a141f] rotate-45 -translate-x-1.5 translate-y-1.5" />
                  <span className="relative z-10">Log In to Your Portal</span>
                </Link>
                <a
                  href="https://msppentesting.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-10 py-4 bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white/40 text-white font-semibold transition-colors text-lg"
                  style={{ fontFamily: "var(--font-chakra-petch)" }}
                >
                  Not a client yet? →
                </a>
              </>
            ) : !isLoadingAuth && currentUser ? (
              <Link
                href="/app/dashboard"
                className="relative px-10 py-4 text-white font-bold text-lg overflow-hidden group"
                style={{ fontFamily: "var(--font-chakra-petch)" }}
              >
                <span className="absolute inset-0 border border-[#4590e2]/60 group-hover:border-[#4590e2] transition-colors" />
                <span className="absolute inset-0 bg-[#4590e2]/10 group-hover:bg-[#4590e2]/20 transition-colors" />
                <span className="absolute top-0 right-0 w-3 h-3 bg-[#0a141f] rotate-45 translate-x-1.5 -translate-y-1.5" />
                <span className="absolute bottom-0 left-0 w-3 h-3 bg-[#0a141f] rotate-45 -translate-x-1.5 translate-y-1.5" />
                <span className="relative z-10">Go to Dashboard →</span>
              </Link>
            ) : null}
          </div>

          {/* Horizontal rule with blue glow */}
          <div className="flex items-center gap-4 pt-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#4590e2]/40" />
            <span className="text-[#4590e2]/60 text-xs uppercase tracking-widest font-semibold">
              OSCP Certified Pentesters
            </span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#4590e2]/40" />
          </div>

        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section className="py-24 relative">
        {/* subtle hex grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{ backgroundImage: HEX_SVG_URI, backgroundSize: "80px 69px" }}
        />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#0a141f] via-transparent to-[#0a141f]" />

        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <p className="text-[#4590e2] text-sm font-semibold uppercase tracking-[0.2em] mb-3">
              CLIENT PORTAL
            </p>
            <h2
              className="text-4xl font-bold mb-3"
              style={{ fontFamily: "var(--font-chakra-petch)" }}
            >
              How it works
            </h2>
            <p className="text-gray-400 text-lg">Three steps from request to report</p>
          </div>

          <div className="grid md:grid-cols-3 gap-0">
            {[
              {
                step: "01",
                icon: "📋",
                title: "Submit a Request",
                desc: "Log in and submit an AI or manual pentest request. Provide your target, scope, and notes for our team.",
              },
              {
                step: "02",
                icon: "🛡️",
                title: "We Test",
                desc: "Our team conducts your penetration test — AI-automated or manually by OSCP-certified experts.",
              },
              {
                step: "03",
                icon: "📄",
                title: "Get Your Report",
                desc: "Receive a detailed findings report with severity ratings, exploitation details, and remediation guidance.",
              },
            ].map((item, i) => (
              <div key={item.step} className="relative">
                {/* Connector line between cards (desktop) */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-[52px] right-0 w-full h-px bg-[#4590e2]/20 translate-x-1/2 z-0" />
                )}
                {/* Card */}
                <div className="relative z-10 mx-2 group">
                  {/* hex outline container */}
                  <div className="border border-[#4590e2]/20 group-hover:border-[#4590e2]/50 bg-[#060e16]/80 backdrop-blur-sm p-8 transition-all duration-300" style={{ clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))" }}>
                    <span className="absolute top-4 right-5 text-[#4590e2]/15 font-extrabold text-5xl leading-none select-none" style={{ fontFamily: "var(--font-chakra-petch)" }}>
                      {item.step}
                    </span>
                    <HexIcon>{item.icon}</HexIcon>
                    <h3
                      className="text-lg font-bold text-white mb-3 uppercase tracking-wide"
                      style={{ fontFamily: "var(--font-chakra-petch)" }}
                    >
                      {item.title}
                    </h3>
                    <p className="text-gray-400 leading-relaxed text-sm">{item.desc}</p>
                    {/* bottom accent line */}
                    <div className="mt-6 h-px w-12 bg-[#4590e2]/50 group-hover:w-full transition-all duration-500" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ───────────────────────────────────────────────────────── */}
      <section className="py-20 border-t border-[#4590e2]/20 relative overflow-hidden">
        {/* large faded hex behind the CTA */}
        <DecorativeHex
          size={600}
          opacity={0.05}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        />
        {/* MSP logo watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Image
            src="https://cdn.prod.website-files.com/679955125defbec984e494f9/67a8f5854bf28c588cac454e_logo-blue-transparent%20(2).avif"
            alt=""
            width={400}
            height={350}
            className="opacity-[0.04] select-none"
            aria-hidden
          />
        </div>

        <div className="max-w-3xl mx-auto px-6 text-center space-y-6 relative z-10">
          <p className="text-[#4590e2] text-sm font-semibold uppercase tracking-[0.2em]">
            NOT YET A CLIENT?
          </p>
          <h2
            className="text-3xl font-bold"
            style={{ fontFamily: "var(--font-chakra-petch)" }}
          >
            Partner with MSP Pentesting
          </h2>
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
            className="relative inline-block px-10 py-4 text-white font-bold text-lg overflow-hidden group"
            style={{ fontFamily: "var(--font-chakra-petch)" }}
          >
            <span className="absolute inset-0 border border-[#4590e2]/60 group-hover:border-[#4590e2] transition-colors" />
            <span className="absolute inset-0 bg-[#4590e2]/10 group-hover:bg-[#4590e2]/20 transition-colors" />
            <span className="absolute top-0 right-0 w-3 h-3 bg-[#0a141f] rotate-45 translate-x-1.5 -translate-y-1.5" />
            <span className="absolute bottom-0 left-0 w-3 h-3 bg-[#0a141f] rotate-45 -translate-x-1.5 translate-y-1.5" />
            <span className="relative z-10">Visit MSP Pentesting →</span>
          </a>
        </div>
      </section>

    </main>
  );
}
