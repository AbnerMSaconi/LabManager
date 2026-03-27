FROM python:3.12-slim

WORKDIR /app

# Instala o Microsoft ODBC Driver 18 for SQL Server
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl gnupg2 apt-transport-https \
    && curl -sSL https://packages.microsoft.com/keys/microsoft.asc \
       | gpg --dearmor > /usr/share/keyrings/microsoft-prod.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] \
       https://packages.microsoft.com/debian/12/prod bookworm main" \
       > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends \
       msodbcsql18 unixodbc-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Instala dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código
COPY . .

# Script de entrypoint
COPY entrypoint.sh /entrypoint.sh

# 1. Remove caracteres ocultos do Windows (\r)
# 2. Garante a permissão de execução
RUN sed -i 's/\r$//' /entrypoint.sh && \
    chmod +x /entrypoint.sh

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]