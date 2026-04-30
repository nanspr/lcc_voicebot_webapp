FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Create non-root user for security (Azure App Service best practice)
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Install system dependencies for ODBC
# Python 3.11-slim is based on Debian 11 (bullseye)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl apt-transport-https gnupg ca-certificates \
    && mkdir -p /usr/share/keyrings \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && echo "deb [arch=amd64,arm64,armhf signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/11/prod bullseye main" > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /usr/app

# Copy requirements first for better Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt && \
    python -c "import pyodbc; print('✅ pyodbc installed successfully'); print('Available drivers:', pyodbc.drivers())"

# Copy application code
COPY --chown=appuser:appuser . /usr/app

# Switch to non-root user
USER appuser

# Expose port (Azure App Service will use PORT env var)
EXPOSE 8000

# Health check for Azure App Service
# Checks if the API root endpoint is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import os, urllib.request; port = os.getenv('PORT', '8000'); urllib.request.urlopen(f'http://localhost:{port}/', timeout=5)"

# Use python main.py which handles ENVIRONMENT variable
# - ENVIRONMENT=development: uses reload mode (hot reload)
# - ENVIRONMENT=production: uses workers mode
# Azure App Service sets PORT automatically, main.py will read it
CMD ["python", "main.py"]

