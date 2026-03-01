"""
Worker module - Executes pentests using Claude Agent
"""

import os
import json
import requests
import anthropic
import threading
from datetime import datetime
from pdf_generator import generate_pdf_report
from google.cloud import storage

# Initialize Anthropic client
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')
client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# GCS setup
GCS_BUCKET_NAME = os.environ.get('GCS_BUCKET_NAME', 'msp-pentest-reports')

# Timeout settings (2 hours = 7200 seconds)
PENTEST_TIMEOUT = 7200

class TimeoutError(Exception):
    """Raised when pentest exceeds timeout"""
    pass

# Global flag to track if timeout occurred
timeout_occurred = threading.Event()

def execute_pentest(pentest_id, user_id, pentest_type, target_url, user_roles, endpoints, additional_context, webhook_secret, webapp_api_url):
    """
    Main worker function - executes pentest and sends results back to webapp
    Max runtime: 2 hours (7200 seconds)
    Note: This is called from a background thread, so we use threading instead of signal
    """
    print(f"🚀 Starting pentest {pentest_id} for {target_url}")
    print(f"⏱️  Timeout set to 2 hours (7200 seconds)")
    
    start_time = datetime.now()
    
    # Create a timer to set timeout flag after 2 hours
    def set_timeout():
        timeout_occurred.set()
        print(f"⏱️ Timeout flag set after 2 hours for pentest {pentest_id}")
    
    timeout_timer = threading.Timer(PENTEST_TIMEOUT, set_timeout)
    timeout_timer.daemon = True
    timeout_timer.start()
    
    try:
        # Check if timeout occurred before starting
        if timeout_occurred.is_set():
            raise TimeoutError("Pentest exceeded 2 hour time limit")
            
        # Build system prompt based on type
        system_prompt = build_system_prompt(pentest_type, target_url, user_roles, endpoints, additional_context)
        
        # Check timeout again
        if timeout_occurred.is_set():
            raise TimeoutError("Pentest exceeded 2 hour time limit")
        
        # Call Claude API
        print(f"🤖 Calling Claude Sonnet 4 for pentest analysis...")
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=16000,
            system=system_prompt,
            messages=[{
                "role": "user",
                "content": f"Please perform a comprehensive penetration test on {target_url}. Provide your findings in JSON format."
            }]
        )
        
        # Check timeout
        if timeout_occurred.is_set():
            raise TimeoutError("Pentest exceeded 2 hour time limit")
        
        # Extract response
        response_text = response.content[0].text
        print(f"✅ Claude analysis complete ({len(response_text)} chars)")
        
        # Parse JSON response
        pentest_results = parse_claude_response(response_text)
        
        # Check timeout
        if timeout_occurred.is_set():
            raise TimeoutError("Pentest exceeded 2 hour time limit")
        
        # Generate branded PDF report
        print(f"📄 Generating PDF report...")
        pdf_path = f"/tmp/{pentest_id}.pdf"
        generate_pdf_report(
            pentest_id=pentest_id,
            target_url=target_url,
            pentest_type=pentest_type,
            vulnerabilities=pentest_results.get('vulnerabilities', []),
            executive_summary=pentest_results.get('executiveSummary', ''),
            full_report=pentest_results.get('report', ''),
            output_path=pdf_path
        )
        
        # Upload PDF to Cloud Storage
        print(f"☁️  Uploading PDF to Cloud Storage...")
        pdf_url = upload_to_gcs(pdf_path, pentest_id)
        
        # Send results back to webapp
        print(f"📤 Sending results to webapp...")
        send_results_to_webapp(
            pentest_id=pentest_id,
            status='completed',
            results={
                'report': pentest_results.get('report', ''),
                'executiveSummary': pentest_results.get('executiveSummary', ''),
                'findings': len(pentest_results.get('vulnerabilities', [])),
                'pdfUrl': pdf_url
            },
            vulnerabilities=pentest_results.get('vulnerabilities', []),
            webhook_secret=webhook_secret,
            webapp_api_url=webapp_api_url
        )
        
        timeout_timer.cancel()  # Cancel timer if we completed successfully
        print(f"✅ Pentest {pentest_id} completed successfully!")
        
    except TimeoutError as e:
        timeout_timer.cancel()
        print(f"⏱️  Pentest {pentest_id} timed out after 2 hours")
        # Send timeout error back to webapp
        send_results_to_webapp(
            pentest_id=pentest_id,
            status='failed',
            results=None,
            vulnerabilities=[],
            error="Pentest exceeded 2 hour time limit. Results may be incomplete.",
            webhook_secret=webhook_secret,
            webapp_api_url=webapp_api_url
        )
    except Exception as e:
        timeout_timer.cancel()
        print(f"❌ Error executing pentest {pentest_id}: {str(e)}")
        # Send error back to webapp
        send_results_to_webapp(
            pentest_id=pentest_id,
            status='failed',
            results=None,
            vulnerabilities=[],
            error=str(e),
            webhook_secret=webhook_secret,
            webapp_api_url=webapp_api_url
        )
    finally:
        # Cleanup - timeout_timer is already cancelled in success/error blocks
        pass

