import { Severity } from "@/lib/types/pentest";

// ── CSV parser ────────────────────────────────────────────────────────────────

/**
 * RFC-4180-aware CSV tokeniser.
 * Handles quoted fields that contain commas, newlines, and escaped double-quotes.
 */
function parseCSVRows(raw: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let inQuote = false;
  let row: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const next = raw[i + 1];

    if (inQuote) {
      if (ch === '"' && next === '"') {
        // Escaped quote inside a quoted field
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\r" && next === "\n") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
        i++; // skip \n
      } else if (ch === "\n") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  // flush last field / row
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Maps CSV column headers (case-insensitive, trimmed) to column indices.
 */
function buildHeaderMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    map[h.trim().toLowerCase()] = i;
  });
  return map;
}

const CSV_SEVERITY_ALIASES: Record<string, string> = {
  "risk level": "severity",
  risk: "severity",
};

/**
 * Parses a CSV text export into ParsedFinding[].
 *
 * Expected columns (case-insensitive):
 *   Title, Risk Level | Severity, Description, Proof of Concept | Evidence | PoC,
 *   Impact, Remediation, Target (optional), Affected Component (optional)
 */
export function parseCSVFindings(csvText: string): ParsedFinding[] {
  const rows = parseCSVRows(csvText.trim());
  if (rows.length < 2) return [];

  const rawHeaders = rows[0];
  // Normalise header names: map aliases like "Risk Level" → "severity"
  const normHeaders = rawHeaders.map((h) => {
    const lower = h.trim().toLowerCase();
    return CSV_SEVERITY_ALIASES[lower] ?? lower;
  });
  const hMap = buildHeaderMap(normHeaders);

  const col = (row: string[], ...keys: string[]): string => {
    for (const k of keys) {
      const idx = hMap[k.toLowerCase()];
      if (idx !== undefined && row[idx] !== undefined) return row[idx].trim();
    }
    return "";
  };

  const results: ParsedFinding[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => !c.trim())) continue; // skip blank rows

    const title = col(row, "title");
    if (!title) continue;

    const severityRaw = col(row, "severity", "risk level", "risk");
    const description = col(row, "description", "summary", "detail");
    const evidence = col(
      row,
      "proof of concept",
      "poc",
      "evidence",
      "payload",
    );
    const impact = col(row, "impact");
    const remediation = col(row, "remediation", "fix", "recommendation");
    const cvss31Score = col(
      row,
      "cvss 3.1 score",
      "cvss31 score",
      "cvss score",
      "cvss",
    );
    const cvss31Vector = col(
      row,
      "cvss 3.1 vector",
      "cvss31 vector",
      "cvss vector",
      "vector",
    );
    const cvss40Score = col(row, "cvss 4.0 score", "cvss40 score");
    const cvss40Vector = col(row, "cvss 4.0 vector", "cvss40 vector");
    const target = col(row, "target", "url", "host", "endpoint");
    const affectedComponent = col(
      row,
      "affected component",
      "component",
      "parameter",
    );

    results.push({
      title,
      severity: normalizeSeverity(severityRaw),
      target: target || "—",
      affectedComponent,
      description,
      evidence,
      // Surface "Impact" in the steps field since there's no dedicated impact field
      stepsToReproduce: impact,
      remediation,
      cvss31Score: cvss31Score || undefined,
      cvss31Vector: cvss31Vector || undefined,
      cvss40Score: cvss40Score || undefined,
      cvss40Vector: cvss40Vector || undefined,
    });
  }

  return results;
}
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedFinding {
  title: string;
  severity: Severity;
  target: string;
  affectedComponent: string;
  description: string;
  evidence: string;
  stepsToReproduce: string;
  remediation: string;
  cvss31Score?: string;
  cvss31Vector?: string;
  cvss40Score?: string;
  cvss40Vector?: string;
}

const SEVERITY_MAP: Record<string, Severity> = {
  critical: "critical",
  high: "high",
  med: "medium",
  medium: "medium",
  low: "low",
  info: "info",
  informational: "info",
};

export function normalizeSeverity(raw: string): Severity {
  return SEVERITY_MAP[raw.trim().toLowerCase()] ?? "medium";
}

const KNOWN_LABELS = [
  "title",
  "severity",
  "risk",
  "target",
  "url",
  "host",
  "endpoint",
  "affected component",
  "affectedcomponent",
  "component",
  "parameter",
  "description",
  "summary",
  "detail",
  "details",
  "evidence",
  "proof of concept",
  "poc",
  "payload",
  "steps to reproduce",
  "steps",
  "reproduction",
  "repro",
  "remediation",
  "fix",
  "recommendation",
  "mitigation",
  "cvss",
  "cve",
  "references",
];

/**
 * Extracts the value for a labelled field inside a single finding block.
 * Grabs everything from the label up to the next known label (or end of block).
 */
function extractField(block: string, ...labels: string[]): string {
  for (const label of labels) {
    const pattern = new RegExp(
      `(?:^|\\n)[ \\t]*${label}[ \\t]*[:\\-][ \\t]*([\\s\\S]*?)(?=\\n[ \\t]*(?:${KNOWN_LABELS.join("|")})[ \\t]*[:\\-]|$)`,
      "i",
    );
    const m = block.match(pattern);
    if (m) return m[1].trim();
  }
  return "";
}

/**
 * Splits a raw text block into individual finding objects.
 * Delimiters: `---`, `===`, or a blank line before a new `Title:` line.
 */
export function parseFindingsBlock(raw: string): ParsedFinding[] {
  const chunks = raw
    .split(/\n[ \t]*(?:-{3,}|={3,})[ \t]*\n/)
    .flatMap((chunk) => chunk.split(/\n{2,}(?=[ \t]*title[ \t]*[:\-])/i))
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const results: ParsedFinding[] = [];

  for (const chunk of chunks) {
    const title = extractField(chunk, "title");
    if (!title) continue;

    const severityRaw = extractField(chunk, "severity", "risk");
    const target = extractField(chunk, "target", "url", "host", "endpoint");
    const affectedComponent = extractField(
      chunk,
      "affected component",
      "affectedcomponent",
      "component",
      "parameter",
    );
    const description = extractField(
      chunk,
      "description",
      "summary",
      "detail",
      "details",
    );
    const evidence = extractField(
      chunk,
      "evidence",
      "proof of concept",
      "poc",
      "payload",
    );
    const stepsToReproduce = extractField(
      chunk,
      "steps to reproduce",
      "steps",
      "reproduction",
      "repro",
    );
    const remediation = extractField(
      chunk,
      "remediation",
      "fix",
      "recommendation",
      "mitigation",
    );

    results.push({
      title,
      severity: normalizeSeverity(severityRaw),
      target: target || "—",
      affectedComponent,
      description,
      evidence,
      stepsToReproduce,
      remediation,
    });
  }

  return results;
}
