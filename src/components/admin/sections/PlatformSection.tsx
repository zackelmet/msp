"use client";

import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuilding,
  faStore,
  faUserGroup,
  faChevronRight,
  faLayerGroup,
} from "@fortawesome/free-solid-svg-icons";

/**
 * Platform control plane (Acronis north-star). A flat clients grid at the
 * current level with drill-down (click a name) + breadcrumb (ascend), over the
 * fixed 3-level tree: supplier → reseller → client. No tree widget.
 *
 * Lists the org tree from /api/admin/orgs, shows the supplier's quota pool, and
 * — when you drill into a client leaf — opens an editable provisioning panel to
 * set that client's per-SKU quota caps (soft/hard) and the parent reseller's
 * white-label branding. Writes via PUT /api/admin/orgs/[id]/{caps,branding}.
 */

type OrgType = "supplier" | "reseller" | "client";
type QuotaPolicy = "soft" | "hard";

// Mirror of SKUS in src/lib/types/quota.ts (kept local to avoid pulling the
// firebase-admin import in that module into the client bundle).
const SKUS = [
  "ai_pentest",
  "external",
  "internal",
  "web_app",
  "manual",
] as const;
type Sku = (typeof SKUS)[number];

interface OrgBranding {
  logoUrl?: string;
  primaryColor?: string;
  cname?: string;
  reportFooter?: string;
  reportCoverUrl?: string;
  emailSender?: string;
  whiteLabelEnabled?: boolean;
}

interface Org {
  id: string;
  type: OrgType | null;
  parentOrgId: string | null;
  path: string[];
  name: string;
  status: string;
  tierId: string | null;
  branding: OrgBranding | null;
}

interface Pool {
  orgId: string;
  purchased: Record<string, number>;
  reserved: Record<string, number>;
  consumed: Record<string, number>;
  policy: Record<string, QuotaPolicy>;
}

interface Cap {
  orgId: string;
  caps: Record<string, number>;
  policy: Record<string, QuotaPolicy>;
}

const TYPE_META: Record<
  OrgType,
  { label: string; icon: typeof faBuilding; color: string }
> = {
  supplier: { label: "Supplier", icon: faBuilding, color: "text-[#4590e2]" },
  reseller: { label: "Reseller", icon: faStore, color: "text-purple-400" },
  client: { label: "Client", icon: faUserGroup, color: "text-green-400" },
};

const CHILD_LABEL: Record<OrgType, string> = {
  supplier: "resellers",
  reseller: "clients",
  client: "",
};

