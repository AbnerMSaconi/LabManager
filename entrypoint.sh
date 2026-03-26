#!/bin/sh
set -e

echo "⏳ Aguardando banco de dados ficar disponível..."
until python -c "import socket; socket.create_connection(('db', 5432), timeout=1)" 2>/dev/null; do
  echo "   banco ainda não pronto — aguardando 2s..."
  sleep 2
done
echo "✅ Banco disponível."

echo "🔄 Rodando migrações Alembic..."
alembic upgrade head

echo "🌱 Populando dados iniciais..."
python -m backend.seed || echo "⚠️  Seed concluído com avisos (dados já existentes ou erro não-fatal)."

echo "🚀 Iniciando servidor com Gunicorn..."
# SSE usa asyncio.Queue (memória do processo) — 1 worker garante que todos
# os clientes conectados recebam os broadcasts. Uvicorn async suporta
# centenas de conexões simultâneas com 1 worker.
exec gunicorn backend.app.main:app \
    --workers 1 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
