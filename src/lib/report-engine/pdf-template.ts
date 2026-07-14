import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";
import { ReportPayload, ReportFinding } from "@/lib/report-engine/types";
import { deriveLikelihoodImpact, Rating } from "@/lib/report-engine/cvss";
import fs from "node:fs";
import path from "node:path";

const PAGE_SIZE: [number, number] = [612, 792];
const PAGE_WIDTH = PAGE_SIZE[0];
const PAGE_HEIGHT = PAGE_SIZE[1];
const PAGE_MARGIN = 56; // outer margin (headings, titles, tables)
const BODY_X = 92; // narrative text column left
const BODY_W = PAGE_WIDTH - BODY_X * 2; // narrative text column width
const FULL_W = PAGE_WIDTH - PAGE_MARGIN * 2;
const TOP_Y = PAGE_HEIGHT - 76;
const BOTTOM_Y = 56;

// ── Palette (matched to the reference report) ──
const TEAL = rgb(0.09, 0.42, 0.34); // big section headings
const TEAL_DARK = rgb(0.03, 0.32, 0.24); // table headers
const TABLE_GREEN = rgb(0.18, 0.74, 0.52); // methodology header cells
const TEXT = rgb(0.13, 0.13, 0.13);
const GREY = rgb(0.42, 0.45, 0.5);
const BORDER = rgb(0.2, 0.2, 0.2);

const SEV_TEXT: Record<string, ReturnType<typeof rgb>> = {
  Critical: rgb(0.75, 0, 0),
  High: rgb(0.95, 0, 0),
  Medium: rgb(0.88, 0.63, 0.13),
  Low: rgb(0.17, 0.66, 0.29),
  Informational: rgb(0.18, 0.46, 0.71),
};

type Severity = "Critical" | "High" | "Medium" | "Low" | "Informational";

const SEVERITY_RANK: Record<Severity, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
  Informational: 4,
};

// ── Default narrative content (so reports look complete from CSV alone) ──
const ABOUT_PILLARS_LEAD =
  'Every finding within this document is vetted through a rigorous validation process. We don\'t just "run tools". Our methodology is built on three core pillars:';
const ABOUT_PILLARS: Array<[string, string]> = [
  [
    "Autonomous Intelligence",
    "Utilizing the latest AI models, we leverage hacking agents that think and evolve in real-time. Unlike static automated scripts or slow human testers, our AI identifies complex attack chains and multi-step vulnerabilities at machine speed, uncovering deep-seated logic flaws that legacy methods miss.",
  ],
  [
    "Industry Standards",
    "Our testing workflows are mapped to the OWASP Top 10, NIST SP 800-115, and PTES (Penetration Testing Execution Standard) frameworks.",
  ],
  [
    "Dynamic Risk Context",
    "Our AI engine analyzes your specific business logic to categorize risks based on real-world impact. We filter out the noise, making sure your remediation efforts are focused on the vulnerabilities that pose a genuine threat to your operations and data.",
  ],
];

const TOOLS_DEFAULT =
  "The AI hacker agent employs a multi-layered approach to security assessment, integrating industry-standard tools and advanced red teaming techniques. Initial reconnaissance utilizes Amass, Gau, and Katana for comprehensive attack surface mapping, while DNSRecon and ProjectDiscovery-httpx identify subdomains and active services. Vulnerability discovery focuses on web application flaws such as SQL injection, Cross-Site Scripting (XSS), and Broken Access Control, utilizing SQLmap, XSStrike, Dalfox, and JWT_tool. For API security, Schemathesis performs property-based testing against defined schemas. Infrastructure assessments leverage NetExec, SMBMap, and Enum4linux to identify misconfigurations in network services, while Kerbrute and BloodyAD facilitate Active Directory enumeration and credential-based attacks like Kerberoasting.\n\nTest cases include verifying firewall efficacy with Wafw00f, performing directory and parameter discovery via Gobuster and FFuf, and executing man-in-the-middle or coercion attacks using MITM6 and Coercer. Exploitation and post-exploitation phases involve Searchsploit for vulnerability research and MSFConsole for payload delivery, with MSFVenom generating custom shells. Privilege escalation vectors are systematically identified using LinPEAS and WinPEAS to assess local security postures.";

const METHODOLOGY: Array<[string, string]> = [
  [
    "Asset Discovery",
    "We begin by identifying assets tied to your domain through subdomain enumeration, port scanning, and OSINT techniques. Tools like Nmap, Shodan, and subdomain enumeration frameworks are used to uncover reachable systems and open ports.",
  ],
  [
    "Fingerprinting",
    "Each asset is fingerprinted to determine the underlying technologies, versions, and exposed services. This includes banner grabbing, directory bruteforcing, web crawling, and tools like Wappalyzer to identify software such as WordPress, RDP, Citrix, etc.",
  ],
  [
    "Exploitation",
    "Using the data from discovery and fingerprinting, we search for known vulnerabilities and misconfigurations. This includes CVE scanning, OWASP Top 10 testing, and automated or manual validation of weaknesses.",
  ],
  [
    "Reporting",
    "Finally, our system generates a detailed report including all findings, exploitation paths, and remediation recommendations. This report is reviewed by our certified cybersecurity analysts to ensure consistency and completeness.",
  ],
];

