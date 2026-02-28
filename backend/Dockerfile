# Use Kali Linux as base for full red team toolkit
FROM kalilinux/kali-rolling

# Install Python 3.11 and essential tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    # WeasyPrint dependencies
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    # Kali red team tools
    kali-linux-default \
    nmap \
    sqlmap \
    nikto \
    gobuster \
    dirb \
    hydra \
    john \
    hashcat \
    metasploit-framework \
    burpsuite \
    zaproxy \
    nuclei \
    ffuf \
    sublist3r \
    wpscan \
    exploitdb \
    netcat-traditional \
    tcpdump \
    wireshark \
    aircrack-ng \
    && rm -rf /var/lib/apt/lists/*

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
