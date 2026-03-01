"use client";

import { useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHeadset,
  faEnvelope,
  faCircleCheck,
  faTriangleExclamation,
  faArrowLeft,
  faShieldHalved,
  faBook,
} from "@fortawesome/free-solid-svg-icons";

const TOPICS = [
  "Billing & Credits",
  "Pentest Results",
  "Technical Issue",
  "Account & Access",
  "Authorisation / Legal",
  "Other",
];

export default function SupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus("idle");

    try {
      const res = await fetch("https://formspree.io/f/mlgwkaal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, topic, message }),
      });

      if (!res.ok) throw new Error("Failed");
      setStatus("success");
      setName("");
      setEmail("");
      setTopic("");
      setMessage("");
    } catch {
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a141f] text-white">
      {/* Hero */}
      <div className="border-b border-[#4590e2]/30 bg-gradient-to-b from-[#0a141f] to-[#0a1828]">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#4590e2]/20 border border-[#4590e2]/40 mb-6">
            <FontAwesomeIcon icon={faHeadset} className="text-3xl text-[#4590e2]" />
          </div>
          <h1
            className="text-4xl lg:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: "var(--font-chakra-petch)" }}
          >
            Support
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Have a question or issue? Send us a message and we'll get back to you within one business day.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16 grid lg:grid-cols-3 gap-10">
        {/* Sidebar */}
        <aside className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Quick Links
          </h2>

          <Link
            href="/trust-safety"
            className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#4590e2]/40 rounded-xl transition-all group"
          >
            <div className="p-2 rounded-lg bg-[#4590e2]/15 border border-[#4590e2]/30">
              <FontAwesomeIcon icon={faShieldHalved} className="text-[#4590e2]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white group-hover:text-[#4590e2] transition-colors">
                Trust + Safety
              </p>
              <p className="text-xs text-gray-500">Policies &amp; legal</p>
            </div>
          </Link>

          <Link
            href="mailto:support@msppentesting.com"
            className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#4590e2]/40 rounded-xl transition-all group"
          >
            <div className="p-2 rounded-lg bg-[#4590e2]/15 border border-[#4590e2]/30">
              <FontAwesomeIcon icon={faEnvelope} className="text-[#4590e2]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white group-hover:text-[#4590e2] transition-colors">
                Email Us
              </p>
              <p className="text-xs text-gray-500">support@msppentesting.com</p>
            </div>
          </Link>

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-gray-500 leading-relaxed">
              Response time is typically within <span className="text-gray-300">1 business day</span>. For urgent billing issues please email directly.
            </p>
          </div>
        </aside>

        {/* Contact form */}
        <div className="lg:col-span-2">
          {status === "success" ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-10 text-center">
              <FontAwesomeIcon
                icon={faCircleCheck}
                className="text-5xl text-green-400 mb-4"
              />
              <h3 className="text-2xl font-bold text-white mb-2">Message Sent</h3>
              <p className="text-gray-400 mb-6">
                Thanks for reaching out. We'll get back to you within one business day.
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors text-sm"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                Send another message
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="bg-white/5 border border-white/10 rounded-xl p-8 space-y-5"
            >
              <h2 className="text-xl font-bold text-white mb-1">Send a Message</h2>

              {status === "error" && (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
                  <FontAwesomeIcon icon={faTriangleExclamation} />
                  Something went wrong. Please try again or email us directly.
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                    Name <span className="text-[#4590e2]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#4590e2] transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                    Email <span className="text-[#4590e2]">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#4590e2] transition-colors text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                  Topic <span className="text-[#4590e2]">*</span>
                </label>
                <select
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0a141f] border border-white/15 rounded-lg text-white focus:outline-none focus:border-[#4590e2] transition-colors text-sm appearance-none"
                >
                  <option value="" disabled>
                    Select a topic…
                  </option>
                  {TOPICS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                  Message <span className="text-[#4590e2]">*</span>
                </label>
                <textarea
                  required
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue or question in as much detail as possible…"
                  className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#4590e2] transition-colors text-sm resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-[#4590e2] hover:bg-[#3a7bc8] text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Sending…" : "Send Message"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
