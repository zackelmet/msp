import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import fs from "node:fs";
import path from "node:path";
import { ReportPayload } from "@/lib/report-engine/types";

type Severity = "Critical" | "High" | "Medium" | "Low" | "Informational";

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "C00000",
  High: "FF0000",
  Medium: "FFC000",
  Low: "70AD47",
  Informational: "4472C4",
};

function severityXml(severity: Severity): string {
  const color = SEVERITY_COLORS[severity] ?? "000000";
  return (
    `<w:r>` +
    `<w:rPr><w:color w:val="${color}"/><w:b/></w:rPr>` +
    `<w:t>${severity}</w:t>` +
    `</w:r>`
  );
}

function normalizeSeverity(value: string | undefined, cvss: number): Severity {
  const normalized = (value || "").toLowerCase();
  if (
    ["critical", "high", "medium", "low", "informational", "info"].includes(
      normalized,
    )
  ) {
    if (normalized === "info") return "Informational";
    return `${normalized[0].toUpperCase()}${normalized.slice(1)}` as Severity;
  }
  if (cvss >= 9) return "Critical";
  if (cvss >= 7) return "High";
  if (cvss >= 4) return "Medium";
  if (cvss > 0) return "Low";
  return "Informational";
}

function resolveTemplatePath(reportType: string): string {
  // If a webapp template exists, use it; otherwise fall back to external.
  if (reportType === "webapp") {
    const webappPath = path.join(
      process.cwd(),
      "public",
      "templates",
      "webapp-report-template.docx",
    );
    if (fs.existsSync(webappPath)) return webappPath;
  }
  return path.join(
    process.cwd(),
    "public",
    "templates",
    "external-report-template.docx",
  );
}

/**
 * Legacy DOCX generation path (templated via docxtemplater). The primary
 * delivery path is now `buildReportPdf` (pdf-template.ts) which carries the
 * white-label branding overrides; this remains for callers that want the
 * editable Word artifact.
 */
export function buildReportDocx(payload: ReportPayload): Buffer {
  const templatePath = resolveTemplatePath(payload.reportType ?? "external");

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Report template not found at ${templatePath}`);
  }

  const templateBuffer = fs.readFileSync(templatePath);
  const zip = new PizZip(templateBuffer);

  const doc = new Docxtemplater(zip, {
    // Template uses {{double braces}}
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
    // Allows {~severity_xml} raw XML injection for colored severity text
    nullGetter: () => "",
  });

  const now = new Date();
  const completedDate =
    payload.completedDate ?? now.toLocaleDateString("en-US");

  const scopeTargets = payload.scopeTargets?.length
    ? payload.scopeTargets
    : payload.target
      ? [payload.target]
      : ["Not provided"];

  // Severity summary counts
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of payload.findings) {
    const sev = normalizeSeverity(f.severity, f.cvss).toLowerCase();
    if (sev === "critical") severityCounts.critical++;
    else if (sev === "high") severityCounts.high++;
    else if (sev === "medium") severityCounts.medium++;
    else if (sev === "low") severityCounts.low++;
    else severityCounts.info++;
  }

  const findings = payload.findings.map((finding, index) => {
    const sev = normalizeSeverity(finding.severity, finding.cvss);
    return {
      index: String(index + 1).padStart(2, "0"),
      title: finding.title,
      description: finding.description,
      severity: sev,
      severity_xml: severityXml(sev),
      cvss_vector: finding.cvssValue,
      impact: finding.impact,
      poc: finding.poc,
      remediation: finding.remediation,
    };
  });

  const toc_findings = findings.map((f) => ({
    toc_index: f.index,
    toc_title: f.title,
  }));

  const brandName =
    payload.branding?.whiteLabelEnabled && payload.branding.companyName
      ? payload.branding.companyName
      : "MSP Pentesting";

  doc.render({
    // Cover / header fields
    REPORT_TITLE: payload.projectTitle,
    TARGET: payload.target ?? "",
    COMPLETION_DATE: completedDate,

    // Metadata table
    REPORT_VERSION: payload.version ?? "1.0",
    REPORT_DATE: completedDate,
    TESTER_NAME: payload.tester ?? brandName,
    REPORT_NOTES: payload.notes ?? `Penetration Test for ${payload.clientName}`,

    // Attestation
    CLIENT_NAME: payload.clientName,

    // Executive summary (both old and new template placeholder names)
    EXECUTIVE_SUMMARY: payload.executiveSummary ?? "",
    EXECUTIVE_SUMMARY_PARAGRAPH_1: payload.executiveSummary ?? "",
    EXECUTIVE_SUMMARY_PARAGRAPH_2: payload.detailedAnalysis ?? "",

    // Assessment overview
    PURPOSE_STATEMENT: payload.purpose ?? "",
    ASSESSMENT_INTEGRITY_STATEMENT: "",

    // Scope — single joined string for {{SCOPE_TARGET}} placeholder
    SCOPE_TARGET: scopeTargets.join("\n"),

    // Findings Summary severity counts
    CRITICAL_COUNT: String(severityCounts.critical),
    HIGH_COUNT: String(severityCounts.high),
    MEDIUM_COUNT: String(severityCounts.medium),
    LOW_COUNT: String(severityCounts.low),
    INFO_COUNT: String(severityCounts.info),

    // Findings loop — {{#findings}}...{{/findings}}
    findings,
    // TOC findings loop — {{#toc_findings}}...{{/toc_findings}}
    toc_findings,
  });

  return doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
}
