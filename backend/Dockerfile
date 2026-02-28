# Use Python 3.11 as base
FROM python:3.11-slim

# Disable Python output buffering so logs appear in Cloud Run immediately
ENV PYTHONUNBUFFERED=1

# Install essential pentesting tools and dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    # WeasyPrint dependencies
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    # Essential pentesting tools
    nmap \
    git \
    curl \
    wget \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Install additional pentesting tools via pip
RUN pip3 install --no-cache-dir \
    sqlmap

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
