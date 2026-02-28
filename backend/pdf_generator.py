"""
PDF Generator with MSP Pentesting Branding
"""

from weasyprint import HTML, CSS
from jinja2 import Template
from datetime import datetime

def generate_pdf_report(pentest_id, target_url, pentest_type, vulnerabilities, executive_summary, full_report, output_path):
    """
    Generate branded PDF report from pentest results
    """
    
    # HTML template with MSP branding
    html_template = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page {
            size: A4;
            margin: 2cm;
            @top-center {
                content: "MSP Pentesting - Confidential Report";
                font-family: 'Chakra Petch', sans-serif;
                font-size: 10pt;
                color: #666;
            }
            @bottom-center {
                content: "Page " counter(page) " of " counter(pages);
                font-family: 'Chakra Petch', sans-serif;
                font-size: 10pt;
                color: #666;
            }
        }
        
        body {
            font-family: 'Chakra Petch', sans-serif;
            color: #0a141f;
            line-height: 1.6;
        }
        
        .header {
            background: linear-gradient(135deg, #0a141f 0%, #1a2f3f 100%);
            color: white;
            padding: 40px;
            text-align: center;
            margin: -2cm -2cm 2cm -2cm;
        }
        
        .logo {
            font-size: 32pt;
            font-weight: bold;
            margin-bottom: 10px;
            letter-spacing: 2px;
        }
        
        .tagline {
            font-size: 14pt;
            color: #4590e2;
            margin-bottom: 20px;
        }
        
        .report-meta {
            background: #f8f9fa;
            padding: 20px;
            border-left: 4px solid #4590e2;
            margin: 20px 0;
        }
        
        .report-meta table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .report-meta td {
            padding: 8px;
            border-bottom: 1px solid #dee2e6;
        }
        
        .report-meta td:first-child {
            font-weight: bold;
            width: 30%;
        }
        
        h1 {
            color: #0a141f;
            font-size: 24pt;
            border-bottom: 3px solid #4590e2;
            padding-bottom: 10px;
            margin-top: 30px;
        }
        
        h2 {
            color: #0a141f;
            font-size: 18pt;
            margin-top: 25px;
            border-left: 4px solid #4590e2;
            padding-left: 15px;
        }
        
        h3 {
            color: #4590e2;
            font-size: 14pt;
            margin-top: 20px;
        }
        
        .executive-summary {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 20px;
            margin: 20px 0;
        }
        
        .vulnerability {
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            page-break-inside: avoid;
        }
        
        .vulnerability.critical {
            border-left: 6px solid #dc3545;
        }
        
        .vulnerability.high {
            border-left: 6px solid #fd7e14;
        }
        
        .vulnerability.medium {
            border-left: 6px solid #ffc107;
        }
        
        .vulnerability.low {
            border-left: 6px solid #20c997;
        }
        
        .vulnerability.info {
            border-left: 6px solid #0dcaf0;
        }
        
        .severity-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            color: white;
            font-weight: bold;
            font-size: 11pt;
            text-transform: uppercase;
        }
        
        .severity-badge.critical { background: #dc3545; }
        .severity-badge.high { background: #fd7e14; }
        .severity-badge.medium { background: #ffc107; color: #000; }
        .severity-badge.low { background: #20c997; }
        .severity-badge.info { background: #0dcaf0; }
        
        .vuln-meta {
            color: #666;
            font-size: 10pt;
            margin: 10px 0;
        }
        
        .remediation {
            background: #d1ecf1;
            border-left: 4px solid #0dcaf0;
            padding: 15px;
            margin: 15px 0;
        }
        
        .code-block {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            padding: 15px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 9pt;
            overflow-wrap: break-word;
        }
        
        .footer {
            text-align: center;
            color: #666;
            font-size: 10pt;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
        }
        
        .disclaimer {
            background: #f8f9fa;
            padding: 15px;
            margin: 20px 0;
            font-size: 9pt;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">MSP PENTESTING</div>
        <div class="tagline">AI-Powered Penetration Testing</div>
    </div>
    
    <h1>Penetration Test Report</h1>
    
    <div class="report-meta">
        <table>
            <tr>
                <td>Report ID:</td>
                <td>{{ pentest_id }}</td>
            </tr>
            <tr>
                <td>Target:</td>
                <td>{{ target_url }}</td>
            </tr>
            <tr>
                <td>Test Type:</td>
                <td>{{ pentest_type_display }}</td>
            </tr>
            <tr>
                <td>Date Generated:</td>
                <td>{{ date_generated }}</td>
            </tr>
            <tr>
                <td>Findings:</td>
                <td><strong>{{ vulnerabilities|length }} vulnerabilities found</strong></td>
            </tr>
        </table>
    </div>
    
    {% if executive_summary %}
    <h2>Executive Summary</h2>
    <div class="executive-summary">
        {{ executive_summary }}
    </div>
    {% endif %}
    
    <h2>Vulnerability Findings</h2>
    
    {% for vuln in vulnerabilities %}
    <div class="vulnerability {{ vuln.severity }}">
        <h3>{{ loop.index }}. {{ vuln.title }}</h3>
        <div>
            <span class="severity-badge {{ vuln.severity }}">{{ vuln.severity }}</span>
            {% if vuln.cvss %}
            <span class="vuln-meta">CVSS Score: {{ vuln.cvss }}</span>
            {% endif %}
            {% if vuln.cve %}
            <span class="vuln-meta">{{ vuln.cve }}</span>
            {% endif %}
        </div>
        
        {% if vuln.affectedEndpoint %}
        <div class="vuln-meta">
            <strong>Affected:</strong> {{ vuln.affectedEndpoint }}
        </div>
        {% endif %}
        
        <p><strong>Description:</strong></p>
        <p>{{ vuln.description }}</p>
        
        {% if vuln.remediation %}
        <div class="remediation">
            <strong>🔧 Remediation:</strong><br>
            {{ vuln.remediation }}
        </div>
        {% endif %}
    </div>
    {% endfor %}
    
    {% if not vulnerabilities %}
    <p style="text-align: center; padding: 40px; color: #666;">
        ✅ No critical vulnerabilities identified during this assessment.
    </p>
    {% endif %}
    
    <h2>Detailed Analysis</h2>
    <div class="code-block">
        {{ full_report }}
    </div>
    
    <div class="disclaimer">
        <strong>Disclaimer:</strong> This penetration test report is provided for informational purposes only. 
        The findings represent potential security vulnerabilities identified at the time of testing. 
        MSP Pentesting is not responsible for any actions taken based on this report. 
        Always consult with qualified security professionals before implementing changes.
    </div>
    
    <div class="footer">
        <p><strong>MSP Pentesting</strong> | AI-Powered Security Testing</p>
        <p>© 2026 MSP Pentesting. All rights reserved. | Confidential Report</p>
    </div>
</body>
</html>
    """
    
    # Render template
    template = Template(html_template)
    html_content = template.render(
        pentest_id=pentest_id,
        target_url=target_url,
        pentest_type_display="Web Application Pentest" if pentest_type == "web_app" else "External IP Scan",
        date_generated=datetime.now().strftime("%B %d, %Y at %I:%M %p UTC"),
        vulnerabilities=vulnerabilities,
        executive_summary=executive_summary,
        full_report=full_report
    )
    
    # Generate PDF
    HTML(string=html_content).write_pdf(output_path)
    print(f"✅ PDF report generated: {output_path}")
