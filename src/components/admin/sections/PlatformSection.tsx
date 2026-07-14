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
 * Read-only first cut: lists the org tree from /api/admin/orgs and shows the
 * supplier's quota pool. Provisioning (editable soft/hard quotas, white-label
 * settings) lands next. Empty until scripts/migrateOrgs has run.
 */

type OrgType = "supplier" | "reseller" | "client";

interface Org {
  id: string;
  type: OrgType | null;
  parentOrgId: string | null;
  path: string[];
  name: string;
  status: string;
  tierId: string | null;
  branding: { whiteLabelEnabled?: boolean } | null;
}

interface Pool {
  orgId: string;
  purchased: Record<string, number>;
  reserved: Record<string, number>;
  consumed: Record<string, number>;
  policy: Record<string, "soft" | "hard">;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The node we've drilled INTO. null = root (list all suppliers).
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/orgs");
        if (!res.ok) throw new Error(`Failed to load orgs (${res.status})`);
        const data = await res.json();
        setOrgs(data.orgs ?? []);
        setPools(data.pools ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load orgs");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const byId = useMemo(
    () => Object.fromEntries(orgs.map((o) => [o.id, o])),
    [orgs],
  );
  const poolByOrg = useMemo(
    () => Object.fromEntries(pools.map((p) => [p.orgId, p])),
    [pools],
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
            return (
              <button
                key={o.id}
                disabled={isLeaf}
                onClick={() => !isLeaf && setCurrentId(o.id)}
                className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${
                  isLeaf ? "cursor-default" : "hover:bg-[#4590e2]/5"
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
                {!isLeaf && (
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
