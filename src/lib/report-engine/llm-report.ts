import type { ReportFinding } from "@/lib/report-engine/types";

interface LlmReportSections {
  executiveSummary: string;
  findingsSummary: string;
  toolsAndTestCases: string;
}

function buildPrompt(findings: ReportFinding[], target: string): string {
  const findingsBlock = findings
    .map(
      (f, i) =>
        `${i + 1}. [${f.severity}] ${f.title} (CVSS ${f.cvss})
   Description: ${f.description}
   Impact: ${f.impact}
   Remediation: ${f.remediation}`,
    )
    .join("\n\n");

  return `You are a professional cybersecurity report writer. Given the following penetration test findings against ${target}, produce three distinct sections for the report.

Findings:
${findingsBlock || "No vulnerabilities were identified during testing."}

Output exactly in this JSON format (no markdown, no code fences):
{
  "executiveSummary": "A single paragraph of 5-7 sentences written for a C-level audience. Describe the overall security posture, the number and severity of findings, and the key risk to the business. Be specific about what was tested and the overall security rating.",
  "findingsSummary": "A single paragraph of 5-7 sentences summarizing the overall findings. Categorize by severity, highlight the most critical issues, and note any patterns or common vulnerability classes discovered during testing.",
  "toolsAndTestCases": "A single paragraph describing the tools, techniques, and test cases used during the assessment. Infer specific tool categories and test types from the findings themselves (e.g. if findings mention SQL injection, include SQLmap; if XSS, include XSStrike; if JWT issues, include JWT_tool). Mention reconnaissance, scanning, exploitation, and post-exploitation phases with concrete tool names relevant to what was actually found."
}`;
}

export async function generateReportSections(
  findings: ReportFinding[],
  target: string,
): Promise<LlmReportSections> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const fallback = buildFallbackSections(findings, target);
    return fallback;
  }

  const prompt = buildPrompt(findings, target);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2048,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.error("Groq API error:", res.status, await res.text());
      return buildFallbackSections(findings, target);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return buildFallbackSections(findings, target);
    }

    const parsed = JSON.parse(content) as LlmReportSections;
    return {
      executiveSummary:
        parsed.executiveSummary ||
        buildFallbackSections(findings, target).executiveSummary,
      findingsSummary:
        parsed.findingsSummary ||
        buildFallbackSections(findings, target).findingsSummary,
      toolsAndTestCases:
        parsed.toolsAndTestCases ||
        buildFallbackSections(findings, target).toolsAndTestCases,
    };
  } catch (err) {
    console.error("Groq LLM call failed:", err);
    return buildFallbackSections(findings, target);
  }
}

