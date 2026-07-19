import Link from "next/link";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClipboardList,
  faShieldHalved,
  faFileLines,
} from "@fortawesome/free-solid-svg-icons";

// ─── Inline SVG hexagon background grid ───────────────────────────────────────
const HEX_SVG_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='104' viewBox='0 0 120 104'%3E%3Cpolygon points='60,2 112,29 112,75 60,102 8,75 8,29' fill='none' stroke='%234590e2' stroke-width='0.8' opacity='0.22'/%3E%3C/svg%3E")`;

function DecorativeHex({ size, opacity, className }: { size: number; opacity: number; className?: string }) {
  return (
    <svg width={size} height={size * 0.866} viewBox="0 0 100 86.6" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ opacity }} aria-hidden>
      <polygon points="50,0 100,25 100,75 50,86.6 0,75 0,25" stroke="#4590e2" strokeWidth="1.5" fill="#4590e2" fillOpacity="0.06" />
    </svg>
  );
}

// ─── SVG icons for the 3 steps ────────────────────────────────────────────────
function IconClipboard() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
    </svg>
  );
}
function IconReport() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

// ─── White-label report mockup ────────────────────────────────────────────────
function ReportMockup() {
  return (
    <div className="relative mx-auto" style={{ maxWidth: 520 }}>
      {/* Ambient glow under the tablet */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-[#4590e2]/20 blur-2xl rounded-full pointer-events-none" />
      {/* Subtle outer ring */}
      <div className="absolute -inset-px rounded-2xl border border-[#4590e2]/25 pointer-events-none" />

      {/* Tablet frame */}
      <div className="rounded-2xl bg-[#0d1e30] border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.6)] overflow-hidden">

        {/* Tablet top bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#0a1829] border-b border-white/[0.07]">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
          </div>
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">pentest-report.pdf</span>
          <div className="w-14" />
        </div>

        {/* PDF content area */}
        <div className="bg-[#f0f4f8] px-8 py-7">

          {/* ── Report header ── */}
          <div className="flex items-start justify-between mb-6">
            {/* YOUR LOGO HERE placeholder */}
            <div className="flex items-center justify-center bg-white border-2 border-dashed border-[#4590e2]/40 rounded px-5 py-3 shadow-sm">
              <span className="text-[#4590e2] text-xs font-bold uppercase tracking-[0.18em]">YOUR LOGO HERE</span>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Penetration Test Report</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Prepared by MSP Pentesting</p>
              <p className="text-[10px] text-gray-400 mt-0.5">CONFIDENTIAL</p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-[#4590e2]/60 via-[#4590e2]/20 to-transparent mb-5" />

          {/* Title block */}
          <div className="mb-5">
            <h3 className="text-[#0a141f] text-sm font-bold mb-1">Executive Summary</h3>
            <div className="space-y-1.5">
              {[100, 88, 94, 72].map((w, i) => (
                <div key={i} className="h-2 rounded-full bg-gray-200" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>

          {/* Findings grid */}
          <div className="grid grid-cols-4 gap-2 mb-5">
            {[
              { label: "Critical", count: "2", color: "#ef4444" },
              { label: "High",     count: "5", color: "#f97316" },
              { label: "Medium",   count: "8", color: "#eab308" },
              { label: "Low",      count: "3", color: "#22c55e" },
            ].map((f) => (
              <div key={f.label} className="bg-white rounded-lg p-2.5 text-center shadow-sm border border-gray-100">
                <div className="text-xl font-bold" style={{ color: f.color }}>{f.count}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wide font-semibold">{f.label}</div>
              </div>
            ))}
          </div>

          {/* Findings rows */}
          <div className="space-y-2">
            {[
              { sev: "CRITICAL", label: "SQL Injection — /api/login", color: "#ef4444", bg: "#fef2f2" },
              { sev: "HIGH",     label: "Exposed Admin Panel — /admin", color: "#f97316", bg: "#fff7ed" },
              { sev: "MEDIUM",   label: "Missing HSTS Headers",         color: "#eab308", bg: "#fefce8" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2.5 bg-white rounded-lg px-3 py-2 border border-gray-100 shadow-sm">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: row.color, backgroundColor: row.bg }}>
                  {row.sev}
                </span>
                <span className="text-[10px] text-gray-600 font-mono flex-1 truncate">{row.label}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={row.color} strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
              </div>
            ))}
          </div>

          {/* Footer bar */}
          <div className="mt-5 pt-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-[9px] text-gray-400">Generated via MSP Pentesting Platform</span>
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <span key={n} className="w-1.5 h-1.5 rounded-full bg-[#4590e2]/40" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating badge — CONFIDENTIAL */}
      <div className="absolute -top-3 -right-3 bg-[#4590e2] text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg shadow-[#4590e2]/30">
        White-Labeled
      </div>
    </div>
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
            Launch AI-powered penetration tests against any IP, watch findings
            surface in real time, and download your report — all in one place.
            One product, priced per IP. Human-led pentests available on request.
          </p>

          {/* Marketing CTAs — identical for everyone (public page, no auth-based
              swap, no load flash). Authed users hitting /login are redirected to
              their dashboard by AuthContext, so "Log In" still works for them. */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
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
              href="/pricing"
              className="px-10 py-4 bg-[#4590e2]/10 hover:bg-[#4590e2]/20 border border-[#4590e2]/35 hover:border-[#4590e2]/60 text-white font-semibold transition-colors text-lg"
              style={{ fontFamily: "var(--font-chakra-petch)" }}
            >
              View Pricing
            </a>
            <a
              href="https://msppentesting.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-10 py-4 bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white/40 text-white font-semibold transition-colors text-lg"
              style={{ fontFamily: "var(--font-chakra-petch)" }}
            >
              Not a client yet? →
            </a>
          </div>

          {/* Horizontal rule with blue glow */}
          <div className="flex items-center gap-4 pt-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#4590e2]/40" />
            <span className="text-[#4590e2]/60 text-xs uppercase tracking-widest font-semibold">
              White-Labeled Pentesting
            </span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#4590e2]/40" />
          </div>

        </div>
      </section>

      {/* ── PRICING PREVIEW ────────────────────────────────────────────────── */}
      <section className="py-14 border-y border-[#4590e2]/15 bg-[#0d1e30]/40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-[#0d1e30] border border-[#4590e2]/20 rounded-xl p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <p className="text-[#4590e2] text-xs font-semibold uppercase tracking-[0.2em] mb-2">
                  AI Penetration Testing · Per IP
                </p>
                <h3 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-chakra-petch)" }}>
                  Simple pricing — pay per IP you test
                </h3>
                <p className="text-[#7a9bb5] text-sm mt-2 max-w-2xl">
                  One AI pentest, priced per live IP. Buy prepaid credits — no subscription, they never expire. Volume discounts and consolidated billing for MSPs at scale. Human-led engagements on request.
                </p>
              </div>
              <Link
                href="/pricing"
                className="shrink-0 inline-flex items-center justify-center px-6 py-3 bg-[#4590e2] hover:bg-[#3a7bc8] text-white font-semibold rounded-lg transition-colors"
              >
                View Full Pricing
              </Link>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mt-6">
              {[
                {
                  tier: "Prepaid, per IP",
                  price: "$20 / IP",
                  sub: "Buy IP credits — no subscription, never expire",
                },
                {
                  tier: "Grow into discounts",
                  price: "Volume",
                  sub: "Cheaper per IP the more you buy",
                },
                {
                  tier: "For MSPs at scale",
                  price: "Distributor",
                  sub: "Lower metered rates + consolidated billing — talk to sales",
                },
              ].map((item) => (
                <div key={item.tier} className="bg-[#0a141f] border border-[#4590e2]/15 rounded-lg p-4">
                  <p className="text-xs text-[#7a9bb5] uppercase tracking-wide">{item.tier}</p>
                  <p className="text-2xl font-bold text-white mt-1">{item.price}</p>
                  <p className="text-xs text-[#7a9bb5] mt-1">{item.sub}</p>
                </div>
              ))}
            </div>
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
            <p className="text-gray-400 text-lg">Three steps from targets to report — AI-driven, with every finding validated by real proof-of-concept.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-0">
            {[
              {
                step: "01",
                icon: faClipboardList,
                title: "Add Your Targets",
                desc: "Paste your targets — IPs, hostnames, URLs, or CIDR ranges — and launch. No lengthy scoping forms.",
              },
              {
                step: "02",
                icon: faShieldHalved,
                title: "AI Tests Every IP",
                desc: "Autonomous AI agents enumerate, exploit, and validate findings across every live IP in scope — each confirmed with a real proof-of-concept.",
              },
              {
                step: "03",
                icon: faFileLines,
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
                    <HexIcon><FontAwesomeIcon icon={item.icon} /></HexIcon>
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
            to learn about our services, view pricing, and get a quote.
          </p>
          <p className="text-[#7a9bb5] text-sm">
            AI penetration testing, billed per IP. Human-led engagements available on request, delivered by CEH- and OSCP-certified professionals.
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
