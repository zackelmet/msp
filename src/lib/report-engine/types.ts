export interface ReportFinding {
  title: string;
  description: string;
  poc: string;
  impact: string;
  remediation: string;
  cvss: number;
  cvssValue: string;
  /** CVSS 3.1 base score as a display string (e.g. "4.3"). */
  cvss31Score?: string;
  /** CVSS 3.1 vector string (e.g. "CVSS:3.1/AV:A/AC:H/..."). */
  cvss31Vector?: string;
  /** CVSS 4.0 base score as a display string (e.g. "2.3"). */
  cvss40Score?: string;
  /** CVSS 4.0 vector string (e.g. "CVSS:4.0/AV:N/AC:H/AT:P/..."). */
  cvss40Vector?: string;
  severity?: "Critical" | "High" | "Medium" | "Low" | "Informational";
  references?: string[];
}

/**
 * Reseller / white-label branding overrides for a generated report.
 *
 * When `whiteLabelEnabled` is true these values override the default
 * "MSP Pentesting" identity on the cover, headings, accent color and footer.
 * Mirrors the resolvable fields on `OrgBranding` (src/lib/types/org.ts).
 *
 * TODO: branding should later be auto-resolved from the pentest's reseller org
 * (via `resellerId` → `orgs/{resellerId}.branding`) once the org tree is wired
 * to launches. For v1 it is passed in explicitly through submit → generate.
 */
export interface ReportBranding {
  /** Company name shown on the cover, headings and attestation. */
  companyName?: string;
  /** Absolute URL to a PNG/JPG logo used on the cover + attestation icon. */
  logoUrl?: string;
  /** Hex accent color, e.g. "#4590e2" — recolors headings + table headers. */
  primaryColor?: string;
  /** Contact / support email shown in the attestation block. */
  emailSender?: string;
  /** Free-text footer rendered at the bottom of every page. */
  footerText?: string;
  /** Master switch — when false/undefined, default MSP branding is used. */
  whiteLabelEnabled?: boolean;
}

export interface ReportPayload {
  reportType?: "external" | "webapp" | "msp";
  /** Cover branding — which company's logo/identity to render. */
  brand?: "msp" | "aip";
  /** Reseller white-label overrides (logo/color/name/footer). */
  branding?: ReportBranding;
  clientName: string;
  projectTitle: string;
  target?: string;
  completedDate?: string;
  tester?: string;
  version?: string;
  notes?: string;
  executiveSummary?: string;
  purpose?: string;
  detailedAnalysis?: string;
  scopeTargets?: string[];
  sharedWithUserIds?: string[];
  findings: ReportFinding[];
}