function buildFallbackSections(
  findings: ReportFinding[],
  target: string,
): LlmReportSections {
  const total = findings.length;
  const critical = findings.filter((f) => f.severity === "Critical").length;
  const high = findings.filter((f) => f.severity === "High").length;
  const medium = findings.filter((f) => f.severity === "Medium").length;
  const low = findings.filter((f) => f.severity === "Low").length;

  const sevList = [
    critical > 0 ? `${critical} critical` : "",
    high > 0 ? `${high} high` : "",
    medium > 0 ? `${medium} medium` : "",
    low > 0 ? `${low} low` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const hasInjection = findings.some(
    (f) =>
      f.title?.toLowerCase().includes("injection") ||
      f.description?.toLowerCase().includes("injection"),
  );
  const hasXss = findings.some(
    (f) =>
      f.title?.toLowerCase().includes("xss") ||
      f.title?.toLowerCase().includes("cross-site") ||
      f.description?.toLowerCase().includes("xss") ||
      f.description?.toLowerCase().includes("cross-site scripting"),
  );
  const hasAuth = findings.some(
    (f) =>
      f.title?.toLowerCase().includes("authentication") ||
      f.title?.toLowerCase().includes("authorization") ||
      f.title?.toLowerCase().includes("idor") ||
      f.title?.toLowerCase().includes("privilege") ||
      f.title?.toLowerCase().includes("jwt"),
  );
  const hasSensitiveData = findings.some(
    (f) =>
      f.title?.toLowerCase().includes("expos") ||
      f.title?.toLowerCase().includes("information disclosure") ||
      f.title?.toLowerCase().includes("leak") ||
      f.title?.toLowerCase().includes("hash") ||
      f.title?.toLowerCase().includes("ftp") ||
      f.title?.toLowerCase().includes("encryption key"),
  );
  const hasSsrf = findings.some(
    (f) =>
      f.title?.toLowerCase().includes("ssrf") ||
      f.title?.toLowerCase().includes("server-side request forgery"),
  );

  const toolParts: string[] = [
    "The assessment began with reconnaissance and attack surface mapping using tools such as Amass, Subfinder, and Katana for subdomain enumeration, along with Nmap and httpx for service discovery and fingerprinting.",
  ];
  if (hasInjection)
    toolParts.push(
      "SQL injection testing was performed using SQLmap with various tamper scripts and manual payload crafting to extract data and bypass filters.",
    );
  if (hasXss)
    toolParts.push(
      "Cross-Site Scripting (XSS) detection was carried out using XSStrike, Dalfox, and manual DOM manipulation to identify stored and reflected vectors.",
    );
  if (hasAuth)
    toolParts.push(
      "Authentication and authorization controls were tested using JWT_tool for token manipulation, along with manual privilege escalation attempts and IDOR testing via parameter fuzzing.",
    );
  if (hasSensitiveData)
    toolParts.push(
      "Information disclosure testing involved directory enumeration with Gobuster and Feroxbuster, along with inspection of exposed endpoints, FTP services, and publicly accessible configuration files.",
    );
  if (hasSsrf)
    toolParts.push(
      "Server-Side Request Forgery (SSRF) testing was conducted using custom payloads delivered through Collaborator-based out-of-band detection and SSRFmap for automated testing.",
    );
  toolParts.push(
    "All findings were validated through manual proof-of-concept exploitation, and remediation guidance was provided based on industry best practices including OWASP and NIST guidelines.",
  );

  return {
    executiveSummary: `A penetration test was conducted against ${target}, encompassing a comprehensive evaluation of the target's security posture through automated and manual testing methodologies. The assessment identified ${total === 0 ? "no security vulnerabilities" : `a total of ${total} security vulnerabilities across multiple risk categories${sevList ? `, including ${sevList}` : ""} severity findings`}. ${critical > 0 ? `The ${critical} critical-risk vulnerabilities pose an immediate and significant threat to the confidentiality, integrity, and availability of the target systems, requiring urgent remediation. ` : ""}${high > 0 ? `${high} high-risk issues were identified that could lead to data compromise or unauthorized system access if exploited. ` : ""}${total > 0 ? "Each finding in this report includes a detailed technical description, proof of concept, and prioritized remediation recommendations to guide the remediation process." : "No exploitable security weaknesses were identified during the assessment."} This report provides a roadmap for strengthening the overall security posture and reducing organizational risk.`,

    findingsSummary: `The assessment against ${target} yielded ${total === 0 ? "no security findings, indicating a strong security posture within the tested scope" : `${total} distinct security findings that have been categorized and prioritized for remediation`}. ${critical > 0 ? `The ${critical} critical-severity findings represent the most urgent risks, including vulnerabilities that could allow complete system compromise or unauthorized access to sensitive data. ` : ""}${high > 0 ? `The ${high} high-severity findings involve significant security weaknesses that could lead to data exposure, privilege escalation, or service disruption. ` : ""}${medium > 0 ? `${medium} medium-severity findings were identified, including information disclosure risks and security misconfigurations that should be addressed as part of a regular remediation cycle. ` : ""}${low > 0 ? `${low} low-severity findings are noted for defense-in-depth and hardening purposes. ` : ""}${hasInjection && hasXss ? "A notable pattern in the findings is the prevalence of input validation vulnerabilities, suggesting that additional security controls around user-supplied data would significantly reduce the overall risk profile. " : ""}${hasAuth ? "Several authentication and authorization weaknesses were identified, indicating opportunities to strengthen access control mechanisms. " : ""}${total > 0 ? "The remediation section of each finding provides step-by-step guidance to address the identified issues effectively." : ""}`,

    toolsAndTestCases: toolParts.join(" "),
  };
}
