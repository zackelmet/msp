"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGlobe, faCircleCheck } from "@fortawesome/free-solid-svg-icons";

/**
 * White-label branding for a distributor. They set a portal slug, logo URL, and
 * primary color; their resellers/clients then log in at
 * `<slug>.msppentesting.com` and see this brand (same app, one Firebase).
 */
export default function BrandingPage() {
  const router = useRouter();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#4590e2");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const authHeader = async () => {
    const { getAuth } = await import("firebase/auth");
    const app = (await import("@/lib/firebase/firebaseClient")).default;
    const user = getAuth(app).currentUser;
    if (!user) return null;
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  };

  useEffect(() => {
    (async () => {
      const { getAuth, onAuthStateChanged } = await import("firebase/auth");
      const app = (await import("@/lib/firebase/firebaseClient")).default;
      onAuthStateChanged(getAuth(app), async (user) => {
        if (!user) {
          router.replace("/login");
          return;
        }
        try {
          const h = { Authorization: `Bearer ${await user.getIdToken()}` };
          const d = await (await fetch("/api/orgs", { headers: h })).json();
          const selfId = d?.self?.orgId;
          const org = (d.orgs || []).find((o: any) => o.id === selfId);
          if (org) {
            setOrgId(org.id);
            const b = org.branding || {};
            setSlug(b.cname || "");
            setLogoUrl(b.logoUrl || "");
            setPrimaryColor(b.primaryColor || "#4590e2");
          }
        } catch {
          /* ignore */
        }
        setLoading(false);
      });
    })();
  }, [router]);

  const save = async () => {
    if (!orgId) return;
    setSaving(true);
    setNote(null);
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(cleanSlug);
    try {
      const h = await authHeader();
      if (!h) return;
      const res = await fetch(`/api/orgs/${orgId}/branding`, {
        method: "PUT",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({
          cname: cleanSlug || null,
          logoUrl: logoUrl.trim() || null,
          primaryColor: primaryColor || null,
          whiteLabelEnabled: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      setNote("✓ Branding saved.");
    } catch (e: any) {
      setNote(`✗ ${e.message || "Save failed"}`);
    }
    setSaving(false);
  };

  const field =
    "w-full rounded-lg bg-[#0a141f] border border-[#4590e2]/20 px-4 py-3 text-white placeholder-[#5a7590] focus:border-[#4590e2] focus:outline-none text-sm";

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">White-label branding</h1>
          <p className="text-[#7a9bb5] mt-1 text-sm">
            Give your resellers a branded portal to log into — your logo and colors,
            your own URL. Same platform underneath.
          </p>
        </div>

        {note && (
          <div className="rounded-lg border border-[#4590e2]/25 bg-[#4590e2]/10 px-4 py-2.5 text-sm text-[#a9c6dd]">
            {note}
          </div>
        )}

        {loading ? (
          <div className="h-64 bg-[#0d1e30] rounded-xl animate-pulse" />
        ) : (
          <div className="bg-[#0d1e30] border border-[#4590e2]/20 rounded-xl p-6 space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-wide text-[#7a9bb5] mb-2">
                Portal subdomain
              </label>
              <div className="flex items-center gap-2">
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="yourcompany"
                  className={`${field} max-w-[200px]`}
                />
                <span className="text-[#7a9bb5] text-sm">.msppentesting.com</span>
              </div>
              {slug && (
                <p className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
                  <FontAwesomeIcon icon={faGlobe} className="w-3 h-3" />
                  Your resellers log in at{" "}
                  <span className="font-semibold">{slug.toLowerCase().replace(/[^a-z0-9-]/g, "")}.msppentesting.com</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[#7a9bb5] mb-2">
                Logo URL
              </label>
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…/logo.png"
                className={field}
              />
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo preview" className="mt-3 h-12 object-contain" />
              )}
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[#7a9bb5] mb-2">
                Primary color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-14 rounded bg-transparent border border-[#4590e2]/20"
                />
                <input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className={`${field} max-w-[140px]`}
                />
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving || !orgId}
              className="flex items-center gap-2 rounded-lg bg-[#4590e2] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3a7bc8] disabled:opacity-60"
            >
              <FontAwesomeIcon icon={faCircleCheck} className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save branding"}
            </button>
          </div>
        )}

        <p className="text-xs text-[#5a7590]">
          Your resellers &amp; their clients are created on our platform (one login
          system); the portal just wears your brand. Invite them from the Platform
          tab.
        </p>
      </div>
    </DashboardLayout>
  );
}