export default function PlatformSection() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [caps, setCaps] = useState<Cap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The node we've drilled INTO. null = root (list all suppliers).
  const [currentId, setCurrentId] = useState<string | null>(null);
  // The client leaf we've opened the provisioning panel for.
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/orgs");
      if (!res.ok) throw new Error(`Failed to load orgs (${res.status})`);
      const data = await res.json();
      setOrgs(data.orgs ?? []);
      setPools(data.pools ?? []);
      setCaps(data.caps ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orgs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const byId = useMemo(
    () => Object.fromEntries(orgs.map((o) => [o.id, o])),
    [orgs],
  );
  const poolByOrg = useMemo(
    () => Object.fromEntries(pools.map((p) => [p.orgId, p])),
    [pools],
  );
  const capByOrg = useMemo(
    () => Object.fromEntries(caps.map((c) => [c.orgId, c])),
    [caps],
  );

  const childrenOf = (parentId: string | null) =>
    orgs
      .filter((o) =>
        parentId === null
          ? o.type === "supplier" || o.parentOrgId === null
          : o.parentOrgId === parentId,
      )
      .sort((a, b) => a.name.localeCompare(b.name));

  const rows = childrenOf(currentId);
  const current = currentId ? byId[currentId] : null;

  // Breadcrumb: Root → …path… → current.
  const crumbs = useMemo(() => {
    const out: { id: string | null; label: string }[] = [{ id: null, label: "All suppliers" }];
    if (current) {
      for (const id of current.path) {
        out.push({ id, label: byId[id]?.name ?? id });
      }
    }
    return out;
  }, [current, byId]);

  const childCount = (id: string) =>
    orgs.filter((o) => o.parentOrgId === id).length;

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-[#0d1e30] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#0d1e30] border border-red-400/30 rounded-xl p-6 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm flex-wrap">
        {crumbs.map((c, i) => (
          <span key={c.id ?? "root"} className="flex items-center gap-1.5">
            {i > 0 && (
              <FontAwesomeIcon
                icon={faChevronRight}
                className="w-2.5 h-2.5 text-[#7a9bb5]"
              />
            )}
            <button
              onClick={() => setCurrentId(c.id)}
              className={`transition-colors ${
                i === crumbs.length - 1
                  ? "text-white font-medium"
                  : "text-[#7a9bb5] hover:text-white"
              }`}
            >
              {c.label}
            </button>
          </span>
        ))}
      </div>

      {/* Current-node summary (supplier pool) */}
      {current && current.type === "supplier" && poolByOrg[current.id] && (
        <PoolSummary pool={poolByOrg[current.id]} />
      )}

      {/* Grid */}
      {rows.length === 0 ? (
        <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-10 text-center">
          <FontAwesomeIcon
            icon={faLayerGroup}
            className="w-8 h-8 text-[#4590e2]/40 mb-3"
          />
          <p className="text-white font-medium">
            {currentId === null
              ? "No supplier orgs yet"
              : `No ${current ? CHILD_LABEL[current.type ?? "client"] : "items"} here yet`}
          </p>
          <p className="text-[#7a9bb5] text-sm mt-1">
            {currentId === null
              ? "Run the org migration (scripts/migrateOrgs.js --commit) to seed the tree."
              : "Nothing has been provisioned under this node."}
          </p>
        </div>
      ) : (
        <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl overflow-hidden divide-y divide-[#4590e2]/10">
          {rows.map((o) => {
            const meta = TYPE_META[o.type ?? "client"];
            const isLeaf = o.type === "client";
            const count = childCount(o.id);
            const isSelected = isLeaf && selectedClientId === o.id;
            return (
              <button
                key={o.id}
                onClick={() =>
                  isLeaf
                    ? setSelectedClientId(isSelected ? null : o.id)
                    : setCurrentId(o.id)
                }
                className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[#4590e2]/5 ${
                  isSelected ? "bg-[#4590e2]/10" : ""
                }`}
              >
                <FontAwesomeIcon
                  icon={meta.icon}
                  className={`w-4 h-4 shrink-0 ${meta.color}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {o.name}
                    {o.branding?.whiteLabelEnabled && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-purple-300 bg-purple-400/10 border border-purple-400/30 rounded px-1.5 py-0.5">
                        white-label
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[#7a9bb5]">
                    {meta.label}
                    {!isLeaf && ` · ${count} ${CHILD_LABEL[o.type ?? "supplier"]}`}
                  </p>
                </div>
                {o.status !== "active" && (
                  <span className="text-xs px-2 py-0.5 rounded-full border capitalize text-orange-400 bg-orange-400/10 border-orange-400/30">
                    {o.status}
                  </span>
                )}
                {isLeaf ? (
                  <span className="text-xs text-[#4590e2]">
                    {isSelected ? "Close" : "Manage"}
                  </span>
                ) : (
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    className="w-3 h-3 text-[#7a9bb5]"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Provisioning panel for the opened client leaf */}
      {selectedClientId &&
        byId[selectedClientId]?.type === "client" &&
        rows.some((r) => r.id === selectedClientId) && (
          <ProvisioningPanel
            key={selectedClientId}
            client={byId[selectedClientId]}
            reseller={byId[byId[selectedClientId].parentOrgId ?? ""] ?? null}
            existingCap={capByOrg[selectedClientId] ?? null}
            onSaved={load}
            onClose={() => setSelectedClientId(null)}
          />
        )}
    </div>
  );
}

const SKU_LABEL: Record<Sku, string> = {
  ai_pentest: "AI Pentest",
  external: "External",
  internal: "Internal",
  web_app: "Web App",
  manual: "Manual",
};

/**
 * Editable provisioning for a client leaf: per-SKU quota caps (soft/hard) on the
 * client, and the parent reseller's white-label branding. Persists via
 * PUT /api/admin/orgs/[id]/{caps,branding}.
 */
function ProvisioningPanel({
  client,
  reseller,
  existingCap,
  onSaved,
  onClose,
}: {
  client: Org;
  reseller: Org | null;
  existingCap: Cap | null;
  onSaved: () => Promise<void> | void;
  onClose: () => void;
}) {
  // ── Caps state ──
  const [capValues, setCapValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      SKUS.map((s) => [
        s,
        existingCap?.caps?.[s] != null ? String(existingCap.caps[s]) : "",
      ]),
    ),
  );
  const [capPolicy, setCapPolicy] = useState<Record<string, QuotaPolicy>>(() =>
    Object.fromEntries(
      SKUS.map((s) => [s, existingCap?.policy?.[s] ?? "hard"]),
    ),
  );
  const [capSaving, setCapSaving] = useState(false);
  const [capMsg, setCapMsg] = useState<string | null>(null);

  // ── Branding state (parent reseller) ──
  const b = reseller?.branding ?? {};
  const [wlEnabled, setWlEnabled] = useState(b.whiteLabelEnabled ?? false);
  const [logoUrl, setLogoUrl] = useState(b.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(b.primaryColor ?? "#4590e2");
  const [reportFooter, setReportFooter] = useState(b.reportFooter ?? "");
  const [cname, setCname] = useState(b.cname ?? "");
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandMsg, setBrandMsg] = useState<string | null>(null);

  const inputCx =
    "w-full rounded-lg border border-[#4590e2]/20 bg-[#0a141f] px-3 py-2 text-sm text-white placeholder:text-[#7a9bb5]/60 focus:outline-none focus:ring-2 focus:ring-[#4590e2]/40 transition";

  const saveCaps = async () => {
    setCapSaving(true);
    setCapMsg(null);
    try {
      const caps: Record<string, number> = {};
      const policy: Record<string, QuotaPolicy> = {};
      for (const s of SKUS) {
        const v = capValues[s];
        if (v !== "" && v != null) caps[s] = Math.max(0, Math.floor(Number(v)));
        policy[s] = capPolicy[s];
      }
      const res = await fetch(`/api/admin/orgs/${client.id}/caps`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caps, policy }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || `HTTP ${res.status}`);
      }
      setCapMsg("Saved");
      await onSaved();
    } catch (e) {
      setCapMsg(e instanceof Error ? e.message : "Failed to save caps");
    } finally {
      setCapSaving(false);
    }
  };

  const saveBranding = async () => {
    if (!reseller) return;
    setBrandSaving(true);
    setBrandMsg(null);
    try {
      const res = await fetch(`/api/admin/orgs/${reseller.id}/branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branding: {
            whiteLabelEnabled: wlEnabled,
            logoUrl: logoUrl.trim() || undefined,
            primaryColor: primaryColor.trim() || undefined,
            reportFooter: reportFooter.trim() || undefined,
            cname: cname.trim() || undefined,
          },
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || `HTTP ${res.status}`);
      }
      setBrandMsg("Saved");
      await onSaved();
    } catch (e) {
      setBrandMsg(e instanceof Error ? e.message : "Failed to save branding");
    } finally {
      setBrandSaving(false);
    }
  };

  return (
    <div className="bg-[#0d1e30] border border-[#4590e2]/30 rounded-xl p-5 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-medium">Provision · {client.name}</h3>
          <p className="text-xs text-[#7a9bb5] mt-0.5">
            Client quota caps and reseller white-label settings.
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-[#7a9bb5] hover:text-white transition-colors"
        >
          Close
        </button>
      </div>

      {/* ── Quota caps ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white">Quota caps per SKU</p>
          <button
            onClick={saveCaps}
            disabled={capSaving}
            className="rounded-lg bg-[#4590e2] hover:bg-[#357ac4] disabled:opacity-50 text-white px-4 py-1.5 text-xs transition-colors"
          >
            {capSaving ? "Saving…" : "Save caps"}
          </button>
        </div>
        <p className="text-[11px] text-[#7a9bb5]">
          Leave a cap blank for no ceiling. Hard = block at the ceiling; Soft =
          allow overage, meter it, and flag for notification.
        </p>
        <div className="space-y-2">
          {SKUS.map((s) => (
            <div key={s} className="flex items-center gap-3">
              <span className="text-sm text-[#7a9bb5] w-28 shrink-0">
                {SKU_LABEL[s]}
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={capValues[s]}
                onChange={(e) =>
                  setCapValues((p) => ({ ...p, [s]: e.target.value }))
                }
                placeholder="∞"
                className={`${inputCx} max-w-[120px]`}
              />
              <div className="flex rounded-lg overflow-hidden border border-[#4590e2]/20">
                {(["hard", "soft"] as QuotaPolicy[]).map((pol) => (
                  <button
                    key={pol}
                    type="button"
                    onClick={() =>
                      setCapPolicy((p) => ({ ...p, [s]: pol }))
                    }
                    className={`px-3 py-1.5 text-xs capitalize transition-colors ${
                      capPolicy[s] === pol
                        ? pol === "hard"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-orange-400/20 text-orange-300"
                        : "bg-[#0a141f] text-[#7a9bb5] hover:text-white"
                    }`}
                  >
                    {pol}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {capMsg && (
          <p
            className={`text-xs ${capMsg === "Saved" ? "text-green-400" : "text-red-400"}`}
          >
            {capMsg}
          </p>
        )}
      </div>

      {/* ── Reseller white-label ── */}
      <div className="space-y-3 border-t border-[#4590e2]/10 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white">
              Reseller white-label
              {reseller && (
                <span className="text-[#7a9bb5] font-normal">
                  {" "}
                  · {reseller.name}
                </span>
              )}
            </p>
            <p className="text-[11px] text-[#7a9bb5] mt-0.5">
              Branding applied to this reseller&apos;s client reports + portal.
            </p>
          </div>
          <button
            onClick={saveBranding}
            disabled={brandSaving || !reseller}
            className="rounded-lg bg-[#4590e2] hover:bg-[#357ac4] disabled:opacity-50 text-white px-4 py-1.5 text-xs transition-colors"
          >
            {brandSaving ? "Saving…" : "Save branding"}
          </button>
        </div>

        {!reseller ? (
          <p className="text-xs text-[#7a9bb5]">
            No parent reseller resolved for this client.
          </p>
        ) : (
          <>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={wlEnabled}
                onChange={(e) => setWlEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#4590e2]"
              />
              <span className="text-sm text-white">Enable white-label</span>
            </label>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="text-xs text-[#7a9bb5]">Logo URL</span>
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://…/logo.png"
                  className={inputCx}
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-xs text-[#7a9bb5]">Portal subdomain (cname)</span>
                <input
                  value={cname}
                  onChange={(e) => setCname(e.target.value)}
                  placeholder="acme"
                  className={inputCx}
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-xs text-[#7a9bb5]">Primary color</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={
                      /^#[0-9a-fA-F]{6}$/.test(primaryColor)
                        ? primaryColor
                        : "#4590e2"
                    }
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-11 rounded border border-[#4590e2]/20 bg-[#0a141f] cursor-pointer"
                  />
                  <input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#4590e2"
                    className={inputCx}
                  />
                </div>
              </label>
              <label className="space-y-1 block">
                <span className="text-xs text-[#7a9bb5]">Report footer</span>
                <input
                  value={reportFooter}
                  onChange={(e) => setReportFooter(e.target.value)}
                  placeholder="Acme Security · confidential"
                  className={inputCx}
                />
              </label>
            </div>
            {brandMsg && (
              <p
                className={`text-xs ${brandMsg === "Saved" ? "text-green-400" : "text-red-400"}`}
              >
                {brandMsg}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Compact per-SKU pool usage bar for a supplier's quota pool. */
function PoolSummary({ pool }: { pool: Pool }) {
  const skus = Array.from(
    new Set([
      ...Object.keys(pool.purchased ?? {}),
      ...Object.keys(pool.consumed ?? {}),
    ]),
  );
  if (skus.length === 0) return null;
  return (
    <div className="bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-4">
      <p className="text-xs uppercase tracking-wide text-[#7a9bb5] mb-3">
        Quota pool
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {skus.map((sku) => {
          const purchased = pool.purchased?.[sku] ?? 0;
          const consumed = pool.consumed?.[sku] ?? 0;
          const reserved = pool.reserved?.[sku] ?? 0;
          const used = consumed + reserved;
          const pct = purchased > 0 ? Math.min(100, (used / purchased) * 100) : 0;
          const over = used > purchased;
          return (
            <div key={sku}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs text-white">{sku}</span>
                <span className="text-[10px] text-[#7a9bb5]">
                  {used}/{purchased}
                  {pool.policy?.[sku] && ` · ${pool.policy[sku]}`}
                </span>
              </div>
              <div className="h-1.5 bg-[#0a141f] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${over ? "bg-orange-400" : "bg-[#4590e2]"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