def build_system_prompt(pentest_type, target_url, user_roles, endpoints, additional_context):
    """
    Build Claude system prompt based on pentest type
    Includes available Kali Linux tools
    """
    base_prompt = f"""You are an expert penetration tester with access to a full Kali Linux suite of tools.

TARGET: {target_url}
TYPE: {pentest_type}
TIMEOUT: 2 hours maximum

AVAILABLE TOOLS (Kali Linux):
- nmap: Network scanning and service detection
- sqlmap: SQL injection testing
- nikto: Web server vulnerability scanning
- gobuster/dirb: Directory and file brute-forcing
- hydra: Password cracking
- nuclei: Template-based vulnerability scanning
- ffuf: Web fuzzing
- wpscan: WordPress security scanner
- burpsuite: Web application testing
- zaproxy: OWASP ZAP proxy
- metasploit: Exploitation framework
- netcat: Network connections
- tcpdump/wireshark: Network analysis
- john/hashcat: Password cracking

You can execute these tools directly. Be thorough but efficient given the 2-hour time limit.
"""
    
    if pentest_type == 'web_app':
        base_prompt += f"""
USER ROLES: {user_roles or 'N/A'}
API ENDPOINTS: {endpoints or 'N/A'}

SCOPE:
- Test up to 3 user roles for privilege escalation
- Assess up to 10 API endpoints for vulnerabilities
- Focus on OWASP Top 10: injection, broken auth, XSS, SSRF, etc.
- Test authentication and authorization flows
- Check for API security issues
"""
    else:  # external_ip
        base_prompt += """
SCOPE:
- Perform network reconnaissance
- Scan for open ports and services
- Test for common misconfigurations
- Check firewall rules and security posture
- Identify vulnerable services
"""
    
    if additional_context:
        base_prompt += f"\nADDITIONAL CONTEXT: {additional_context}\n"
    
    base_prompt += """
DELIVERABLE:
Provide a comprehensive security report in JSON format with:
1. Executive summary
2. Detailed findings with severity ratings (critical/high/medium/low/info)
3. Step-by-step reproduction steps
4. Specific remediation guidance
5. CVE references where applicable

OUTPUT FORMAT: JSON
{
  "executiveSummary": "...",
  "report": "... (full markdown report) ...",
  "vulnerabilities": [
    {
      "title": "...",
      "severity": "critical|high|medium|low|info",
      "description": "...",
      "cve": "CVE-XXXX-XXXXX",
      "cvss": 7.5,
      "remediation": "...",
      "affectedEndpoint": "..."
    }
  ]
}
"""
    
    return base_prompt

def parse_claude_response(response_text):
    """
    Extract JSON from Claude response
    """
    try:
        # Try to find JSON block
        if '```json' in response_text:
            json_start = response_text.find('```json') + 7
            json_end = response_text.find('```', json_start)
            json_text = response_text[json_start:json_end].strip()
        elif '{' in response_text and '}' in response_text:
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            json_text = response_text[json_start:json_end]
        else:
            # Fallback: create basic structure
            return {
                'executiveSummary': 'Analysis completed',
                'report': response_text,
                'vulnerabilities': []
            }
        
        return json.loads(json_text)
    except Exception as e:
        print(f"⚠️  Error parsing JSON: {e}")
        return {
            'executiveSummary': 'Analysis completed',
            'report': response_text,
            'vulnerabilities': []
        }

def upload_to_gcs(file_path, pentest_id):
    """
    Upload PDF to Google Cloud Storage and return public URL
    """
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(GCS_BUCKET_NAME)
        blob_name = f"reports/{pentest_id}.pdf"
        blob = bucket.blob(blob_name)
        
        blob.upload_from_filename(file_path, content_type='application/pdf')
        
        # Bucket has uniform bucket-level access with allUsers:objectViewer
        # So just construct the public URL directly
        url = f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/{blob_name}"
        print(f"✅ PDF uploaded to GCS: {url}")
        
        return url
    except Exception as e:
        print(f"⚠️  Error uploading to GCS: {e}")
        return None

def send_results_to_webapp(pentest_id, status, results, vulnerabilities, webhook_secret, webapp_api_url, error=None):
    """
    Send pentest results back to webapp via PATCH endpoint
    """
    payload = {
        'pentestId': pentest_id,
        'status': status,
        'results': results,
        'vulnerabilities': vulnerabilities
    }
    
    if error:
        payload['error'] = error
    
    try:
        response = requests.patch(
            webapp_api_url,
            json=payload,
            headers={
                'Content-Type': 'application/json',
                'X-Webhook-Secret': webhook_secret
            },
            timeout=30
        )
        
        if response.status_code == 200:
            print(f"✅ Results sent to webapp successfully")
        else:
            print(f"⚠️  Webapp returned status {response.status_code}: {response.text}")
    except Exception as e:
        print(f"❌ Error sending results to webapp: {e}")
