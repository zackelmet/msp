"use client";

import Image from "next/image";
import Link from "next/link";
import UserAvatar from "./UserAvatar";
import { useAuth } from "@/lib/context/AuthContext";

export default function Navbar() {
  const { currentUser, isLoadingAuth } = useAuth();

  return (
    <header className="w-full border-b border-[#4590e2] bg-[#0a141f] text-white relative z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 px-5 py-4">
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-90 transition"
        >
          <Image
            src="/msp pentesting logo (1) (3) (1).png"
            alt="MSP Pentesting Logo"
            width={150}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </Link>

        <div className="flex items-center gap-3">
          {!isLoadingAuth && !currentUser && (
            <>
              <Link
                href="/#pricing"
                className="text-sm font-medium hover:text-blue-400 transition"
              >
                Pricing
              </Link>
              <Link
                href="/login"
                className="neon-outline-btn px-4 py-2 text-sm font-semibold"
              >
                Sign In
              </Link>
            </>
          )}

          {currentUser && <UserAvatar compact />}
        </div>
      </div>
    </header>
  );
}
