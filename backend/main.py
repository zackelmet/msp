"""
MSP Pentesting Backend - Webhook Receiver
Receives pentest jobs from webapp, spawns background worker, returns immediately
"""

import os
import threading
from flask import Flask, request, jsonify
from worker import execute_pentest

app = Flask(__name__)

# Environment variables
WEBHOOK_SECRET = os.environ.get('GCP_WEBHOOK_SECRET')
WEBAPP_API_URL = os.environ.get('WEBAPP_API_URL', 'https://msppentesting.vercel.app/api/pentests')

@app.route('/execute-pentest', methods=['POST'])
def receive_pentest():
    """
    Webhook endpoint to receive pentest jobs from webapp
    Returns 200 OK immediately and processes in background thread
    """
    # Verify webhook secret
    webhook_secret = request.headers.get('X-Webhook-Secret')
    if webhook_secret != WEBHOOK_SECRET:
        return jsonify({'error': 'Unauthorized - Invalid webhook secret'}), 401
    
    # Parse request body
    data = request.json
    pentest_id = data.get('pentestId')
    user_id = data.get('userId')
    pentest_type = data.get('type')
    target_url = data.get('targetUrl')
    user_roles = data.get('userRoles')
    endpoints = data.get('endpoints')
    additional_context = data.get('additionalContext')
    
    if not pentest_id or not target_url or not pentest_type:
        return jsonify({'error': 'Missing required fields'}), 400
    
    # Spawn background thread to execute pentest
    thread = threading.Thread(
        target=execute_pentest,
        args=(pentest_id, user_id, pentest_type, target_url, user_roles, endpoints, additional_context, WEBHOOK_SECRET, WEBAPP_API_URL)
    )
    thread.daemon = True
    thread.start()
    
    print(f"✅ Pentest job {pentest_id} received and queued")
    
    # Return success immediately
    return jsonify({
        'success': True,
        'message': 'Pentest job received',
        'pentestId': pentest_id
    }), 200

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
