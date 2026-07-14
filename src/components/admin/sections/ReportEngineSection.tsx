"use client";

import { FormEvent, useRef, useState } from "react";
import { parseCSVFindings } from "@/lib/findings/parseFindingsBlock";

/**
 * Report Engine admin section. Submit structured findings (or import a CSV) and
 * generate a delivery-ready branded PDF via /api/admin/report-engine/submit.
 *
 * White-labeling: the branding panel supplies a reseller identity (company name,
 * logo URL, accent color, footer). When "Enable white-label" is off the report
 * falls back to the default MSP Pentesting branding.
 *
 * TODO: branding should later be auto-resolved from the pentest's reseller org
 * (resellerId → orgs/{resellerId}.branding) once the org tree is wired to
 * launches. For now the admin supplies it here and it is passed to the API.
 */

interface Finding {
  title: string;
  description: string;
  poc: string;
  impact: string;
  remediation: string;
  cvss: string;
  cvssValue: string;
  cvss31Vector?: string;
  cvss40Vector?: string;
}

const emptyFinding = (): Finding => ({
  title: "",
  description: "",
  poc: "",
  impact: "",
  remediation: "",
  cvss: "",
  cvssValue: "",
});

const RISK_TO_CVSS: Record<string, number> = {
  critical: 9.0,
  high: 7.5,
  medium: 5.0,
  low: 2.5,
  info: 0.0,
};

// ── Shared dark-theme class names (msp palette) ──
const inputCx =
  "w-full rounded-lg border border-[#4590e2]/20 bg-[#0a141f] px-4 py-2.5 text-sm text-white placeholder:text-[#7a9bb5]/60 focus:outline-none focus:ring-2 focus:ring-[#4590e2]/40 focus:border-[#4590e2]/40 transition";
const errorInputCx =
  "w-full rounded-lg border border-red-500/60 bg-red-500/5 px-4 py-2.5 text-sm text-white placeholder:text-[#7a9bb5]/60 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/60 transition";
const selectCx =
  "w-full rounded-lg border border-[#4590e2]/20 bg-[#0a141f] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#4590e2]/40 transition cursor-pointer";
const cardCx = "bg-[#0d1e30] border border-[#4590e2]/15 rounded-xl p-6";
const labelCx = "text-sm text-[#7a9bb5]";