const SEVERITY_DESCRIPTIONS: Array<[Severity, string]> = [
  [
    "Critical",
    "Vulnerability is an otherwise high-severity issue with additional security implications that could lead to exceptional business impact.\nExamples: trivial exploit difficulty, business-critical data compromised, bypass of security controls, direct violation of communicated security objectives, and large-scale vulnerability exposure.",
  ],
  [
    "High",
    "Vulnerability may result in direct exposure including, but not limited to: the loss of application control, execution of malicious code, or compromise of underlying host systems. The issue may also create a breach in the confidentiality or integrity of sensitive business data, customer information, and administrative and user accounts. In some instances, this exposure may extend farther in the infrastructure beyond the data and systems associated with the application.",
  ],
  [
    "Medium",
    "Vulnerability does not lead directly to the exposure of critical application functionality, sensitive business and customer data, or application credentials. However, it can be executed multiple times or leveraged in conjunction with another issue to cause direct exposure. Examples include brute-forcing and client-side input validation.",
  ],
  [
    "Low",
    "Vulnerability may result in limited exposure of application control, sensitive business and customer data, or system information. This type of issue provides value only when combined with one or more issues of a higher risk classification. Examples include overly detailed error messages, the disclosure of system versioning information, and minor reliability issues.",
  ],
  [
    "Informational",
    "A security-relevant observation that does not present a direct, exploitable risk on its own but is worth noting for defense-in-depth or hardening purposes.",
  ],
];

// ── Text helpers ──
const WINANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

function sanitize(input: string): string {
  if (!input) return "";
  const s = input
    .replace(/\r\n/g, "\n")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–—―]/g, "-")
    .replace(/[→⇒➜➡➔➙]/g, "->")
    .replace(/[←⇐]/g, "<-")
    .replace(/[↑↓↔↕]/g, "|")
    .replace(/…/g, "...")
    .replace(/[     ]/g, " ")
    .replace(/[​‌‍﻿]/g, "")
    .replace(/[●■▪‣·◦]/g, "•")
    .replace(/[✓✔]/g, "[check]")
    .replace(/[✗✘❌✖]/g, "[x]");
  return Array.from(s)
    .map((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      if (ch === "\n" || ch === "\t") return ch;
      if (cp < 0x20) return " ";
      if (cp <= 0xff || WINANSI_EXTRA.has(cp)) return ch;
      return "";
    })
    .join("");
}

