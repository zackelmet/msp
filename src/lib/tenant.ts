"use client";

import { useEffect, useState } from "react";

export interface TenantBranding {
  orgId: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

// Subdomains that are the MAIN app, not a distributor tenant.
const RESERVED = new Set(["dashboard", "www", "app", "admin", "api"]);

/**
 * The distributor tenant slug for the current request:
 *  - `?tenant=<slug>` query override (for testing before the wildcard domain is live)
 *  - else the subdomain of `<slug>.msppentesting.com`
 * Returns null for the main app (dashboard.*, apex, localhost, *.vercel.app).
 */
export function getTenantSlug(): string | null {
  if (typeof window === "undefined") return null;
  const override = new URLSearchParams(window.location.search).get("tenant");
  if (override) return override.trim().toLowerCase();

  const host = window.location.hostname;
  if (!host.endsWith("msppentesting.com")) return null; // localhost / *.vercel.app
  const parts = host.split(".");
  if (parts.length !== 3) return null; // apex msppentesting.com
  const sub = parts[0].toLowerCase();
  return RESERVED.has(sub) ? null : sub;
}

/**
 * Resolve the current tenant's white-label branding (or null on the main app).
 * `loading` is true until resolved so callers can avoid a brand flash.
 */
export function useTenantBranding(): {
  tenant: TenantBranding | null;
  loading: boolean;
} {
  const [tenant, setTenant] = useState<TenantBranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const slug = getTenantSlug();
    if (!slug) {
      setLoading(false);
      return;
    }
    let alive = true;
    fetch(`/api/tenant?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        setTenant(d?.tenant ?? null);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { tenant, loading };
}
