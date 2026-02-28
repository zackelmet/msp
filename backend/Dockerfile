# Use Python 3.11 as base
FROM python:3.11-slim

# Install essential pentesting tools and dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    # WeasyPrint dependencies
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    # Essential pentesting tools
    nmap \
    nikto \
    git \
    curl \
    wget \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Install additional pentesting tools via pip/git
RUN pip3 install --no-cache-dir \
    sqlmap-dev \
    wapiti3 \
    && git clone https://github.com/projectdiscovery/nuclei-templates.git /opt/nuclei-templates

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Run with gunicorn
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:app