/** Parse a "#rrggbb" (or "#rgb") hex string to a pdf-lib rgb color. */
function hexToRgb(hex: string | undefined): ReturnType<typeof rgb> | null {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/** Darken a color toward black by `amount` (0–1) for table-header variants. */
function darken(
  color: ReturnType<typeof rgb>,
  amount: number,
): ReturnType<typeof rgb> {
  const k = 1 - amount;
  return rgb(color.red * k, color.green * k, color.blue * k);
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const out: string[] = [];
  const paragraphs = (text || "").replace(/\r\n/g, "\n").split("\n");
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        if (current) out.push(current);
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            if (font.widthOfTextAtSize(chunk + ch, size) <= maxWidth) {
              chunk += ch;
            } else {
              out.push(chunk);
              chunk = ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current) out.push(current);
  }
  return out;
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

function severityColor(severity: Severity) {
  return SEV_TEXT[severity] ?? SEV_TEXT.Informational;
}

function ratingColor(rating: Rating) {
  if (rating === "None") return GREY;
  return SEV_TEXT[rating] ?? GREY;
}

export async function buildReportPdf(payload: ReportPayload) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const now = new Date();
  const completedDate =
    payload.completedDate ?? now.toLocaleDateString("en-US");
  const coverTitle =
    payload.reportType === "webapp" ? "Web App Pentest" : "External Pentest";

  // ── Branding resolution ──
  // Default = "MSP Pentesting". A reseller's white-label object overrides the
  // company name, accent color, contact email, logo and footer.
  //
  // TODO: auto-resolve `branding` from the pentest's reseller org
  // (resellerId → orgs/{resellerId}.branding) once the org tree is wired to
  // launches. For now it is passed in via the submit/generate payload.
  const wl = payload.branding?.whiteLabelEnabled ? payload.branding : undefined;
  const brandName = wl?.companyName?.trim() || "MSP Pentesting";
  const brandTester = "MSP Hacker Agent";
  const brandEmail = wl?.emailSender?.trim() || "zack@msppentesting.com";
  const footerText = wl?.footerText?.trim() || undefined;
  const brandLogoFile = "msp pentesting logo (1) (3) (1).png";
  const brandIconFile = "msp pentesting logo (1) (3) (1).png";

  // Accent color (headings, cover text, TOC) and its darker table-header variant.
  const primary = hexToRgb(wl?.primaryColor) ?? TEAL;
  const primaryDark = wl?.primaryColor
    ? darken(primary, 0.28)
    : TEAL_DARK;

  // Brand-sensitive narrative copy.
  const aboutIntro = `Security is a fundamental right, not a corporate luxury. At ${brandName}, we specialize in providing high-impact, manual security assessments designed for organizations that require elite technical depth without the enterprise price tag. We bridge the gap between automated scanning and expensive consultancy, ensuring that your data remains yours.`;
  const purposeDefault = `This assessment was conducted to identify security issues and assess the risk and impact these vulnerabilities would have on the organization if exploited by a malicious actor.\n\n${brandName} ensured the confidentiality, integrity, & availability of the data held within the application was maintained. The discovery of the findings during this assessment did not negatively impact the application's functionality or data integrity in any way.`;
  const appendixIntro = `The ${brandName} team used the following standards to rate the findings in the report. ${brandName} derived these risk ratings from the industry and organizations such as OWASP & the Common Weakness Enumeration (CWE) ratings.`;

  // Sort findings by severity (Critical → Informational).
  const findings = [...payload.findings].sort((a, b) => {
    const sa = SEVERITY_RANK[normalizeSeverity(a.severity, a.cvss)];
    const sb = SEVERITY_RANK[normalizeSeverity(b.severity, b.cvss)];
    if (sa !== sb) return sa - sb;
    return b.cvss - a.cvss;
  });

  const embedPng = async (relPath: string): Promise<PDFImage | null> => {
    try {
      const abs = path.join(process.cwd(), "public", relPath);
      if (!fs.existsSync(abs)) return null;
      return await pdf.embedPng(new Uint8Array(fs.readFileSync(abs)));
    } catch (err) {
      console.error(`PDF: failed to embed ${relPath}:`, err);
      return null;
    }
  };
  // White-label logo: fetch the remote image and embed (PNG then JPG fallback).
  const embedRemote = async (url: string): Promise<PDFImage | null> => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      try {
        return await pdf.embedPng(bytes);
      } catch {
        return await pdf.embedJpg(bytes);
      }
    } catch (err) {
      console.error(`PDF: failed to embed remote logo ${url}:`, err);
      return null;
    }
  };

  const logo = wl?.logoUrl
    ? (await embedRemote(wl.logoUrl)) ?? (await embedPng(brandLogoFile))
    : await embedPng(brandLogoFile);
  const icon = wl?.logoUrl
    ? logo
    : await embedPng(brandIconFile);

  // ── Flow / pagination engine ──
  const state = { page: null as unknown as PDFPage, y: TOP_Y };
  const newPage = (): PDFPage => {
    state.page = pdf.addPage(PAGE_SIZE);
    state.y = TOP_Y;
    return state.page;
  };
  const ensure = (needed: number) => {
    if (state.y - needed < BOTTOM_Y) newPage();
  };
  const gap = (h: number) => {
    state.y -= h;
  };

  const centeredHeading = (text: string, size = 30) => {
    ensure(size + 24);
    const w = font.widthOfTextAtSize(text, size);
    state.page.drawText(text, {
      x: (PAGE_WIDTH - w) / 2,
      y: state.y - size,
      size,
      font,
      color: primary,
    });
    state.y -= size + 22;
  };

  const subHeading = (text: string, color = primary, size = 17) => {
    ensure(size + 10);
    state.page.drawText(text, {
      x: PAGE_MARGIN,
      y: state.y - size,
      size,
      font,
      color,
    });
    state.y -= size + 8;
  };

  const boldLabel = (text: string, size = 11.5) => {
    ensure(size + 6);
    state.page.drawText(text, {
      x: BODY_X,
      y: state.y - size,
      size,
      font: bold,
      color: BORDER,
    });
    state.y -= size + 8;
  };

  const paragraph = (
    text: string,
    opts: {
      size?: number;
      lineHeight?: number;
      font?: PDFFont;
      color?: ReturnType<typeof rgb>;
      x?: number;
      width?: number;
    } = {},
  ) => {
    const size = opts.size ?? 11;
    const lineHeight = opts.lineHeight ?? 15.5;
    const f = opts.font ?? font;
    const color = opts.color ?? TEXT;
    const x = opts.x ?? BODY_X;
    const width = opts.width ?? BODY_W;
    for (const line of wrapText(sanitize(text), f, size, width)) {
      ensure(lineHeight);
      if (line) {
        state.page.drawText(line, {
          x,
          y: state.y - size,
          size,
          font: f,
          color,
        });
      }
      state.y -= lineHeight;
    }
  };

  // Bullet with a bold lead-in label, e.g. "• Label: body…".
  const bullet = (label: string, body: string) => {
    const size = 11;
    const lineHeight = 15.5;
    const bulletX = BODY_X + 6;
    const textX = BODY_X + 20;
    const textW = BODY_W - 20;
    ensure(lineHeight);
    state.page.drawText("•", {
      x: bulletX,
      y: state.y - size,
      size,
      font: bold,
      color: primary,
    });
    // Label + body wrapped together; label rendered bold inline on first line.
    const labelText = `${label}: `;
    const labelW = bold.widthOfTextAtSize(labelText, size);
    const firstLineW = textW - labelW;
    const words = sanitize(body).split(/\s+/).filter(Boolean);
    let first = "";
    let i = 0;
    while (i < words.length) {
      const next = first ? `${first} ${words[i]}` : words[i];
      if (font.widthOfTextAtSize(next, size) <= firstLineW) {
        first = next;
        i++;
      } else break;
    }
    state.page.drawText(labelText, {
      x: textX,
      y: state.y - size,
      size,
      font: bold,
      color: TEXT,
    });
    if (first) {
      state.page.drawText(first, {
        x: textX + labelW,
        y: state.y - size,
        size,
        font,
        color: TEXT,
      });
    }
    state.y -= lineHeight;
    const rest = words.slice(i).join(" ");
    if (rest) paragraph(rest, { x: textX, width: textW, size, lineHeight });
  };

  // Rounded pill badge; returns width.
  const drawPill = (
    page: PDFPage,
    rawText: string,
    x: number,
    yBottom: number,
    fill: ReturnType<typeof rgb>,
    size = 8.5,
  ): number => {
    const text = sanitize(rawText);
    const padX = 8;
    const h = size + 8;
    const r = h / 2;
    const w = bold.widthOfTextAtSize(text, size) + padX * 2;
    page.drawCircle({ x: x + r, y: yBottom + r, size: r, color: fill });
    page.drawCircle({ x: x + w - r, y: yBottom + r, size: r, color: fill });
    page.drawRectangle({
      x: x + r,
      y: yBottom,
      width: Math.max(0, w - 2 * r),
      height: h,
      color: fill,
    });
    page.drawText(text, {
      x: x + padX,
      y: yBottom + (h - size) / 2 + 1,
      size,
      font: bold,
      color: rgb(1, 1, 1),
    });
    return w;
  };

  // Bordered, page-aware text box (Proof of Concept).
  const boxedText = (text: string) => {
    const size = 9.5;
    const lineHeight = 13;
    const padX = 10;
    const padV = 10;
    const x = PAGE_MARGIN;
    const w = FULL_W;
    const lines = wrapText(sanitize(text || "N/A"), font, size, w - padX * 2);
    let i = 0;
    while (i < lines.length) {
      ensure(size + padV * 2 + 4);
      const top = state.y;
      state.y -= padV;
      while (i < lines.length && state.y - lineHeight >= BOTTOM_Y + padV) {
        if (lines[i]) {
          state.page.drawText(lines[i], {
            x: x + padX,
            y: state.y - size,
            size,
            font,
            color: TEXT,
          });
        }
        state.y -= lineHeight;
        i++;
      }
      state.y -= padV;
      const bottom = state.y;
      const edge = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
      ) =>
        state.page.drawLine({
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
          thickness: 0.8,
          color: BORDER,
        });
      edge(x, top, x + w, top);
      edge(x, bottom, x + w, bottom);
      edge(x, top, x, bottom);
      edge(x + w, top, x + w, bottom);
      if (i < lines.length) newPage();
    }
  };

  // TOC entries collected during layout; page numbers resolved at the end.
  const toc: Array<{ label: string; ref: PDFPage; indent: number }> = [];
  const tocAdd = (label: string, ref: PDFPage, indent = 0) =>
    toc.push({ label, ref, indent });

  // ═══════════════════════════════ COVER ═══════════════════════════════
  const cover = pdf.addPage(PAGE_SIZE);
  // Soft vertical gradient tinted toward the accent color.
  const steps = 120;
  const topTint = { r: 0.95, g: 0.97, b: 0.99 };
  const midTint = {
    r: 0.5 + primary.red * 0.5,
    g: 0.5 + primary.green * 0.5,
    b: 0.5 + primary.blue * 0.5,
  };
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    // ease toward mid in the middle, lighter at the very top/bottom
    const k = 1 - Math.abs(0.5 - t) * 2 * 0.55;
    const r = topTint.r + (midTint.r - topTint.r) * k;
    const g = topTint.g + (midTint.g - topTint.g) * k;
    const b = topTint.b + (midTint.b - topTint.b) * k;
    cover.drawRectangle({
      x: 0,
      y: (PAGE_HEIGHT / steps) * i,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT / steps + 1,
      color: rgb(r, g, b),
    });
  }
  if (logo) {
    const scale = Math.min(280 / logo.width, 170 / logo.height);
    const lw = logo.width * scale;
    const lh = logo.height * scale;
    cover.drawImage(logo, {
      x: (PAGE_WIDTH - lw) / 2,
      y: PAGE_HEIGHT - 130 - lh,
      width: lw,
      height: lh,
    });
  }
  const coverCenter = (text: string, y: number, size: number, f: PDFFont) => {
    const t = sanitize(text);
    const w = f.widthOfTextAtSize(t, size);
    cover.drawText(t, {
      x: (PAGE_WIDTH - w) / 2,
      y,
      size,
      font: f,
      color: primary,
    });
  };
  coverCenter(coverTitle, PAGE_HEIGHT - 410, 24, font);
  coverCenter(
    `Penetration Test on ${payload.target || payload.projectTitle}`,
    PAGE_HEIGHT - 450,
    13,
    font,
  );
  coverCenter(`Completed ${completedDate}`, PAGE_HEIGHT - 478, 13, font);

  // ════════════════════════ METADATA + CONFIDENTIAL ════════════════════════
  const meta = pdf.addPage(PAGE_SIZE);
  {
    const cols = ["Version", "Date", "Tester", "Notes"];
    const vals = [
      payload.version ?? "1.0",
      completedDate,
      payload.tester ?? brandTester,
      payload.notes ?? `Penetration Test for ${payload.clientName}`,
    ];
    const widths = [70, 90, 120, FULL_W - 280];
    const headerH = 26;
    const x0 = PAGE_MARGIN;
    let yTop = PAGE_HEIGHT - 96;
    let cx = x0;
    // header row
    cols.forEach((c, i) => {
      meta.drawRectangle({
        x: cx,
        y: yTop - headerH,
        width: widths[i],
        height: headerH,
        color: primaryDark,
      });
      const tw = font.widthOfTextAtSize(c, 11);
      meta.drawText(c, {
        x: cx + (widths[i] - tw) / 2,
        y: yTop - 17,
        size: 11,
        font,
        color: rgb(0.95, 0.97, 0.99),
      });
      cx += widths[i];
    });
    // value row (height grows with Notes wrap)
    const noteLines = wrapText(sanitize(vals[3]), font, 10, widths[3] - 12);
    const rowH = Math.max(34, noteLines.length * 13 + 16);
    cx = x0;
    vals.forEach((v, i) => {
      meta.drawRectangle({
        x: cx,
        y: yTop - headerH - rowH,
        width: widths[i],
        height: rowH,
        color: rgb(1, 1, 1),
        borderColor: primaryDark,
        borderWidth: 0.8,
      });
      if (i === 3) {
        let ly = yTop - headerH - 16;
        noteLines.forEach((ln) => {
          meta.drawText(ln, { x: cx + 8, y: ly, size: 10, font, color: TEXT });
          ly -= 13;
        });
      } else {
        const tw = font.widthOfTextAtSize(sanitize(v), 11);
        meta.drawText(sanitize(v), {
          x: cx + (widths[i] - tw) / 2,
          y: yTop - headerH - rowH / 2 - 4,
          size: 11,
          font,
          color: TEXT,
        });
      }
      cx += widths[i];
    });

    const conf = "This report is confidential and intended solely for";
    const conf2 = "authorized recipients.";
    const cw1 = font.widthOfTextAtSize(conf, 14);
    const cw2 = font.widthOfTextAtSize(conf2, 14);
    meta.drawText(conf, {
      x: (PAGE_WIDTH - cw1) / 2,
      y: yTop - headerH - rowH - 120,
      size: 14,
      font,
      color: TEXT,
    });
    meta.drawText(conf2, {
      x: (PAGE_WIDTH - cw2) / 2,
      y: yTop - headerH - rowH - 142,
      size: 14,
      font,
      color: TEXT,
    });
  }

  // ════════════════════════ RESERVE TOC PAGE(S) ════════════════════════
  const tocCount = 14 + findings.length;
  const tocPageCount = Math.max(1, Math.ceil(tocCount / 30));
  const tocPages: PDFPage[] = [];
  for (let i = 0; i < tocPageCount; i++) tocPages.push(pdf.addPage(PAGE_SIZE));

  // ════════════════════ ABOUT + THIRD-PARTY ATTESTATION ════════════════════
  const aboutRef = newPage();
  tocAdd(`About ${brandName}`, aboutRef);
  centeredHeading(`About ${brandName}`, 30);
  gap(4);
  paragraph(aboutIntro, { size: 11, lineHeight: 16 });
  gap(8);
  paragraph(ABOUT_PILLARS_LEAD, { size: 11, lineHeight: 16 });
  gap(6);
  ABOUT_PILLARS.forEach(([l, b]) => {
    bullet(l, b);
    gap(4);
  });
  gap(8);
  // divider
  ensure(20);
  state.page.drawLine({
    start: { x: BODY_X, y: state.y },
    end: { x: PAGE_WIDTH - BODY_X, y: state.y },
    thickness: 0.8,
    color: rgb(0.7, 0.72, 0.75),
  });
  gap(18);
  const attRef = state.page;
  tocAdd("Third-Party Attestation Statement", attRef, 1);
  boldLabel("Third-Party Attestation Statement", 14);
  gap(4);
  paragraph(
    `${brandName} attests that the security assessment documented in this report was conducted using industry standard cybersecurity testing methodologies. This engagement was performed independently to identify, validate, and categorize security vulnerabilities within the defined scope.`,
    { size: 11, lineHeight: 16 },
  );
  gap(6);
  paragraph(
    `The findings herein represent a rigorous, point-in-time evaluation of the target environment's resilience against modern adversarial tactics. This statement serves as formal verification for stakeholders, partners, and regulatory bodies that ${payload.clientName} has undergone professional third-party security validation.`,
    { size: 11, lineHeight: 16 },
  );
  gap(14);
  const sigX = BODY_X + 20;
  [
    [payload.tester ?? "Zack ElMetennani", font],
    ["Security Lead", font],
    [brandEmail, font],
    [brandName, font],
  ].forEach(([line]) => {
    ensure(14);
    state.page.drawText(sanitize(line as string), {
      x: sigX,
      y: state.y - 11,
      size: 11,
      font,
      color: TEXT,
    });
    state.y -= 15;
  });
  if (icon) {
    gap(8);
    const s = Math.min(64 / icon.width, 64 / icon.height);
    ensure(icon.height * s + 8);
    state.page.drawImage(icon, {
      x: sigX,
      y: state.y - icon.height * s,
      width: icon.width * s,
      height: icon.height * s,
    });
    state.y -= icon.height * s;
  }

  // ═══════════════════════════ EXECUTIVE SUMMARY ═══════════════════════════
  const execRef = newPage();
  tocAdd("Executive Summary", execRef);
  centeredHeading("Executive Summary", 30);
  gap(6);
  paragraph(
    payload.executiveSummary ??
      `A penetration test was conducted against ${payload.target || payload.projectTitle}. This report summarizes the confirmed findings, their risk ratings, and recommended remediations prioritized by impact.`,
    { size: 11.5, lineHeight: 17 },
  );

  // ═══════════════════════════ FINDINGS SUMMARY ═══════════════════════════
  const fsRef = newPage();
  tocAdd("Findings Summary", fsRef);
  centeredHeading("Findings Summary", 30);
  gap(10);
  {
    const counts: Record<Severity, number> = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
      Informational: 0,
    };
    findings.forEach(
      (f) => counts[normalizeSeverity(f.severity, f.cvss)]++,
    );
    const order: Severity[] = [
      "Critical",
      "High",
      "Medium",
      "Low",
      "Informational",
    ];
    const colW = FULL_W / 5;
    const hH = 26;
    const rH = 26;
    ensure(hH + rH + 8);
    const yTop = state.y;
    order.forEach((sev, i) => {
      const cx = PAGE_MARGIN + i * colW;
      state.page.drawRectangle({
        x: cx,
        y: yTop - hH,
        width: colW,
        height: hH,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.8, 0.82, 0.85),
        borderWidth: 0.8,
      });
      state.page.drawText(sev, {
        x: cx + 8,
        y: yTop - 17,
        size: 10.5,
        font: bold,
        color: severityColor(sev),
      });
      state.page.drawRectangle({
        x: cx,
        y: yTop - hH - rH,
        width: colW,
        height: rH,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.8, 0.82, 0.85),
        borderWidth: 0.8,
      });
      state.page.drawText(String(counts[sev]), {
        x: cx + 8,
        y: yTop - hH - 17,
        size: 11,
        font,
        color: TEXT,
      });
    });
    state.y = yTop - hH - rH - 22;
  }
  if (payload.detailedAnalysis) {
    paragraph(payload.detailedAnalysis, { size: 11.5, lineHeight: 17 });
  }

  // ═══════════════════════════ ASSESSMENT OVERVIEW ═══════════════════════════
  const aoRef = newPage();
  tocAdd("Assessment Overview", aoRef);
  centeredHeading("Assessment Overview", 30);
  gap(4);
  tocAdd("Purpose", state.page, 1);
  subHeading("Purpose");
  paragraph(payload.purpose ?? purposeDefault, { size: 11, lineHeight: 16 });
  gap(12);
  tocAdd("Scope", state.page, 1);
  subHeading("Scope");
  paragraph("The following targets were included in the scope of the penetration test:", {
    size: 11,
    lineHeight: 16,
  });
  gap(2);
  const scopeTargets = payload.scopeTargets?.length
    ? payload.scopeTargets
    : payload.target
      ? [payload.target]
      : ["Not provided"];
  scopeTargets.forEach((t) =>
    paragraph(`-    ${t}`, { x: BODY_X + 20, width: BODY_W - 20, size: 11, lineHeight: 16 }),
  );
  gap(12);
  tocAdd("Tools and Test Cases", state.page, 1);
  subHeading("Tools and Test Cases");
  paragraph(TOOLS_DEFAULT, { size: 11, lineHeight: 16 });

  // ═══════════════════════════════ METHODOLOGY ═══════════════════════════════
  const methRef = newPage();
  tocAdd("Methodology", methRef);
  centeredHeading("Methodology", 30);
  gap(10);
  {
    const colW = FULL_W / 2;
    const cells = METHODOLOGY; // [Asset Discovery, Fingerprinting, Exploitation, Reporting]
    for (let row = 0; row < 2; row++) {
      const left = cells[row * 2];
      const right = cells[row * 2 + 1];
      const headerH = 30;
      const leftLines = wrapText(sanitize(left[1]), font, 10.5, colW - 24);
      const rightLines = wrapText(sanitize(right[1]), font, 10.5, colW - 24);
      const bodyH = Math.max(leftLines.length, rightLines.length) * 14 + 24;
      ensure(headerH + bodyH + 6);
      const yTop = state.y;
      [left, right].forEach((c, ci) => {
        const cx = PAGE_MARGIN + ci * colW;
        // header
        state.page.drawRectangle({
          x: cx,
          y: yTop - headerH,
          width: colW,
          height: headerH,
          color: TABLE_GREEN,
          borderColor: rgb(0.1, 0.1, 0.1),
          borderWidth: 1,
        });
        const tw = font.widthOfTextAtSize(c[0], 13);
        state.page.drawText(c[0], {
          x: cx + (colW - tw) / 2,
          y: yTop - 20,
          size: 13,
          font,
          color: rgb(0.06, 0.18, 0.12),
        });
        // body
        state.page.drawRectangle({
          x: cx,
          y: yTop - headerH - bodyH,
          width: colW,
          height: bodyH,
          color: rgb(1, 1, 1),
          borderColor: rgb(0.1, 0.1, 0.1),
          borderWidth: 1,
        });
        let ly = yTop - headerH - 18;
        (ci === 0 ? leftLines : rightLines).forEach((ln) => {
          state.page.drawText(ln, {
            x: cx + 12,
            y: ly,
            size: 10.5,
            font,
            color: TEXT,
          });
          ly -= 14;
        });
      });
      state.y = yTop - headerH - bodyH;
    }
  }

  // ═══════════════════════════ TECHNICAL FINDINGS ═══════════════════════════
  const tfRef = newPage();
  tocAdd("Technical Findings", tfRef);
  centeredHeading("Technical Findings", 30);
  gap(6);

  findings.forEach((finding: ReportFinding, index: number) => {
    const sev = normalizeSeverity(finding.severity, finding.cvss);
    // Prefer the CVSS 4.0 vector (falls back to 3.1) for both the displayed
    // vector and the derived Likelihood/Impact ratings.
    const cvssVector = finding.cvss40Vector || finding.cvss31Vector;
    const { likelihood, impact } = deriveLikelihoodImpact(cvssVector);
    const num = `01-${String(index + 1).padStart(2, "0")}-`;

    ensure(130);
    if (index > 0) {
      state.page.drawLine({
        start: { x: PAGE_MARGIN, y: state.y },
        end: { x: PAGE_WIDTH - PAGE_MARGIN, y: state.y },
        thickness: 0.8,
        color: rgb(0.85, 0.87, 0.9),
      });
      gap(16);
    }
    const startRef = state.page;
    tocAdd(`${num}${finding.title}`, startRef, 1);

    // Severity + Likelihood + Impact pills (above the title).
    const pillH = 17;
    ensure(pillH + 10);
    let px = PAGE_MARGIN;
    px += drawPill(state.page, sev, px, state.y - pillH, severityColor(sev), 9) + 8;
    if (likelihood)
      px +=
        drawPill(
          state.page,
          `Likelihood: ${likelihood}`,
          px,
          state.y - pillH,
          ratingColor(likelihood),
        ) + 8;
    if (impact)
      drawPill(
        state.page,
        `Impact: ${impact}`,
        px,
        state.y - pillH,
        ratingColor(impact),
      );
    state.y -= pillH + 10;

    // Title.
    paragraph(`${num}${finding.title}`, {
      x: PAGE_MARGIN,
      width: FULL_W,
      size: 16,
      lineHeight: 21,
      font: bold,
      color: BORDER,
    });
    gap(8);

    boldLabel("Finding Description:");
    paragraph(finding.description, { size: 11, lineHeight: 16 });
    gap(8);

    // Severity line + CVSS vector (reference style).
    ensure(34);
    state.page.drawText("Severity: ", {
      x: BODY_X,
      y: state.y - 11,
      size: 11,
      font: bold,
      color: BORDER,
    });
    const sw = bold.widthOfTextAtSize("Severity: ", 11);
    state.page.drawText(sev, {
      x: BODY_X + sw,
      y: state.y - 11,
      size: 11,
      font: bold,
      color: severityColor(sev),
    });
    state.y -= 15;
    if (cvssVector) {
      paragraph(cvssVector, {
        x: BODY_X,
        width: BODY_W,
        size: 10,
        lineHeight: 13,
        font: bold,
        color: BORDER,
      });
    }
    gap(8);

    if (finding.impact) {
      boldLabel("Impact:");
      paragraph(finding.impact, { size: 11, lineHeight: 16 });
      gap(8);
    }

    boldLabel("Proof of Concept:");
    boxedText(finding.poc);
    gap(10);

    boldLabel("Remediation Recommendations:");
    paragraph(finding.remediation, { size: 11, lineHeight: 16 });
    gap(14);
  });

  // ════════════════════════════════ APPENDIX ════════════════════════════════
  const apxRef = newPage();
  tocAdd("Appendix", apxRef);
  centeredHeading("Appendix", 30);
  gap(4);
  paragraph(appendixIntro, { size: 11, lineHeight: 16 });
  gap(10);
  tocAdd("Severity Descriptions", state.page, 1);
  subHeading("Severity Descriptions", primary, 22);
  paragraph(
    "The severity of each finding in this report is independent. Finding severity ratings combine direct technical and business impact with the worst-case scenario in an attack chain. The more significant the impact, and the fewer vulnerabilities that must be exploited to achieve that impact, the higher the severity.",
    { size: 11, lineHeight: 16 },
  );
  gap(8);
  SEVERITY_DESCRIPTIONS.forEach(([sev, desc]) => {
    subHeading(sev, severityColor(sev), 15);
    paragraph(desc, { size: 11, lineHeight: 16 });
    gap(8);
  });

  // ════════════════════════════════ RISK MATRIX ════════════════════════════════
  const rmRef = newPage();
  tocAdd("Risk Matrix", rmRef, 1);
  centeredHeading("Risk Matrix", 30);
  gap(10);
  {
    const impactCols = ["Insignificant", "Minor", "Moderate", "Major", "Critical"];
    const rows: Array<[string, string[]]> = [
      ["Almost Certain", ["High", "High", "Critical", "Critical", "Critical"]],
      ["Likely", ["Moderate", "High", "High", "Critical", "Critical"]],
      ["Moderate", ["Low", "Moderate", "High", "Critical", "Critical"]],
      ["Unlikely", ["Low", "Low", "Moderate", "High", "Critical"]],
      ["Rare", ["Low", "Low", "Moderate", "High", "High"]],
    ];
    const firstW = 116;
    const cellW = (FULL_W - firstW) / 5;
    const rH = 26;
    const cellFill: Record<string, ReturnType<typeof rgb>> = {
      Low: rgb(0.3, 0.69, 0.31),
      Moderate: rgb(0.95, 0.76, 0.2),
      High: rgb(0.9, 0.1, 0.1),
      Critical: rgb(0.04, 0.36, 0.28),
    };
    const cellTextColor = (v: string) =>
      v === "Moderate" ? rgb(0.15, 0.12, 0) : rgb(1, 1, 1);
    let yTop = state.y;
    const x0 = PAGE_MARGIN;
    const center = (
      p: PDFPage,
      t: string,
      cx: number,
      cw: number,
      cy: number,
      f: PDFFont,
      size: number,
      color: ReturnType<typeof rgb>,
    ) => {
      const tw = f.widthOfTextAtSize(t, size);
      p.drawText(t, { x: cx + (cw - tw) / 2, y: cy, size, font: f, color });
    };
    // Top header: corner blank + "Impact" spanning the 5 impact cols
    state.page.drawRectangle({
      x: x0,
      y: yTop - rH,
      width: firstW,
      height: rH,
      color: primaryDark,
    });
    state.page.drawRectangle({
      x: x0 + firstW,
      y: yTop - rH,
      width: cellW * 5,
      height: rH,
      color: primaryDark,
    });
    center(state.page, "Impact", x0 + firstW, cellW * 5, yTop - 17, font, 11, rgb(0.95, 0.97, 0.99));
    yTop -= rH;
    // Second header: "Likelihood" corner + impact column labels
    state.page.drawRectangle({
      x: x0,
      y: yTop - rH,
      width: firstW,
      height: rH,
      color: primaryDark,
    });
    center(state.page, "Likelihood", x0, firstW, yTop - 17, font, 10.5, rgb(0.85, 0.92, 0.98));
    impactCols.forEach((c, i) => {
      const cx = x0 + firstW + i * cellW;
      state.page.drawRectangle({
        x: cx,
        y: yTop - rH,
        width: cellW,
        height: rH,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.1, 0.1, 0.1),
        borderWidth: 0.8,
      });
      center(state.page, c, cx, cellW, yTop - 17, font, 9.5, TEXT);
    });
    yTop -= rH;
    // Data rows
    rows.forEach(([likelihoodLabel, vals]) => {
      state.page.drawRectangle({
        x: x0,
        y: yTop - rH,
        width: firstW,
        height: rH,
        color: rgb(0.95, 0.96, 0.97),
        borderColor: rgb(0.1, 0.1, 0.1),
        borderWidth: 0.8,
      });
      center(state.page, likelihoodLabel, x0, firstW, yTop - 17, font, 9.5, TEXT);
      vals.forEach((v, i) => {
        const cx = x0 + firstW + i * cellW;
        state.page.drawRectangle({
          x: cx,
          y: yTop - rH,
          width: cellW,
          height: rH,
          color: cellFill[v] ?? rgb(1, 1, 1),
          borderColor: rgb(0.1, 0.1, 0.1),
          borderWidth: 0.8,
        });
        center(state.page, v, cx, cellW, yTop - 17, font, 9.5, cellTextColor(v));
      });
      yTop -= rH;
    });
  }

  // ════════════════ TABLE OF CONTENTS (fill reserved pages) ════════════════
  // Prepend TOC self-reference so it lists itself like the reference.
  const allPages = pdf.getPages();
  const pageNumberOf = (ref: PDFPage) => allPages.indexOf(ref) + 1;
  {
    const entries = [
      { label: "Table of Contents", ref: tocPages[0], indent: 0 },
      ...toc,
    ];
    let idx = 0;
    let ty = TOP_Y;
    const drawTitle = () => {
      const t = "Table of Contents";
      const w = font.widthOfTextAtSize(t, 30);
      tocPages[idx].drawText(t, {
        x: (PAGE_WIDTH - w) / 2,
        y: ty - 30,
        size: 30,
        font,
        color: primary,
      });
      ty -= 30 + 28;
    };
    drawTitle();
    for (const e of entries) {
      if (ty - 18 < BOTTOM_Y && idx < tocPages.length - 1) {
        idx++;
        ty = TOP_Y;
      }
      const tp = tocPages[idx];
      const lx = PAGE_MARGIN + e.indent * 22;
      const size = 11;
      let labelTxt = sanitize(e.label);
      const numTxt = String(pageNumberOf(e.ref));
      const numW = bold.widthOfTextAtSize(numTxt, size);
      const numX = PAGE_WIDTH - PAGE_MARGIN - numW;
      // truncate label if it would collide with dotted leader area
      const maxLabelW = numX - lx - 24;
      while (
        bold.widthOfTextAtSize(labelTxt, size) > maxLabelW &&
        labelTxt.length > 4
      ) {
        labelTxt = labelTxt.slice(0, -2);
      }
      tp.drawText(labelTxt, {
        x: lx,
        y: ty - 11,
        size,
        font: bold,
        color: rgb(0.1, 0.1, 0.1),
      });
      // dotted leader
      const labelEnd = lx + bold.widthOfTextAtSize(labelTxt, size) + 4;
      const dotsW = numX - 4 - labelEnd;
      if (dotsW > 6) {
        const dot = ".";
        const dw = font.widthOfTextAtSize(dot, size);
        const count = Math.floor(dotsW / dw);
        tp.drawText(dot.repeat(count), {
          x: labelEnd,
          y: ty - 11,
          size,
          font,
          color: rgb(0.4, 0.42, 0.45),
        });
      }
      tp.drawText(numTxt, {
        x: numX,
        y: ty - 11,
        size,
        font: bold,
        color: rgb(0.1, 0.1, 0.1),
      });
      ty -= 18;
    }
  }

  // ════════════════════════════ PAGE NUMBERS + FOOTER ════════════════════════
  pdf.getPages().forEach((p, i) => {
    const n = String(i + 1);
    p.drawText(n, {
      x: PAGE_WIDTH - PAGE_MARGIN - bold.widthOfTextAtSize(n, 11),
      y: 30,
      size: 11,
      font: bold,
      color: rgb(0.1, 0.1, 0.1),
    });
    // White-label footer text, bottom-left, truncated to fit.
    if (footerText) {
      let ft = sanitize(footerText);
      const maxW = PAGE_WIDTH - PAGE_MARGIN * 2 - 24;
      while (font.widthOfTextAtSize(ft, 8) > maxW && ft.length > 4) {
        ft = ft.slice(0, -2);
      }
      p.drawText(ft, {
        x: PAGE_MARGIN,
        y: 30,
        size: 8,
        font,
        color: GREY,
      });
    }
  });

  return pdf.save();
}
