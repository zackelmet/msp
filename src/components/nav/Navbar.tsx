"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/context/AuthContext";

export default function Navbar() {
  const { currentUser, isLoadingAuth } = useAuth();

  return (
    <header className="w-full border-b border-[#4590e2] bg-[#0a141f] text-white relative z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 px-5 py-4">
        <a
          href="https://dashboard.msppentesting.com"
          className="flex items-center gap-3 hover:opacity-90 transition"
        >
          <Image
            src="/msp pentesting logo (1) (3) (1).png"
            alt="MSP Pentesting Logo"
            width={40}
            height={40}
            className="h-10 w-auto"
            priority
          />
          <span
            className="text-white font-semibold text-lg tracking-wide leading-tight hidden sm:block"
            style={{ fontFamily: "var(--font-chakra-petch)" }}
          >
            MSP Pentesting
          </span>
        </a>

        <div className="flex items-center gap-3">
          {!isLoadingAuth && !currentUser && (
            <Link
              href="/login"
              className="relative px-5 py-2 text-sm font-bold text-white overflow-hidden group"
              style={{ fontFamily: "var(--font-chakra-petch)" }}
            >
              <span className="absolute inset-0 border border-[#4590e2]/60 group-hover:border-[#4590e2] transition-colors rounded" />
              <span className="absolute inset-0 bg-[#4590e2]/15 group-hover:bg-[#4590e2]/25 transition-colors rounded" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-[#0a141f] rotate-45 translate-x-1 -translate-y-1" />
              <span className="absolute bottom-0 left-0 w-2 h-2 bg-[#0a141f] rotate-45 -translate-x-1 translate-y-1" />
              <span className="relative z-10">Sign In</span>
            </Link>
          )}

          {!isLoadingAuth && currentUser && (
            <Link
              href="/app/dashboard"
              className="relative px-5 py-2 text-sm font-bold text-white overflow-hidden group"
              style={{ fontFamily: "var(--font-chakra-petch)" }}
            >
              <span className="absolute inset-0 border border-[#4590e2]/60 group-hover:border-[#4590e2] transition-colors rounded" />
              <span className="absolute inset-0 bg-[#4590e2]/15 group-hover:bg-[#4590e2]/25 transition-colors rounded" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-[#0a141f] rotate-45 translate-x-1 -translate-y-1" />
              <span className="absolute bottom-0 left-0 w-2 h-2 bg-[#0a141f] rotate-45 -translate-x-1 translate-y-1" />
              <span className="relative z-10">Dashboard</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
