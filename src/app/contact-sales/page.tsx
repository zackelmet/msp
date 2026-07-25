"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Public "Contact sales" form — the distributor / volume tier is form-gated
 * (not self-serve). Posts to /api/leads, which stores the lead + alerts Zack.
 */
export default function ContactSalesPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Submission failed");
      setStatus("sent");
      form.reset();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setStatus("error");
    }
  };

  const field =
    "w-full rounded-lg bg-[#0a141f] border border-[#4590e2]/20 px-4 py-3 text-white placeholder-[#5a7590] focus:border-[#4590e2] focus:outline-none text-sm";

  return (
    <div className="min-h-screen bg-[#0a141f] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg mx-auto">
        <Link
          href="/pricing"
          className="text-[#4590e2] text-sm hover:underline"
        >
          ← Back to pricing
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-white">Talk to sales</h1>
        <p className="mt-2 text-[#7a9bb5] text-sm">
          Tell us a bit about your needs and we&apos;ll set you up with the
          right plan and pricing.
        </p>

        {status === "sent" ? (
          <div className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-emerald-100">
            <p className="font-semibold">Thanks — we got it.</p>
            <p className="mt-1 text-sm text-emerald-200/80">
              We&apos;ll be in touch shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {/* Honeypot (hidden from users; bots fill it) */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <input
                name="name"
                aria-label="Name"
                placeholder="Name"
                className={field}
              />
              <input
                name="company"
                aria-label="Company"
                placeholder="Company"
                className={field}
              />
            </div>
            <input
              name="email"
              type="email"
              required
              aria-label="Work email"
              placeholder="Work email *"
              className={field}
            />
            <select
              name="topic"
              aria-label="What are you interested in?"
              className={field}
              defaultValue=""
              required
            >
              <option value="" disabled>
                What are you interested in? *
              </option>
              <option value="distributor">Distributor / Volume Pricing</option>
              <option value="manual-pentest">Manual Pentest</option>
              <option value="partnership">Partnership</option>
              <option value="support">Support / Technical Question</option>
              <option value="other">Other</option>
            </select>
            <input
              name="ipEstimate"
              aria-label="Approximate IPs per month"
              placeholder="Approx. IPs / month (e.g. 500)"
              className={field}
            />
            <textarea
              name="message"
              rows={4}
              aria-label="Tell us more"
              placeholder="Tell us more about your needs"
              className={field}
            />
            {status === "error" && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-lg bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#3a7bc8] disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Request pricing"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
