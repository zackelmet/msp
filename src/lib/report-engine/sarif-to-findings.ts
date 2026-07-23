import type { ReportFinding } from "./types";

export interface SarifResult {
  ruleId?: string;
  ruleIndex?: number;
  level?: string;
  message?: { text?: string };
  locations?: Array<{
    physicalLocation?: { artifactLocation?: { uri?: string } };
    logicalLocations?: Array<{ fullyQualifiedName?: string; kind?: string }>;
  }>;
  partialFingerprints?: Record<string, string>;
  properties?: {
    "security-severity"?: string;
    strix?: StrixFinding;
    synthetic_location?: boolean;
    strix_vuln_class_hash?: string;
  };
}

export interface StrixFinding {
  id?: string;
  severity?: string;
  cvss?: number;
  timestamp?: string;
  target?: string;
  endpoint?: string;
  method?: string;
  cwe?: string;
  impact?: string;
  technical_analysis?: string;
  remediation_steps?: string;
  poc?: {
    description?: string;
    script_available?: boolean;
  };
}

export interface SarifDoc {
  version?: string;
  runs?: Array<{
    tool?: {
      driver?: {
        name?: string;
        version?: string;
        rules?: Array<{
          id?: string;
          shortDescription?: { text?: string };
          fullDescription?: { text?: string };
          help?: { text?: string };
          properties?: {
            "security-severity"?: string;
            tags?: string[];
          };
        }>;
      };
    };
    results?: SarifResult[];
    properties?: Record<string, unknown>;
  }>;
}

const SEVERITY_MAP: Record<
  string,
  "Critical" | "High" | "Medium" | "Low" | "Informational"
> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Informational",
  informational: "Informational",
  none: "Informational",
};

function normalizeSeverity(
  raw?: string,
): "Critical" | "High" | "Medium" | "Low" | "Informational" {
  return SEVERITY_MAP[raw?.trim().toLowerCase() ?? ""] ?? "Medium";
}

function parseCvssValue(raw?: string | number): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const n = parseFloat(raw);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function buildCvssVector(cvss: number, severity: string): string {
  if (cvss >= 9.0) return "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H";
  if (cvss >= 7.0) return "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:L";
  if (cvss >= 4.0) return "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:L";
  return "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N";
}

/**
 * Converts a Strix SARIF 2.1.0 document into ReportFinding[] ready for the report engine.
 */
export function sarifToFindings(sarifDoc: SarifDoc): ReportFinding[] {
  const run = sarifDoc.runs?.[0];
  if (!run?.results?.length) return [];

  const rules = run.tool?.driver?.rules ?? [];
  const results = run.results;
  const findings: ReportFinding[] = [];

  for (const result of results) {
    const strix = result.properties?.strix;
    const rule = rules[result.ruleIndex ?? -1];

    const title =
      rule?.shortDescription?.text ??
      result.message?.text?.split("\n")[0] ??
      strix?.id ??
      "Unknown Finding";
    const description =
      rule?.fullDescription?.text ?? result.message?.text ?? "";

    const severity = normalizeSeverity(strix?.severity ?? result.level);
    const cvss = parseCvssValue(
      strix?.cvss ?? result.properties?.["security-severity"],
    );

    const pocParts: string[] = [];
    if (strix?.poc?.description) pocParts.push(strix.poc.description);
    if (strix?.technical_analysis)
      pocParts.push(`\nTechnical Analysis:\n${strix.technical_analysis}`);

    let remediation = strix?.remediation_steps ?? "";
    if (!remediation && rule?.help?.text) {
      const helpLines = rule.help.text.split("\n");
      const steps = helpLines.filter((l) => /^\d+\./.test(l.trim()));
      if (steps.length) remediation = steps.join("\n");
    }

    const target = strix?.target ?? "";
    const endpoint = strix?.endpoint ?? "";
    const targetUrl = target || endpoint;

    const references: string[] = [];
    if (strix?.cwe) {
      references.push(
        `https://cwe.mitre.org/data/definitions/${strix.cwe.replace("CWE-", "")}.html`,
      );
      if (result.ruleId && result.ruleId !== strix.cwe) {
        references.push(
          `https://cwe.mitre.org/data/definitions/${result.ruleId.replace("CWE-", "")}.html`,
        );
      }
    }

    findings.push({
      title,
      description,
      poc: pocParts.join("\n\n"),
      impact: strix?.impact ?? "",
      remediation,
      cvss,
      cvssValue: `${cvss}`,
      cvss31Score: cvss > 0 ? `${cvss}` : undefined,
      cvss31Vector: cvss > 0 ? buildCvssVector(cvss, severity) : undefined,
      severity,
      references: references.length > 0 ? references : undefined,
    });
  }

  return findings;
}

/**
 * Parses a raw SARIF JSON string into ReportFinding[].
 */
export function parseSarifString(sarifJson: string): ReportFinding[] {
  try {
    const doc: SarifDoc = JSON.parse(sarifJson);
    return sarifToFindings(doc);
  } catch {
    return [];
  }
}
