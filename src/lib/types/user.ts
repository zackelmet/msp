import { Timestamp } from "firebase-admin/firestore";

/**
 * Role within the org tree. Governs what a user may do in the dashboard;
 * orthogonal to the org `path` which governs *which* subtree they can see.
 *
 * - platform_admin: MSP Pentesting staff — sees across every supplier tree.
 * - supplier_admin:  manages one supplier + its resellers/clients (e.g. Compulab).
 * - reseller_admin:  manages one reseller (MSP) + its clients.
 * - client_user:     an end-client user (their own IT dept / the direct customer).
 */
export type UserRole =
  | "platform_admin"
  | "supplier_admin"
  | "reseller_admin"
  | "client_user";

export interface UserDocument {
  uid: string;
  email: string;
  name: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;

  // --- Org membership (multi-tenant platform) ---
  // The org node this user belongs to (usually a client, or a reseller/supplier
  // for partner admins). `orgPath` is the resolved ancestor path (root→org) copied
  // from the org doc for cheap subtree authz in rules + queries.
  // Optional during migration; backfilled by scripts/migrate-orgs.
  orgId?: string;
  orgPath?: string[];
  role?: UserRole;
  /**
   * True when the user self-registered via public signup (auto-enrolled as a
   * reseller under MSPP, parked). Drives the in-portal distributor-upsell prompt.
   * Absent for the MSPP house reseller and script-onboarded partners.
   */
  selfEnrolled?: boolean;

  // Pentest credits
  credits: {
    web_app: number;
    external_ip: number;
    // Volume-priced AI pentest credits (dashboard "Buy AI Credits" flow).
    // One credit = one IP / domain / URL launched.
    ai_pentest?: number;
  };

  // Optional profile fields
  companyName?: string;
  profileImageUrl?: string;

  // Onboarding tour state
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: Timestamp;
}

// ---------------------------------------------------------------------------
// Legacy types kept for compatibility with unused scanner pages (scans, targets)
// ---------------------------------------------------------------------------

export type PlanTier = "free" | "paid";

export interface SavedTarget {
  id: string;
  name: string;
  addresses: string[];
  address?: string;
  type: "ip" | "domain" | "url" | "group";
  tags?: string[];
  createdAt?: Timestamp;
}

export interface ScanMetadata {
  scanId: string;
  type: "nmap" | "openvas" | "zap";
  target: string;
  status: "queued" | "running" | "completed" | "failed";
  batchId?: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  resultsSummary?: {
    portsFound?: number;
    vulnerabilities?: number;
    severity?: "low" | "medium" | "high" | "critical";
  };
  gcpStorageUrl?: string;
  errorMessage?: string;
}

export function getPlanLimits(_plan: PlanTier) {
  return {
    monthlyScans: 0,
    scanners: { nmap: 0, openvas: 0, zap: 0 },
    features: {
      nmapEnabled: false,
      openvasEnabled: false,
      apiAccess: false,
      customReports: false,
      prioritySupport: false,
    },
  };
}
