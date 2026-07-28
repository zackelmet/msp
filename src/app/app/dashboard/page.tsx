"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBolt,
  faJetFighter,
  faFileLines,
  faCircleCheck,
  faArrowRight,
  faShoppingCart,
} from "@fortawesome/free-solid-svg-icons";

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  running: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  completed: "text-green-400 bg-green-400/10 border-green-400/30",
  failed: "text-red-400 bg-red-400/10 border-red-400/30",
};

/**
 * Reseller Overview. This platform is for resellers/MSPs: buy IP credits → launch
 * pentests → read reports. A brand-new reseller gets a guided 3-step checklist and
 * per-IP stat tiles (credits front and center). Distributors/admins are sent to the
 * Platform (tenant tree) instead; end clients don't log in.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const [pentests, setPentests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubAuth: (() => void) | undefined;
    let unsubDoc: (() => void) | undefined;
    let unsubPentests: (() => void) | undefined;
    (async () => {
      const { getAuth, onAuthStateChanged } = await import("firebase/auth");
      const {
        getFirestore,
        doc,
        onSnapshot,
        collection,
        query,
        where,
        orderBy,
        limit,
      } = await import("firebase/firestore");
      const app = (await import("@/lib/firebase/firebaseClient")).default;
      const auth = getAuth(app);
      const db = getFirestore(app);

      unsubAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          router.replace("/login");
          return;
        }
        setUserName(user.email?.split("@")[0] || "there");

        // Distributors/admins manage a tenant tree — send them to the Platform.
        // Resellers stay here (their Overview); end clients don't log in.
        try {
          const me = await (
            await fetch(`/api/auth/isAdmin?uid=${user.uid}`)
          ).json();
          if (me.isAdmin || me.role === "supplier_admin") {
            router.replace("/app/clients");
            return;
          }
        } catch {
          /* stay on the reseller overview */
        }

        unsubDoc = onSnapshot(doc(db, "users", user.uid), (snap) => {
          setCredits(snap.data()?.credits?.ai_pentest ?? 0);
        });
        const q = query(
          collection(db, "pentests"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(50),
        );
        unsubPentests = onSnapshot(q, (snap) => {
          setPentests(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as any) }))
              .filter((p) => p.type === "ai_pentest")
              .slice(0, 15),
          );
          setLoading(false);
        });
      });
    })();
    return () => {
      unsubAuth?.();
      unsubDoc?.();
      unsubPentests?.();
    };
  }, [router]);

  const launched = pentests.length;
  const completed = pentests.filter((p) => p.status === "completed").length;
  const hasCredits = (credits ?? 0) > 0;

  const tiles = [
    {
      label: "IP credits",
      value: credits ?? 0,
      icon: faBolt,
      color: "text-[#4590e2]",
      href: "/app/buy-credits",
      cta: hasCredits ? "Buy more" : "Buy IPs",
      urgent: !hasCredits,
    },
    {
      label: "Pentests launched",
      value: launched,
      icon: faJetFighter,
      color: "text-purple-400",
      href: "/app/pentests",
    },
    {
      label: "Reports ready",
      value: completed,
      icon: faFileLines,
      color: "text-green-400",
      href: "/app/pentests",
    },
  ];

  const steps = [
    {
      n: "01",
      title: "Buy IP credits",
      sub: "One credit = one live IP tested. Buy any amount — they never expire.",
      href: "/app/buy-credits",
      cta: "Buy IPs",
      done: hasCredits,
    },
    {
      n: "02",
      title: "Launch your first pentest",
      sub: "Paste your targets (IPs, domains, URLs) and let the AI test them.",
      href: "/app/ai-pentest-launch",
      cta: "Launch",
      done: launched > 0,
    },
    {
      n: "03",
      title: "Read your report",
      sub: "Findings with severity, proof-of-concept, and remediation — downloadable.",
      href: "/app/pentests",
      cta: "View reports",
      done: completed > 0,
    },
  ];
  const allDone = steps.every((s) => s.done);

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome, <span className="text-[#4590e2]">{userName}</span>
          </h1>
          <p className="text-[#7a9bb5] mt-1 text-sm">
            Buy IP credits, launch AI pentests, and read your reports.
          </p>
        </div>
        <Link
          href="/app/buy-credits"
          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[#3a7bc8] text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faShoppingCart} className="w-3 h-3" />
          Buy IPs
        </Link>
      </div>

      {/* Per-IP stat tiles (credits front and center) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading
          ? [...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-5 animate-pulse h-28"
              />
            ))
          : tiles.map((t) => (
              <div
                key={t.label}
                className={`bg-[#0d1e30] border rounded-xl p-5 ${
                  t.urgent ? "border-[#4590e2]/50" : "border-[#4590e2]/15"
                }`}
              >
                <FontAwesomeIcon
                  icon={t.icon}
                  className={`w-4 h-4 ${t.color} mb-3`}
                />
                <div className="text-2xl font-bold text-white tabular-nums">
                  {t.value}
                </div>
                <div className="text-xs text-[#7a9bb5] mt-1">{t.label}</div>
                {t.cta && (
                  <Link
                    href={t.href}
                    className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${
                      t.urgent
                        ? "text-[#4590e2]"
                        : "text-[#7a9bb5] hover:text-[#4590e2]"
                    }`}
                  >
                    {t.cta}{" "}
                    <FontAwesomeIcon
                      icon={faArrowRight}
                      className="w-2.5 h-2.5"
                    />
                  </Link>
                )}
              </div>
            ))}
      </div>

      {/* Guided checklist — the primary next-step for a new reseller */}
      {!loading && !allDone && (
        <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white">Get started</h2>
          <p className="text-xs text-[#7a9bb5] mt-0.5 mb-5">
            Three steps to your first report.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {steps.map((s) => (
              <Link
                key={s.n}
                href={s.href}
                className="relative bg-[#0a141f] border border-[#4590e2]/10 hover:border-[#4590e2]/30 rounded-xl p-5 transition-colors group flex flex-col gap-2"
              >
                {s.done && (
                  <FontAwesomeIcon
                    icon={faCircleCheck}
                    className="absolute top-3 right-3 w-4 h-4 text-green-400"
                  />
                )}
                <p className="text-xs font-bold text-[#7a9bb5]">STEP {s.n}</p>
                <p className="text-sm font-semibold text-white leading-snug">
                  {s.title}
                </p>
                <p className="text-xs text-[#7a9bb5] leading-relaxed">
                  {s.sub}
                </p>
                {!s.done && (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#4590e2]">
                    {s.cta}{" "}
                    <FontAwesomeIcon
                      icon={faArrowRight}
                      className="w-2.5 h-2.5"
                    />
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent pentests — minimal empty state */}
      <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#4590e2]/15">
          <h2 className="text-sm font-semibold text-white">Recent pentests</h2>
          {pentests.length > 0 && (
            <Link
              href="/app/pentests"
              className="text-xs text-[#4590e2] hover:underline"
            >
              View all
            </Link>
          )}
        </div>
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="h-10 bg-[#0a141f] rounded animate-pulse"
              />
            ))}
          </div>
        ) : pentests.length === 0 ? (
          <p className="px-6 py-5 text-sm text-[#7a9bb5]">
            No pentests yet.{" "}
            {hasCredits ? (
              <Link
                href="/app/ai-pentest-launch"
                className="text-[#4590e2] hover:underline"
              >
                Launch your first &rarr;
              </Link>
            ) : (
              <Link
                href="/app/buy-credits"
                className="text-[#4590e2] hover:underline"
              >
                Buy IPs to get started &rarr;
              </Link>
            )}
          </p>
        ) : (
          <div className="divide-y divide-[#4590e2]/10">
            {pentests.slice(0, 6).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-6 py-3.5"
              >
                <p className="text-sm text-white truncate mr-3">
                  {p.targetUrl || p.id}
                </p>
                <span
                  className={`shrink-0 text-xs px-2 py-0.5 rounded-full border capitalize ${
                    STATUS_COLORS[p.status] || STATUS_COLORS.pending
                  }`}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Built for MSPs — soft nudge (Option B) */}
      <p className="text-center text-xs text-[#5a7590]">
        MSP Pentesting is built for MSPs &amp; resellers. Testing solo?{" "}
        <Link
          href="/contact-sales"
          className="text-[#7a9bb5] hover:text-[#4590e2] underline"
        >
          Contact us
        </Link>
        .
      </p>
    </div>
  );
}
