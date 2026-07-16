"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStore, faXmark } from "@fortawesome/free-solid-svg-icons";

const DISMISS_KEY = "distributor-upsell-dismissed";
const ZACK_EMAIL = "zack@msppentesting.com";

/**
 * Shown to self-enrolled resellers (public signups). They're parked as a reseller
 * under MSP Pentesting; this nudges the ones who want their own billing to reach
 * out and become a distributor (their own supplier). Dismissible, per-browser.
 */
export default function DistributorUpsellBanner({ show }: { show: boolean }) {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1",
  );

  if (!show || dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore storage errors */
    }
    setDismissed(true);
  };

  return (
    <div className="mx-4 mt-4 rounded-xl border border-[#1e5a8a] bg-[#0e2036] px-4 py-3 flex items-start gap-3">
      <div className="mt-0.5 text-[#4a9de0]">
        <FontAwesomeIcon icon={faStore} />
      </div>
      <div className="flex-1 text-sm">
        <p className="text-white font-semibold">You're set up as a reseller.</p>
        <p className="text-[#7a9bb5] mt-0.5">
          Want your own billing and a bigger commitment tier as a{" "}
          <strong className="text-[#a9c6dd]">distributor</strong>? Email{" "}
          <a
            href={`mailto:${ZACK_EMAIL}?subject=Distributor%20access`}
            className="text-[#4a9de0] underline hover:text-[#6cb4ea]"
          >
            {ZACK_EMAIL}
          </a>{" "}
          and we'll set you up.
        </p>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-[#5a7590] hover:text-white transition-colors"
      >
        <FontAwesomeIcon icon={faXmark} />
      </button>
    </div>
  );
}