export default function ReportEngineSection() {
  const [reportType, setReportType] = useState<"external" | "webapp">(
    "external",
  );
  const [clientName, setClientName] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [target, setTarget] = useState("");
  const [executiveSummary, setExecutiveSummary] = useState("");
  const [detailedAnalysis, setDetailedAnalysis] = useState("");
  const [findings, setFindings] = useState<Finding[]>([emptyFinding()]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [generatedReportUrl, setGeneratedReportUrl] = useState("");
  const [downloadFileName, setDownloadFileName] = useState("");
  const [csvImportError, setCsvImportError] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // ── White-label branding ──
  const [wlEnabled, setWlEnabled] = useState(false);
  const [wlCompanyName, setWlCompanyName] = useState("");
  const [wlLogoUrl, setWlLogoUrl] = useState("");
  const [wlPrimaryColor, setWlPrimaryColor] = useState("#4590e2");
  const [wlEmailSender, setWlEmailSender] = useState("");
  const [wlFooterText, setWlFooterText] = useState("");

  const handleCSVImport = (file: File) => {
    setCsvImportError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSVFindings(text);
      if (parsed.length === 0) {
        setCsvImportError(
          "No findings found. Ensure the CSV has a header row with a 'Title' column.",
        );
        return;
      }
      const mapped: Finding[] = parsed.map((f) => ({
        title: f.title,
        description: f.description,
        poc: f.evidence,
        impact: f.stepsToReproduce, // Impact column maps here
        remediation: f.remediation,
        cvss: String(
          Number(f.cvss31Score) || RISK_TO_CVSS[f.severity] || 5.0,
        ),
        cvssValue: f.severity.charAt(0).toUpperCase() + f.severity.slice(1),
        cvss31Vector: f.cvss31Vector,
        cvss40Vector: f.cvss40Vector,
      }));
      setFindings((prev) => {
        const isBlank = prev.length === 1 && !prev[0].title.trim();
        return isBlank ? mapped : [...prev, ...mapped];
      });
      setFieldErrors({});
    };
    reader.readAsText(file);
  };

  const addFinding = () => setFindings([...findings, emptyFinding()]);

  const removeFinding = (index: number) => {
    if (findings.length === 1) return;
    setFindings(findings.filter((_, i) => i !== index));
  };

  const updateFinding = (
    index: number,
    field: keyof Finding,
    value: string,
  ) => {
    const updated = [...findings];
    updated[index] = { ...updated[index], [field]: value };
    setFindings(updated);
  };

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};

    if (!clientName.trim()) errs["clientName"] = "Required";
    if (!projectTitle.trim()) errs["projectTitle"] = "Required";

    findings.forEach((finding, index) => {
      if (!finding.title.trim()) errs[`findings.${index}.title`] = "Required";
      if (!finding.description.trim())
        errs[`findings.${index}.description`] = "Required";
      if (!finding.poc.trim()) errs[`findings.${index}.poc`] = "Required";
      if (!finding.impact.trim()) errs[`findings.${index}.impact`] = "Required";
      if (!finding.remediation.trim())
        errs[`findings.${index}.remediation`] = "Required";
      if (!finding.cvssValue.trim())
        errs[`findings.${index}.cvssValue`] = "Required";
      const cvss = Number.parseFloat(finding.cvss);
      if (Number.isNaN(cvss) || cvss < 0 || cvss > 10) {
        errs[`findings.${index}.cvss`] = "Must be 0–10";
      }
    });

    return errs;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitStatus("idle");
    setGeneratedReportUrl("");

    const validationErrors = validate();
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const branding = wlEnabled
      ? {
          whiteLabelEnabled: true,
          companyName: wlCompanyName.trim() || undefined,
          logoUrl: wlLogoUrl.trim() || undefined,
          primaryColor: wlPrimaryColor.trim() || undefined,
          emailSender: wlEmailSender.trim() || undefined,
          footerText: wlFooterText.trim() || undefined,
        }
      : undefined;

    const payload = {
      reportType,
      branding,
      clientName: clientName.trim(),
      projectTitle: projectTitle.trim(),
      target: target.trim() || undefined,
      executiveSummary: executiveSummary.trim() || undefined,
      detailedAnalysis: detailedAnalysis.trim() || undefined,
      findings: findings.map((finding) => ({
        title: finding.title.trim(),
        description: finding.description.trim(),
        poc: finding.poc.trim(),
        impact: finding.impact.trim(),
        remediation: finding.remediation.trim(),
        cvss: Number.parseFloat(finding.cvss),
        cvssValue: finding.cvssValue.trim(),
        cvss31Vector: finding.cvss31Vector,
        cvss40Vector: finding.cvss40Vector,
      })),
    };

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/report-engine/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      setSubmitStatus("success");
      setGeneratedReportUrl(data.signedUrl || data.accessUrl || "");
      setDownloadFileName(data.fileName || "report.pdf");
      setClientName("");
      setProjectTitle("");
      setTarget("");
      setReportType("external");
      setExecutiveSummary("");
      setDetailedAnalysis("");
      setFindings([emptyFinding()]);
      setFieldErrors({});
    } catch {
      setSubmitStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  const cx = (key: string) => (fieldErrors[key] ? errorInputCx : inputCx);
  const fe = (key: string) =>
    fieldErrors[key] ? (
      <p className="text-xs text-red-400 mt-1">{fieldErrors[key]}</p>
    ) : null;

  const hasErrors = Object.keys(fieldErrors).length > 0;

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-light text-white mb-1">Report Engine</h2>
          <p className="text-[#7a9bb5] text-sm">
            Generate branded pentest PDF reports from structured findings.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <select
            value={reportType}
            onChange={(e) =>
              setReportType(e.target.value as "external" | "webapp")
            }
            className={selectCx + " w-auto"}
          >
            <option value="external" className="bg-[#0a141f] text-white">
              External
            </option>
            <option value="webapp" className="bg-[#0a141f] text-white">
              Web App
            </option>
          </select>
          <button
            type="submit"
            form="report-engine-form"
            disabled={submitting}
            className="rounded-lg bg-[#4590e2] hover:bg-[#357ac4] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 text-sm font-medium transition-colors whitespace-nowrap"
          >
            {submitting ? "Generating…" : "Generate Report"}
          </button>
        </div>
      </div>

      {hasErrors && (
        <div className="rounded-xl p-4 border border-red-500/30 bg-red-500/10">
          <p className="text-red-400 text-sm">
            Please fix the highlighted fields before generating.
          </p>
        </div>
      )}

      {submitStatus === "success" && (
        <div className="rounded-xl p-5 border border-green-400/30 bg-green-400/10 text-green-300 text-sm flex items-center justify-between gap-4 flex-wrap">
          <span>Report generated successfully.</span>
          {generatedReportUrl && (
            <a
              href={generatedReportUrl}
              download={downloadFileName || "report.pdf"}
              className="px-4 py-2 rounded-md bg-[#4590e2] text-white hover:bg-[#357ac4] transition-colors"
            >
              Download Report
            </a>
          )}
        </div>
      )}

      {submitStatus === "error" && (
        <div className="rounded-xl p-5 border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          Failed to generate report. Please try again.
        </div>
      )}

      <form id="report-engine-form" onSubmit={handleSubmit} className="space-y-6">
        {/* ── Engagement details ── */}
        <section className={cardCx + " space-y-4"}>
          <h3 className="text-lg text-white">Engagement Details</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <span className={labelCx}>Client Name *</span>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className={cx("clientName")}
              />
              {fe("clientName")}
            </div>
            <div className="space-y-1.5">
              <span className={labelCx}>Project Title *</span>
              <input
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="e.g. External Pentest Q2"
                className={cx("projectTitle")}
              />
              {fe("projectTitle")}
            </div>
            <label className="space-y-1.5 block">
              <span className={labelCx}>Target (optional)</span>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="domain/IP"
                className={inputCx}
              />
            </label>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <label className="space-y-1.5 block">
              <span className={labelCx}>Executive Summary (optional)</span>
              <textarea
                rows={4}
                value={executiveSummary}
                onChange={(e) => setExecutiveSummary(e.target.value)}
                placeholder="High-level business summary for leadership"
                className={`${inputCx} resize-y`}
              />
            </label>
            <label className="space-y-1.5 block">
              <span className={labelCx}>Finding Summary (optional)</span>
              <textarea
                rows={4}
                value={detailedAnalysis}
                onChange={(e) => setDetailedAnalysis(e.target.value)}
                placeholder="Overall findings summary or additional analyst notes"
                className={`${inputCx} resize-y`}
              />
            </label>
          </div>
        </section>

        {/* ── White-label branding ── */}
        <section className={cardCx + " space-y-4"}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-lg text-white">Reseller White-Labeling</h3>
              <p className="text-xs text-[#7a9bb5] mt-0.5">
                Override the default MSP Pentesting branding for reseller
                delivery.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={wlEnabled}
                onChange={(e) => setWlEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#4590e2]"
              />
              <span className="text-sm text-white">Enable white-label</span>
            </label>
          </div>

          {wlEnabled && (
            <div className="space-y-4 pt-1">
              <div className="grid md:grid-cols-2 gap-4">
                <label className="space-y-1.5 block">
                  <span className={labelCx}>Company Name</span>
                  <input
                    value={wlCompanyName}
                    onChange={(e) => setWlCompanyName(e.target.value)}
                    placeholder="e.g. Acme Security"
                    className={inputCx}
                  />
                </label>
                <label className="space-y-1.5 block">
                  <span className={labelCx}>Logo URL (PNG/JPG)</span>
                  <input
                    value={wlLogoUrl}
                    onChange={(e) => setWlLogoUrl(e.target.value)}
                    placeholder="https://…/logo.png"
                    className={inputCx}
                  />
                </label>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <label className="space-y-1.5 block">
                  <span className={labelCx}>Primary Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={
                        /^#[0-9a-fA-F]{6}$/.test(wlPrimaryColor)
                          ? wlPrimaryColor
                          : "#4590e2"
                      }
                      onChange={(e) => setWlPrimaryColor(e.target.value)}
                      className="h-10 w-12 rounded border border-[#4590e2]/20 bg-[#0a141f] cursor-pointer"
                    />
                    <input
                      value={wlPrimaryColor}
                      onChange={(e) => setWlPrimaryColor(e.target.value)}
                      placeholder="#4590e2"
                      className={inputCx}
                    />
                  </div>
                </label>
                <label className="space-y-1.5 block md:col-span-2">
                  <span className={labelCx}>Contact Email</span>
                  <input
                    value={wlEmailSender}
                    onChange={(e) => setWlEmailSender(e.target.value)}
                    placeholder="security@acme.com"
                    className={inputCx}
                  />
                </label>
              </div>
              <label className="space-y-1.5 block">
                <span className={labelCx}>Report Footer</span>
                <input
                  value={wlFooterText}
                  onChange={(e) => setWlFooterText(e.target.value)}
                  placeholder="Acme Security · 123 Main St · confidential"
                  className={inputCx}
                />
              </label>
            </div>
          )}
        </section>

        {/* ── Findings ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg text-white">Findings ({findings.length})</h3>
            <div className="flex items-center gap-3">
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCSVImport(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="rounded-lg border border-[#4590e2]/20 bg-[#0a141f] hover:bg-[#4590e2]/10 text-[#7a9bb5] hover:text-white px-4 py-2 text-sm transition-colors"
              >
                Import CSV
              </button>
              <button
                type="button"
                onClick={addFinding}
                className="rounded-lg bg-[#4590e2] hover:bg-[#357ac4] text-white px-4 py-2 text-sm transition-colors"
              >
                Add Finding
              </button>
            </div>
          </div>

          {csvImportError && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              {csvImportError}
            </div>
          )}

          {findings.map((finding, index) => (
            <div key={index} className={cardCx + " space-y-4"}>
              <div className="flex items-center justify-between">
                <h4 className="text-base text-white">Finding #{index + 1}</h4>
                {findings.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFinding(index)}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid md:grid-cols-[1fr_160px] gap-4">
                <div className="space-y-1.5">
                  <span className={labelCx}>Title *</span>
                  <input
                    value={finding.title}
                    onChange={(e) =>
                      updateFinding(index, "title", e.target.value)
                    }
                    className={cx(`findings.${index}.title`)}
                  />
                  {fe(`findings.${index}.title`)}
                </div>
                <div className="space-y-1.5">
                  <span className={labelCx}>CVSS Score *</span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={finding.cvss}
                    onChange={(e) =>
                      updateFinding(index, "cvss", e.target.value)
                    }
                    className={cx(`findings.${index}.cvss`)}
                  />
                  {fe(`findings.${index}.cvss`)}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className={labelCx}>CVSS Value *</span>
                <input
                  value={finding.cvssValue}
                  onChange={(e) =>
                    updateFinding(index, "cvssValue", e.target.value)
                  }
                  placeholder="Critical / High / … or CVSS:3.1/AV:N/AC:L/…"
                  className={cx(`findings.${index}.cvssValue`)}
                />
                {fe(`findings.${index}.cvssValue`)}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className={labelCx}>Description *</span>
                  <textarea
                    rows={3}
                    value={finding.description}
                    onChange={(e) =>
                      updateFinding(index, "description", e.target.value)
                    }
                    className={`${cx(`findings.${index}.description`)} resize-y`}
                  />
                  {fe(`findings.${index}.description`)}
                </div>
                <div className="space-y-1.5">
                  <span className={labelCx}>Proof of Concept *</span>
                  <textarea
                    rows={3}
                    value={finding.poc}
                    onChange={(e) =>
                      updateFinding(index, "poc", e.target.value)
                    }
                    className={`${cx(`findings.${index}.poc`)} resize-y`}
                  />
                  {fe(`findings.${index}.poc`)}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className={labelCx}>Impact *</span>
                  <textarea
                    rows={3}
                    value={finding.impact}
                    onChange={(e) =>
                      updateFinding(index, "impact", e.target.value)
                    }
                    className={`${cx(`findings.${index}.impact`)} resize-y`}
                  />
                  {fe(`findings.${index}.impact`)}
                </div>
                <div className="space-y-1.5">
                  <span className={labelCx}>Remediation *</span>
                  <textarea
                    rows={3}
                    value={finding.remediation}
                    onChange={(e) =>
                      updateFinding(index, "remediation", e.target.value)
                    }
                    className={`${cx(`findings.${index}.remediation`)} resize-y`}
                  />
                  {fe(`findings.${index}.remediation`)}
                </div>
              </div>
            </div>
          ))}
        </section>
      </form>
    </div>
  );
}
