import { faLinkedin } from "@fortawesome/free-brands-svg-icons";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0a141f] border-t border-[#4590e2] text-white">
      <div className="max-w-7xl mx-auto px-5 pt-10 pb-12 flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Link href="https://msppentesting.com" className="flex items-center gap-3 hover:opacity-90 transition">
              <Image
                src="/msp pentesting logo (1) (3) (1).png"
                alt="MSP Pentesting Logo"
                width={40}
                height={40}
                className="h-10 w-auto"
              />
              <span
                className="text-white font-semibold text-lg tracking-wide"
                style={{ fontFamily: "var(--font-chakra-petch)" }}
              >
                MSP Pentesting
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 text-[var(--text-muted)]">
              <Link
                href="https://x.com/MspPentesting"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[var(--primary)] transition"
                aria-label="X (formerly Twitter)"
              >
                <span className="inline-flex items-center justify-center p-1 rounded-md bg-[rgba(255,255,255,0.30)]">
                  <Image
                    src="/Twitter-X--Streamline-Bootstrap.svg"
                    alt="X"
                    width={20}
                    height={20}
                    className="h-5 w-5"
                  />
                </span>
              </Link>
              <Link
                href="https://www.linkedin.com/company/msp-pentesting/posts/?feedView=all"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[var(--primary)] transition"
              >
                <FontAwesomeIcon icon={faLinkedin} className="text-xl" />
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-sm text-[var(--text-muted)]">
          <div className="flex gap-4">
            <Link
              href="/#pricing"
              className="hover:text-[var(--primary)] transition"
            >
              Pricing
            </Link>
            <Link
              href="/trust-safety"
              className="hover:text-[var(--primary)] transition"
            >
              Trust + Safety
            </Link>
            <Link
              href="/support"
              className="hover:text-[var(--primary)] transition"
            >
              Support
            </Link>
          </div>
          <div className="text-xs sm:text-sm">
            © 2026 MSP Pentesting. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
