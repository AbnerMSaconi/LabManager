#!/bin/sh
set -e

echo "⏳ Aguardando banco de dados SQL Server ficar disponível..."
# Corrigido para a porta 1433 (MSSQL)
until python -c "import socket; socket.create_connection(('db', 1433), timeout=1)" 2>/dev/null; do
  echo "   banco ainda não pronto — aguardando 2s..."
  sleep 2
done
echo "✅ Banco disponível na porta 1433."

echo "🔧 Garantindo que o banco de dados 'labmanager' exista..."
# Script Python rápido para criar o banco de dados se ele não existir
python -c "
import os
import pyodbc

server = 'db'
database = 'labmanager'
username = 'SA'
password = os.environ.get('MSSQL_SA_PASSWORD', 'LabManager_2024!')
conn_str = f'DRIVER={{ODBC Driver 18 for SQL Server}};SERVER={server};UID={username};PWD={password};TrustServerCertificate=yes;'

try:
    conn = pyodbc.connect(conn_str, autocommit=True)
    cursor = conn.cursor()
    cursor.execute(f\"IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '{database}') CREATE DATABASE {database}\")
    print(f\"✅ Banco de dados '{database}' verificado/criado com sucesso.\")
except Exception as e:
    print(f\"❌ Erro ao criar banco de dados: {e}\")
    exit(1)
"

echo "🔄 Rodando migrações Alembic..."
alembic upgrade head

echo "🌱 Populando dados iniciais..."
python -m seed || echo "⚠️  Seed concluído com avisos (dados já existentes ou erro não-fatal)."

echo "🚀 Iniciando servidor com Gunicorn..."
exec gunicorn app.main:app \
    --workers 1 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -