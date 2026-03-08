import { Timestamp } from "firebase-admin/firestore";

export interface UserDocument {
  uid: string;
  email: string;
  name: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;

  // Pentest credits
  credits: {
    web_app: number;
    external_ip: number;
  };

  // Optional profile fields
  companyName?: string;
  profileImageUrl?: string;
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
